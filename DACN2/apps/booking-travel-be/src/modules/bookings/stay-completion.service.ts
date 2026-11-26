import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { BookingStatus, Prisma, RefundRequestStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CHECKOUT_GRACE_MS, scheduledCheckoutAt } from './stay-date-policy';

const SWEEP_INTERVAL_MS = 60_000;
const BATCH_SIZE = 200;

@Injectable()
export class StayCompletionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StayCompletionService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
    void this.sweep();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep() {
    if (this.running) return { scanned: 0, completed: 0, needsReview: 0 };
    this.running = true;
    let scanned = 0;
    let completed = 0;
    let needsReview = 0;
    try {
      const now = new Date();
      const today = new Date(now.getTime() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      let cursor: string | undefined;
      while (true) {
        const page = await this.prisma.booking.findMany({
          where: {
            status: BookingStatus.CHECKED_IN,
            checkOut: { lte: new Date(`${today}T00:00:00.000Z`) },
          },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            checkOut: true,
            checkOutTimeSnapshot: true,
            hotel: { select: { checkOutTime: true } },
          },
        });
        if (!page.length) break;
        cursor = page[page.length - 1].id;
        for (const booking of page) {
          scanned++;
          const scheduled = scheduledCheckoutAt(
            booking.checkOut,
            booking.checkOutTimeSnapshot,
          );
          if (!scheduled) {
            needsReview++;
            continue;
          }
          if (now.getTime() < scheduled.getTime() + CHECKOUT_GRACE_MS) continue;
          if (await this.complete(booking.id)) completed++;
        }
        if (page.length < BATCH_SIZE) break;
      }
      if (completed || needsReview)
        this.logger.log(
          `Stay reconciliation: scanned=${scanned} completed=${completed} needsReview=${needsReview}`,
        );
      return { scanned, completed, needsReview };
    } catch (error) {
      this.logger.error('Stay completion sweep failed', error);
      return { scanned, completed, needsReview };
    } finally {
      this.running = false;
    }
  }

  private async complete(id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${id} FOR UPDATE`;
        const booking = await tx.booking.findUnique({
          where: { id },
          select: {
            id: true,
            hotelId: true,
            roomId: true,
            roomCount: true,
            status: true,
            checkOut: true,
            checkOutTimeSnapshot: true,
            hotel: { select: { checkOutTime: true, ownerId: true } },
            refundRequests: { select: { status: true } },
            payments: { select: { reconciliationRequired: true } },
          },
        });
        if (!booking || booking.status !== BookingStatus.CHECKED_IN)
          return false;
        if (
          booking.refundRequests.some(
            (item) => item.status !== RefundRequestStatus.REJECTED,
          ) ||
          booking.payments.some((item) => item.reconciliationRequired)
        )
          return false;
        const scheduled = scheduledCheckoutAt(
          booking.checkOut,
          booking.checkOutTimeSnapshot,
        );
        const [{ now }] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT statement_timestamp() AS now`;
        if (
          !scheduled ||
          now.getTime() < scheduled.getTime() + CHECKOUT_GRACE_MS
        )
          return false;
        const changed = await tx.booking.updateMany({
          where: { id, status: BookingStatus.CHECKED_IN },
          data: {
            status: BookingStatus.COMPLETED,
            completedAt: now,
            completionMethod: 'AUTO_AFTER_GRACE_PERIOD',
          },
        });
        if (!changed.count) return false;
        const eventId = randomUUID();
        await tx.bookingStayTransition.create({
          data: {
            id: eventId,
            bookingId: id,
            hotelId: booking.hotelId,
            actorId: null,
            action: 'CHECK_OUT',
            previousStatus: BookingStatus.CHECKED_IN,
            newStatus: BookingStatus.COMPLETED,
            verificationMethod: 'AUTO',
            idempotencyKey: `auto-${id}`.slice(0, 120),
            happenedAt: now,
            eventType: 'BOOKING_COMPLETED',
            correlationId: eventId,
          },
        });
        // Keep the room unavailable until the owner confirms the physical handover.
        const block = await tx.roomInventoryBlock.create({
          data: {
            roomId: booking.roomId,
            hotelId: booking.hotelId,
            actorId: booking.hotel.ownerId,
            startDate: booking.checkOut,
            endDateExclusive: new Date('2099-01-01T00:00:00.000Z'),
            quantity: booking.roomCount,
            reason: `Chờ xác nhận bàn giao sau tự hoàn tất booking ${id}`,
            idempotencyKey: `auto-handover-${id}`,
          },
        });
        await tx.stayHandoverAlert.create({
          data: {
            bookingId: id,
            hotelId: booking.hotelId,
            inventoryBlockId: block.id,
          },
        });
        const notification = JSON.stringify({
          eventId,
          eventType: 'BOOKING_COMPLETED',
          bookingId: id,
        });
        await tx.$queryRaw`SELECT 1 AS notified FROM pg_notify('booking_stay_changed', ${notification})`;
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
