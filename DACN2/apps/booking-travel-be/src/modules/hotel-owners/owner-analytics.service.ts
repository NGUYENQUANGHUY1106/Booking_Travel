import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { dashboardPeriod } from './owner-dashboard.service';
import { OwnerAnalyticsQueryDto } from './dto/owner-analytics-query.dto';

const DAY_MS = 86_400_000;
type CashRow = {
  date: string;
  roomId: string;
  kind: 'PAYMENT' | 'REFUND';
  amount: string;
};
type StayRow = { date: string; roomId: string; sold: number; value: string };
type CapacityRow = { date: string; roomId: string; capacity: number };
type CreatedRow = {
  date: string;
  roomId: string;
  total: number;
  cancelled: number;
  gross: string;
};

function bucket(
  date: string,
  granularity: OwnerAnalyticsQueryDto['granularity'],
) {
  if (granularity === 'YEAR') return date.slice(0, 4);
  if (granularity === 'MONTH') return date.slice(0, 7);
  if (granularity === 'WEEK') {
    const value = new Date(`${date}T00:00:00Z`);
    const weekday = (value.getUTCDay() + 6) % 7;
    return new Date(value.getTime() - weekday * DAY_MS)
      .toISOString()
      .slice(0, 10);
  }
  return date;
}

