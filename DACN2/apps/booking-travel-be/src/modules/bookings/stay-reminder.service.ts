import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { BookingStatus, Prisma, StayReminderKind } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_BATCH_SIZE = 500;
const STAY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function scheduledStayDateTime(
  date: Date,
  time: string | null,
  fallback: string,
) {
  const day = date.toISOString().slice(0, 10);
  const validTime =
    time && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : fallback;
  return new Date(`${day}T${validTime}:00+07:00`);
}

@Injectable()
export class StayReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StayReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
    void this.sweep();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async listForBooking(userId: string, bookingId: string) {
    return this.prisma.stayReminder.findMany({
      where: { userId, bookingId },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        kind: true,
        scheduledAt: true,
        sentAt: true,
        createdAt: true,
      },
    });
  }

  async sweep() {
    if (this.running) return { scanned: 0, sent: 0 };
    this.running = true;
    try {
      const now = new Date();
      const bookings = await this.prisma.booking.findMany({
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
          },
        },
        orderBy: { updatedAt: 'asc' },
        take: SWEEP_BATCH_SIZE,
        select: {
          id: true,
          code: true,
          userId: true,
          hotelNameSnapshot: true,
          status: true,
          checkIn: true,
          checkOut: true,
          checkInTimeSnapshot: true,
          checkOutTimeSnapshot: true,
          hotel: {
            select: {
              checkInTime: true,
              checkOutTime: true,
            },
          },
        },
      });

      let sent = 0;
      for (const booking of bookings) {
        const checkIn = scheduledStayDateTime(
          booking.checkIn,
          booking.checkInTimeSnapshot ?? booking.hotel.checkInTime,
          '14:00',
        );
        const checkOut = scheduledStayDateTime(
          booking.checkOut,
          booking.checkOutTimeSnapshot ?? booking.hotel.checkOutTime,
          '12:00',
        );

        if (booking.status === BookingStatus.CONFIRMED) {
          sent += await this.sendKind(
            booking,
            StayReminderKind.CHECK_IN_24H,
            checkIn,
            24,
            now,
            'Sắp đến giờ nhận phòng',
            `Booking ${booking.code} nhận phòng tại ${booking.hotelNameSnapshot} lúc 14:00 ngày ${this.vnDate(checkIn)}.`,
          );
          sent += await this.sendKind(
            booking,
            StayReminderKind.CHECK_IN_2H,
            checkIn,
            2,
            now,
            'Nhận phòng trong 2 giờ',
            `Booking ${booking.code} tại ${booking.hotelNameSnapshot} sẽ nhận phòng vào lúc ${this.vnTime(checkIn)}.`,
          );
        }

        if (booking.status === BookingStatus.CHECKED_IN) {
          sent += await this.sendKind(
            booking,
            StayReminderKind.CHECK_OUT_24H,
            checkOut,
            24,
            now,
            'Nhắc trả phòng ngày mai',
            `Booking ${booking.code} tại ${booking.hotelNameSnapshot} cần trả phòng trước ${this.vnTime(checkOut)} ngày ${this.vnDate(checkOut)}.`,
          );
          sent += await this.sendKind(
            booking,
            StayReminderKind.CHECK_OUT_2H,
            checkOut,
            2,
            now,
            'Trả phòng trong 2 giờ',
            `Bạn cần trả phòng Booking ${booking.code} trước ${this.vnTime(checkOut)}.`,
          );
        }
      }
      if (sent) this.logger.log(`Stay reminder sweep sent=${sent}`);
      return { scanned: bookings.length, sent };
    } catch (error) {
      this.logger.error(
        `Stay reminder sweep failed: ${error instanceof Error ? error.name : 'unknown'}`,
      );
      return { scanned: 0, sent: 0 };
    } finally {
      this.running = false;
    }
  }

  private async sendKind(
    booking: {
      id: string;
      code: string;
      userId: string;
      hotelNameSnapshot: string;
      status: BookingStatus;
    },
    kind: StayReminderKind,
    scheduledAt: Date,
    offsetHours: number,
    now: Date,
    title: string,
    body: string,
  ) {
    const threshold = new Date(
      scheduledAt.getTime() - offsetHours * 60 * 60 * 1000,
    );
    if (now.getTime() < threshold.getTime() || now >= scheduledAt) return 0;

    const created = await this.claimReminder(
      booking.id,
      booking.userId,
      kind,
      scheduledAt,
    );
    if (!created) return 0;

    await this.notifications.createNotification({
      userId: booking.userId,
      type: kind,
      title,
      body,
      data: {
        bookingId: booking.id,
        kind,
        route: '/user/bookings',
      },
    });
    await this.prisma.stayReminder.updateMany({
      where: {
        bookingId: booking.id,
        kind,
        sentAt: null,
      },
      data: { sentAt: new Date() },
    });
    return 1;
  }

  private async claimReminder(
    bookingId: string,
    userId: string,
    kind: StayReminderKind,
    scheduledAt: Date,
  ) {
    try {
      await this.prisma.stayReminder.create({
        data: { bookingId, userId, kind, scheduledAt },
        select: { id: true },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return false;
      throw error;
    }
  }

  private vnDate(date: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: STAY_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private vnTime(date: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: STAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  }
}
