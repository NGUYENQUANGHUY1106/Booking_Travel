import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  OwnerDashboardHotelsQueryDto,
  OwnerDashboardQueryDto,
} from './dto/owner-dashboard-query.dto';

const DAY_MS = 86_400_000;
export const OWNER_DASHBOARD_CLOCK = Symbol('OWNER_DASHBOARD_CLOCK');
const HOTEL_SELECT = { id: true, name: true, status: true } as const;

export function dashboardPeriod(
  query: OwnerDashboardQueryDto,
  now = new Date(),
) {
  if (query.timeZone !== 'Asia/Ho_Chi_Minh')
    throw new BadRequestException('Thống kê sử dụng giờ Việt Nam.');
  const from = new Date(`${query.dateFrom}T00:00:00.000Z`);
  const to = new Date(`${query.dateTo}T00:00:00.000Z`);
  for (const [date, input] of [
    [from, query.dateFrom],
    [to, query.dateTo],
  ] as const) {
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== input ||
      input.startsWith('0000')
    ) {
      throw new BadRequestException('Ngày thống kê không hợp lệ.');
    }
  }
  if (from > to)
    throw new BadRequestException('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
  let today: string;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: query.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    today = `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    throw new BadRequestException('Múi giờ thống kê không hợp lệ.');
  }
  const days = (to.getTime() - from.getTime()) / DAY_MS + 1;
  const previousFrom = new Date(from.getTime() - days * DAY_MS);
  if (previousFrom.getUTCFullYear() < 1)
    throw new BadRequestException('Khoảng ngày vượt phạm vi hỗ trợ.');
  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    timeZone: query.timeZone,
    today,
    previousFrom: previousFrom.toISOString().slice(0, 10),
    previousTo: new Date(from.getTime() - DAY_MS).toISOString().slice(0, 10),
  };
}

@Injectable()
export class OwnerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OWNER_DASHBOARD_CLOCK) private readonly now: () => Date,
  ) {}

  async hotels(ownerId: string, query: OwnerDashboardHotelsQueryDto) {
    const items = await this.prisma.hotel.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(query.after ? { id: { gt: query.after } } : {}),
      },
      select: HOTEL_SELECT,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    const more = items.length > query.limit;
    if (more) items.pop();
    return { items, nextCursor: more ? items.at(-1)!.id : null };
  }

  async dashboard(ownerId: string, query: OwnerDashboardQueryDto) {
    const updatedAt = this.now();
    const period = dashboardPeriod(query, updatedAt);
    return this.prisma.$transaction(
      async (tx) => {
        const hotelWhere = {
          ownerId,
          deletedAt: null,
          ...(query.hotelId ? { id: query.hotelId } : {}),
        };
        const hotel = query.hotelId
          ? await tx.hotel.findFirst({
              where: hotelWhere,
              select: HOTEL_SELECT,
            })
          : null;
        if (query.hotelId && !hotel)
          throw new NotFoundException(
            'Không tìm thấy khách sạn trong phạm vi quản lý.',
          );
        const hotelCount = await tx.hotel.count({ where: hotelWhere });
        const rooms = await tx.room.aggregate({
          where: { hotel: hotelWhere, deletedAt: null },
          _sum: { quantity: true },
        });
        // createdAt is a Prisma timestamp without timezone containing UTC. Stay dates are @db.Date.
        const [counts] = await tx.$queryRaw<
          {
            created: number;
            previous: number;
            arrivals: number;
            departures: number;
            upcoming: number;
            guests: number;
          }[]
        >(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE (b."createdAt" AT TIME ZONE 'UTC') >= (${period.dateFrom}::date::timestamp AT TIME ZONE ${period.timeZone})
            AND (b."createdAt" AT TIME ZONE 'UTC') < ((${period.dateTo}::date + 1)::timestamp AT TIME ZONE ${period.timeZone}))::int AS created,
          COUNT(*) FILTER (WHERE (b."createdAt" AT TIME ZONE 'UTC') >= (${period.previousFrom}::date::timestamp AT TIME ZONE ${period.timeZone})
            AND (b."createdAt" AT TIME ZONE 'UTC') < (${period.dateFrom}::date::timestamp AT TIME ZONE ${period.timeZone}))::int AS previous,
          COUNT(*) FILTER (WHERE b."checkIn" = ${period.today}::date AND b.status = 'CONFIRMED')::int AS arrivals,
          COUNT(*) FILTER (WHERE b."checkOut" = ${period.today}::date AND b.status = 'CHECKED_IN')::int AS departures,
          COUNT(*) FILTER (WHERE b."checkIn" > ${period.today}::date AND b.status = 'CONFIRMED')::int AS upcoming,
          COALESCE(SUM(b.adults + b.children) FILTER (WHERE b.status = 'CHECKED_IN'
            AND b."checkIn" <= ${period.today}::date AND b."checkOut" > ${period.today}::date), 0)::int AS guests
        FROM "Booking" b JOIN "Hotel" h ON h.id = b."hotelId"
        WHERE h."ownerId" = ${ownerId} AND h."deletedAt" IS NULL
          ${query.hotelId ? Prisma.sql`AND h.id = ${query.hotelId}` : Prisma.empty}
          AND ((b."createdAt" AT TIME ZONE 'UTC') >= (${period.previousFrom}::date::timestamp AT TIME ZONE ${period.timeZone})
            AND (b."createdAt" AT TIME ZONE 'UTC') < ((${period.dateTo}::date + 1)::timestamp AT TIME ZONE ${period.timeZone})
            OR b.status IN ('CONFIRMED', 'CHECKED_IN'))
      `);
        const unavailable = (reason: string) => ({
          availability: 'unavailable' as const,
          reason,
        });
        return {
          scope: { hotel, hotelCount, ...period },
          updatedAt: updatedAt.toISOString(),
          summary: {
            hotelCount,
            roomCount: rooms._sum.quantity ?? 0,
            upcomingBookings: counts.upcoming,
            currentGuests: counts.guests,
          },
          bookings: {
            availability: 'available' as const,
            basis: 'createdAt' as const,
            count: counts.created,
            previousCount: counts.previous,
            difference: counts.created - counts.previous,
          },
          occupancy: {
            ...unavailable('INVENTORY_NOT_IMPLEMENTED'),
            percentage: null,
            soldRoomNights: null,
            sellableRoomNights: null,
          },
          revenue: {
            ...unavailable('PAYMENT_REFUND_NOT_IMPLEMENTED'),
            amount: null,
            currency: null,
            comparison: null,
          },
          revenueSeries: {
            ...unavailable('REVENUE_POLICY_NOT_BASELINED'),
            points: null,
          },
          rating: {
            ...unavailable('REVIEWS_NOT_IMPLEMENTED'),
            score: null,
            count: null,
          },
          actions: {
            date: period.today,
            arrivals: counts.arrivals,
            departures: counts.departures,
            support: unavailable('INBOX_NOT_IMPLEMENTED'),
          },
          ai: unavailable('AI_NOT_IMPLEMENTED'),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
