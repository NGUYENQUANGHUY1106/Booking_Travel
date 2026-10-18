import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, RoomStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

const ACTIVE_INVENTORY_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];
const MILLISECONDS_PER_DAY = 86_400_000;

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: BookingQueryDto) {
    return this.prisma.booking.findMany({
      where: {
        userId: query.userId,
        hotelId: query.hotelId,
        status: query.status,
      },
      include: {
        hotel: { select: { id: true, name: true, ownerId: true } },
        room: { select: { id: true, name: true, type: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        hotel: true,
        room: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');
    return booking;
  }

  async create(input: CreateBookingDto) {
    const checkIn = this.parseDate(input.checkIn);
    const checkOut = this.parseDate(input.checkOut);
    const nights = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / MILLISECONDS_PER_DAY,
    );
    if (nights < 1) {
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng.');
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const room = await transaction.room.findFirst({
          where: {
            id: input.roomId,
            deletedAt: null,
            status: RoomStatus.ACTIVE,
            hotel: { deletedAt: null },
          },
          include: { hotel: true },
        });
        if (!room)
          throw new NotFoundException(
            'Phòng không tồn tại hoặc đang ngừng bán.',
          );

        const user = await transaction.user.findFirst({
          where: { id: input.userId, isActive: true },
          select: { id: true },
        });
        if (!user)
          throw new NotFoundException('Không tìm thấy người đặt phòng.');

        const roomCount = input.roomCount ?? 1;
        const reserved = await transaction.booking.aggregate({
          where: {
            roomId: room.id,
            status: { in: ACTIVE_INVENTORY_STATUSES },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
          _sum: { roomCount: true },
        });
        if ((reserved._sum.roomCount ?? 0) + roomCount > room.quantity) {
          throw new ConflictException(
            'Không đủ số lượng phòng trong khoảng ngày đã chọn.',
          );
        }

        const pricePerNight = room.basePrice;
        const totalAmount = pricePerNight.mul(nights).mul(roomCount);
        return transaction.booking.create({
          data: {
            code: `BT-${randomUUID().slice(0, 8).toUpperCase()}`,
            userId: user.id,
            hotelId: room.hotelId,
            roomId: room.id,
            checkIn,
            checkOut,
            adults: input.adults,
            children: input.children ?? 0,
            roomCount,
            nights,
            pricePerNight,
            totalAmount,
            currency: room.currency,
            guestName: input.guestName.trim(),
            guestEmail: input.guestEmail.trim().toLowerCase(),
            guestPhone: input.guestPhone?.trim(),
            note: input.note?.trim(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateStatus(id: string, input: UpdateBookingStatusDto) {
    await this.get(id);
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: input.status,
        cancelledAt:
          input.status === BookingStatus.CANCELLED ? new Date() : undefined,
      },
    });
  }

  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Ngày nhận hoặc trả phòng không hợp lệ.');
    }
    return date;
  }
}
