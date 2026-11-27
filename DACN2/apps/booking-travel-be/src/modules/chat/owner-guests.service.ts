import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, HotelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

type GuestRow = {
  hotelId: string;
  hotelName: string;
  userId: string;
  userName: string;
  conversationId: string | null;
  bookingId: string | null;
  bookingCode: string | null;
  bookingStatus: BookingStatus | null;
  checkIn: Date | null;
  checkOut: Date | null;
  guestName: string | null;
  stayPhase: 'CHECK_IN_TODAY' | 'UPCOMING' | 'STAYING' | 'COMPLETED' | 'OTHER';
  bookingCount: bigint;
  stayCount: bigint;
};

@Injectable()
export class OwnerGuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ownerId: string,
    input: { hotelId?: string; search?: string; page?: string; limit?: string },
  ) {
    const page = this.integer(input.page, 1, 1, 100000);
    const limit = this.integer(input.limit, 20, 1, 50);
    const hotelId = input.hotelId?.trim();
    if (hotelId) await this.ownedHotel(ownerId, hotelId);
    const search = input.search?.trim().slice(0, 100) ?? '';
    const hotelClause = hotelId
      ? Prisma.sql`AND h.id = ${hotelId}`
      : Prisma.empty;
    const searchClause = search
      ? Prisma.sql`AND (u."fullName" ILIKE ${`%${search}%`} OR h.name ILIKE ${`%${search}%`} OR EXISTS (
          SELECT 1 FROM "Booking" matched WHERE matched."hotelId" = h.id AND matched."userId" = u.id AND matched."guestName" ILIKE ${`%${search}%`}
        ))`
      : Prisma.empty;
    const from = Prisma.sql`
      FROM (SELECT b."hotelId", b."userId" FROM "Booking" b
            UNION SELECT c."hotelId", c."userId" FROM "Conversation" c) relation
      JOIN "Hotel" h ON h.id = relation."hotelId" AND h."ownerId" = ${ownerId} AND h."deletedAt" IS NULL
      JOIN "User" u ON u.id = relation."userId"`;
    const where = Prisma.sql`WHERE TRUE ${hotelClause} ${searchClause}`;
    const [countRows, rows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`SELECT COUNT(*) AS total ${from} ${where}`,
      ),
      this.prisma.$queryRaw<GuestRow[]>(Prisma.sql`
        SELECT h.id AS "hotelId", h.name AS "hotelName", u.id AS "userId", u."fullName" AS "userName",
          c.id AS "conversationId", latest.id AS "bookingId", latest.code AS "bookingCode",
          latest.status AS "bookingStatus", latest."checkIn", latest."checkOut", latest."guestName",
          CASE WHEN latest.status = 'CHECKED_IN' THEN 'STAYING'
               WHEN latest.status = 'CONFIRMED' AND latest."checkIn" = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN 'CHECK_IN_TODAY'
               WHEN latest.status = 'CONFIRMED' AND latest."checkIn" > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN 'UPCOMING'
               WHEN latest.status = 'COMPLETED' THEN 'COMPLETED' ELSE 'OTHER' END AS "stayPhase",
          COALESCE(stats.bookings, 0) AS "bookingCount", COALESCE(stats.stays, 0) AS "stayCount"
        ${from}
        LEFT JOIN LATERAL (
          SELECT b.id, b.code, b.status, b."checkIn", b."checkOut", b."guestName"
          FROM "Booking" b WHERE b."hotelId" = h.id AND b."userId" = u.id
          ORDER BY b."createdAt" DESC, b.id DESC LIMIT 1
        ) latest ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS bookings,
            COUNT(*) FILTER (WHERE b.status IN ('CHECKED_IN', 'COMPLETED')) AS stays
          FROM "Booking" b WHERE b."hotelId" = h.id AND b."userId" = u.id
        ) stats ON TRUE
        LEFT JOIN "Conversation" c ON c."hotelId" = h.id AND c."userId" = u.id
        ${where}
        ORDER BY COALESCE(latest."checkIn", c."updatedAt") DESC NULLS LAST, h.id, u.id
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    ]);
    return {
      items: rows.map((row) => ({
        ...row,
        bookingCount: Number(row.bookingCount),
        stayCount: Number(row.stayCount),
        relation: row.bookingId ? 'BOOKING' : 'CHAT_ONLY',
      })),
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
    };
  }

  async detail(
    ownerId: string,
    hotelId: string,
    userId: string,
    pageText?: string,
  ) {
    const hotel = await this.ownedHotel(ownerId, hotelId);
    const page = this.integer(pageText, 1, 1, 100000);
    const where: Prisma.BookingWhereInput = { hotelId, userId };
    const [bookingCount, conversation, user] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.conversation.findUnique({
        where: { userId_hotelId: { userId, hotelId } },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true },
      }),
    ]);
    if (!user || (!bookingCount && !conversation))
      throw new NotFoundException('Không tìm thấy khách trong khách sạn này.');
    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 20,
      take: 20,
      select: {
        id: true,
        code: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        roomCount: true,
        adults: true,
        children: true,
        status: true,
        createdAt: true,
      },
    });
    const stayCount = await this.prisma.booking.count({
      where: {
        ...where,
        status: { in: [BookingStatus.CHECKED_IN, BookingStatus.COMPLETED] },
      },
    });
    return {
      hotel: { id: hotel.id, name: hotel.name },
      user,
      relation: bookingCount ? 'BOOKING' : 'CHAT_ONLY',
      conversationId: conversation?.id ?? null,
      bookingCount,
      stayCount,
      bookings,
      page,
    };
  }

  async openConversation(ownerId: string, hotelId: string, userId: string) {
    const hotel = await this.ownedHotel(ownerId, hotelId);
    const existing = await this.prisma.conversation.findUnique({
      where: { userId_hotelId: { userId, hotelId } },
      select: { id: true, ownerId: true },
    });
    if (existing) {
      if (existing.ownerId === ownerId) return { id: existing.id };
      return this.prisma.conversation.update({
        where: { id: existing.id },
        data: { ownerId },
        select: { id: true },
      });
    }
    const booked = await this.prisma.booking.findFirst({
      where: {
        hotelId,
        userId,
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.COMPLETED,
          ],
        },
      },
      select: { id: true },
    });
    if (!booked || hotel.status !== HotelStatus.APPROVED || !hotel.isVisible)
      throw new NotFoundException('Không thể mở hội thoại cho khách này.');
    return this.prisma.conversation.upsert({
      where: { userId_hotelId: { userId, hotelId } },
      create: { userId, hotelId, ownerId },
      update: { ownerId },
      select: { id: true },
    });
  }

  private async ownedHotel(ownerId: string, hotelId: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, ownerId, deletedAt: null },
      select: { id: true, name: true, status: true, isVisible: true },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    return hotel;
  }

  private integer(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max)
      throw new BadRequestException('Tham số phân trang không hợp lệ.');
    return parsed;
  }
}