function bucketEnd(
  start: string,
  granularity: OwnerAnalyticsQueryDto['granularity'],
) {
  if (granularity === 'YEAR') return `${Number(start) + 1}-01-01`;
  if (granularity === 'MONTH') {
    const value = new Date(`${start}-01T00:00:00Z`);
    value.setUTCMonth(value.getUTCMonth() + 1);
    return value.toISOString().slice(0, 10);
  }
  const value = new Date(`${start}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + (granularity === 'WEEK' ? 7 : 1));
  return value.toISOString().slice(0, 10);
}

export function buildOwnerAnalytics(
  dates: string[],
  granularity: OwnerAnalyticsQueryDto['granularity'],
  rooms: { id: string; name: string }[],
  cash: CashRow[],
  stays: StayRow[],
  capacity: CapacityRow[],
  created: CreatedRow[],
) {
  const blank = () => ({
    bookedValue: 0,
    collected: 0,
    refunded: 0,
    soldRoomNights: 0,
    sellableRoomNights: 0,
    occupiedValue: 0,
    bookingCount: 0,
    cancelledCount: 0,
  });
  const buckets = new Map<string, ReturnType<typeof blank>>();
  const byRoom = new Map(
    rooms.map((room) => [room.id, { ...room, ...blank() }]),
  );
  for (const date of dates)
    buckets.set(
      bucket(date, granularity),
      buckets.get(bucket(date, granularity)) ?? blank(),
    );
  const add = (
    date: string,
    roomId: string,
    field: keyof ReturnType<typeof blank>,
    value: number,
  ) => {
    const item = buckets.get(bucket(date, granularity));
    const room = byRoom.get(roomId);
    if (item) item[field] += value;
    if (room) room[field] += value;
  };
  for (const row of cash)
    add(
      row.date,
      row.roomId,
      row.kind === 'PAYMENT' ? 'collected' : 'refunded',
      Number(row.amount),
    );
  for (const row of stays) {
    add(row.date, row.roomId, 'soldRoomNights', Number(row.sold));
    add(row.date, row.roomId, 'occupiedValue', Number(row.value));
  }
  for (const row of capacity)
    add(row.date, row.roomId, 'sellableRoomNights', Number(row.capacity));
  for (const row of created) {
    add(row.date, row.roomId, 'bookingCount', Number(row.total));
    add(row.date, row.roomId, 'cancelledCount', Number(row.cancelled));
    add(row.date, row.roomId, 'bookedValue', Number(row.gross));
  }
  const metrics = (item: ReturnType<typeof blank>) => ({
    ...item,
    netCollected: item.collected - item.refunded,
    occupancyPercent:
      item.sellableRoomNights > 0
        ? (100 * item.soldRoomNights) / item.sellableRoomNights
        : null,
    adr:
      item.soldRoomNights > 0 ? item.occupiedValue / item.soldRoomNights : null,
    cancellationPercent:
      item.bookingCount > 0
        ? (100 * item.cancelledCount) / item.bookingCount
        : null,
  });
  const summary = blank();
  for (const item of buckets.values())
    for (const key of Object.keys(summary) as (keyof typeof summary)[])
      summary[key] += item[key];
  return {
    summary: metrics(summary),
    points: [...buckets].map(([label, item]) => ({
      label,
      bucketStart:
        granularity === 'YEAR'
          ? `${label}-01-01`
          : granularity === 'MONTH'
            ? `${label}-01`
            : label,
      bucketEndExclusive: bucketEnd(label, granularity),
      ...metrics(item),
    })),
    rooms: [...byRoom.values()].map((room) => ({
      id: room.id,
      name: room.name,
      ...metrics(room),
    })),
  };
}

@Injectable()
export class OwnerAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(ownerId: string, query: OwnerAnalyticsQueryDto) {
    const period = dashboardPeriod(query);
    const start = Date.parse(`${period.dateFrom}T00:00:00Z`);
    const end = Date.parse(`${period.dateTo}T00:00:00Z`);
    const days = Math.round((end - start) / DAY_MS) + 1;
    const fromUtc = new Date(start - 7 * 3_600_000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 23);
    const toUtc = new Date(end + DAY_MS - 7 * 3_600_000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 23);
    if (days > 366)
      throw new BadRequestException('Khoảng báo cáo tối đa 366 ngày.');

    return this.prisma.$transaction(
      async (tx) => {
        const where = {
          ownerId,
          deletedAt: null,
          ...(query.hotelId ? { id: query.hotelId } : {}),
        };
        const hotel = query.hotelId
          ? await tx.hotel.findFirst({
              where,
              select: { id: true, name: true },
            })
          : null;
        if (query.hotelId && !hotel)
          throw new NotFoundException(
            'Không tìm thấy khách sạn trong phạm vi quản lý.',
          );
        if (
          query.roomId &&
          !(await tx.room.findFirst({
            where: { id: query.roomId, hotel: where },
            select: { id: true },
          }))
        )
          throw new NotFoundException(
            'Không tìm thấy hạng phòng trong phạm vi quản lý.',
          );

        const roomOptions = await tx.room.findMany({
          where: { hotel: where },
          select: { id: true, name: true, currency: true },
          orderBy: { name: 'asc' },
        });
        const unsupportedBookings = await tx.booking.count({
          where: {
            hotel: where,
            ...(query.roomId ? { roomId: query.roomId } : {}),
            currency: { not: 'VND' },
          },
        });
        if (
          roomOptions.some((room) => room.currency !== 'VND') ||
          unsupportedBookings
        )
          throw new BadRequestException('Báo cáo hiện chỉ hỗ trợ tiền VND.');
        const rooms = query.roomId
          ? roomOptions.filter((room) => room.id === query.roomId)
          : roomOptions;
        const scope = Prisma.sql`h."ownerId" = ${ownerId} AND h."deletedAt" IS NULL
        ${query.hotelId ? Prisma.sql`AND h.id = ${query.hotelId}` : Prisma.empty}
        ${query.roomId ? Prisma.sql`AND b."roomId" = ${query.roomId}` : Prisma.empty}`;
        const roomScope = Prisma.sql`h."ownerId" = ${ownerId} AND h."deletedAt" IS NULL
        ${query.hotelId ? Prisma.sql`AND h.id = ${query.hotelId}` : Prisma.empty}
        ${query.roomId ? Prisma.sql`AND r.id = ${query.roomId}` : Prisma.empty}`;

        // Dates in the schema are UTC timestamps without timezone; convert to the reporting calendar here.
        const cash = await tx.$queryRaw<CashRow[]>(Prisma.sql`
        SELECT date, "roomId", kind, SUM(amount)::text AS amount FROM (
          SELECT ((p."succeededAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS date,
            b."roomId", 'PAYMENT'::text AS kind, p.amount
          FROM "Payment" p JOIN "Booking" b ON b.id = p."bookingId" JOIN "Hotel" h ON h.id = b."hotelId"
          WHERE ${scope} AND b.currency = 'VND' AND p.currency = 'VND'
            AND b."paymentMethod" = 'SIMULATOR' AND p.status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')
            AND p."succeededAt" >= ${fromUtc}::timestamp AND p."succeededAt" < ${toUtc}::timestamp
          UNION ALL
          SELECT ((rr."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text,
            b."roomId", 'REFUND'::text, rr.amount
          FROM "RefundRequest" rr JOIN "Booking" b ON b.id = rr."bookingId" JOIN "Hotel" h ON h.id = b."hotelId"
          WHERE ${scope} AND b.currency = 'VND' AND rr.currency = 'VND' AND rr.status = 'COMPLETED'
            AND rr."completedAt" >= ${fromUtc}::timestamp AND rr."completedAt" < ${toUtc}::timestamp
        ) events GROUP BY date, "roomId", kind`);

        const stays = await tx.$queryRaw<StayRow[]>(Prisma.sql`
        SELECT night::date::text AS date, b."roomId", SUM(b."roomCount")::int AS sold,
          SUM(b."totalAmount" / NULLIF(b.nights, 0))::text AS value
        FROM "Booking" b JOIN "Hotel" h ON h.id = b."hotelId"
          CROSS JOIN LATERAL generate_series(GREATEST(b."checkIn", ${period.dateFrom}::date)::timestamp,
            (LEAST(b."checkOut", (${period.dateTo}::date + 1)) - 1)::timestamp, interval '1 day') night
        WHERE ${scope} AND b.currency = 'VND'
          AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')
          AND b."checkIn" <= ${period.dateTo}::date AND b."checkOut" > ${period.dateFrom}::date
        GROUP BY date, b."roomId"`);

        const capacity = await tx.$queryRaw<CapacityRow[]>(Prisma.sql`
        WITH days AS (SELECT day::date FROM generate_series(${period.dateFrom}::date, ${period.dateTo}::date, interval '1 day') day),
        blocked AS (SELECT d.day, ib."roomId", SUM(ib.quantity)::int AS qty
          FROM "RoomInventoryBlock" ib JOIN days d ON ib."startDate" <= d.day AND ib."endDateExclusive" > d.day
          WHERE ib.active GROUP BY d.day, ib."roomId")
        SELECT d.day::text AS date, r.id AS "roomId",
          GREATEST(0, LEAST(r.quantity, COALESCE(o."sellableQty", r.quantity)) - COALESCE(blocked.qty, 0))::int AS capacity
        FROM "Room" r JOIN "Hotel" h ON h.id = r."hotelId"
          CROSS JOIN days d
          LEFT JOIN "RoomInventoryOverride" o ON o."roomId" = r.id AND o.date = d.day
          LEFT JOIN blocked ON blocked."roomId" = r.id AND blocked.day = d.day
        WHERE ${roomScope} AND h.status = 'APPROVED' AND h."isVisible" = true
          AND r.status = 'ACTIVE' AND r."deletedAt" IS NULL`);

        const created = await tx.$queryRaw<CreatedRow[]>(Prisma.sql`
        SELECT ((b."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS date,
          b."roomId", COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE b.status IN ('CANCELLED', 'REFUND_PENDING', 'REFUNDED'))::int AS cancelled,
          COALESCE(SUM(b."totalAmount") FILTER (WHERE b.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED') AND b.currency = 'VND'), 0)::text AS gross
        FROM "Booking" b JOIN "Hotel" h ON h.id = b."hotelId"
        WHERE ${scope} AND b."createdAt" >= ${fromUtc}::timestamp AND b."createdAt" < ${toUtc}::timestamp
        GROUP BY date, b."roomId"`);

        const dates = Array.from({ length: days }, (_, i) =>
          new Date(start + i * DAY_MS).toISOString().slice(0, 10),
        );
        return {
          version: 'owner-analytics-v1',
          currency: 'VND',
          asOf: new Date().toISOString(),
          sourceFreshness: {
            payments: 'transactional',
            inventory: 'current-state',
            rating: 'unavailable',
          },
          scope: {
            hotelId: query.hotelId ?? null,
            hotelName: hotel?.name ?? null,
            roomId: query.roomId ?? null,
            dateFrom: period.dateFrom,
            dateTo: period.dateTo,
            granularity: query.granularity,
            timeZone: period.timeZone,
          },
          ...buildOwnerAnalytics(
            dates,
            query.granularity,
            rooms,
            cash,
            stays,
            capacity,
            created,
          ),
          roomOptions: query.hotelId
            ? roomOptions.map(({ id, name }) => ({ id, name }))
            : [],
          rating: {
            score: null,
            count: null,
            reason: 'REVIEWS_NOT_IMPLEMENTED',
          },
          limitations: [
            'INVENTORY_USES_CURRENT_STATE',
            'PAY_AT_HOTEL_COLLECTION_UNVERIFIED',
          ],
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
