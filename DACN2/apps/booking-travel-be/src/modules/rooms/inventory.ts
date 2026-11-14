import { BadRequestException, Logger } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export const COMMITTED_BOOKING_STATUSES = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];
const DAY_MS = 86_400_000;
const inventoryLogger = new Logger('RoomInventory');

export function inventoryDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('Ngày phải có dạng YYYY-MM-DD.');
  const result = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(result.getTime()) ||
    result.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Ngày không hợp lệ.');
  return result;
}

export function inventoryRange(start: string, endExclusive: string): Date[] {
  const from = inventoryDate(start).getTime();
  const to = inventoryDate(endExclusive).getTime();
  const count = (to - from) / DAY_MS;
  if (!Number.isInteger(count) || count < 1 || count > 366)
    throw new BadRequestException(
      'Khoảng ngày phải từ 1 đến 366 đêm và ngày kết thúc không được tính.',
    );
  return Array.from(
    { length: count },
    (_, index) => new Date(from + index * DAY_MS),
  );
}

export function todayInVietnam(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: 'year' | 'month' | 'day') =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function publicStayDates(checkIn: string, checkOut: string): Date[] {
  const dates = inventoryRange(checkIn, checkOut);
  if (checkIn < todayInVietnam())
    throw new BadRequestException(
      'Ngày nhận phòng không được ở trong quá khứ.',
    );
  return dates;
}

export type InventoryDay = {
  date: string;
  totalRooms: number;
  effectiveCapacity: number;
  sellableOverride: number | null;
  booked: number;
  blocked: number;
  available: number;
  oversold: boolean;
};

type Reservation = { checkIn: Date; checkOut: Date; roomCount: number };
type Block = { startDate: Date; endDateExclusive: Date; quantity: number };
type Override = { date: Date; sellableQty: number };

function groupByRoom<T extends { roomId: string }>(
  items: T[],
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const group = result.get(item.roomId) ?? [];
    group.push(item);
    result.set(item.roomId, group);
  }
  return result;
}

export function calculateInventoryDays(
  dates: Date[],
  totalRooms: number,
  bookings: Reservation[],
  blocks: Block[],
  overrides: Override[],
): InventoryDay[] {
  const byDate = new Map(
    overrides.map((item) => [
      item.date.toISOString().slice(0, 10),
      item.sellableQty,
    ]),
  );
  return dates.map((date) => {
    const at = date.getTime();
    const booked = bookings.reduce(
      (sum, item) =>
        sum +
        (item.checkIn.getTime() <= at && at < item.checkOut.getTime()
          ? item.roomCount
          : 0),
      0,
    );
    const blocked = blocks.reduce(
      (sum, item) =>
        sum +
        (item.startDate.getTime() <= at && at < item.endDateExclusive.getTime()
          ? item.quantity
          : 0),
      0,
    );
    const sellableOverride =
      byDate.get(date.toISOString().slice(0, 10)) ?? null;
    const effectiveCapacity = Math.min(
      totalRooms,
      sellableOverride ?? totalRooms,
    );
    const remaining = effectiveCapacity - booked - blocked;
    return {
      date: date.toISOString().slice(0, 10),
      totalRooms,
      effectiveCapacity,
      sellableOverride,
      booked,
      blocked,
      available: Math.max(0, remaining),
      oversold: remaining < 0,
    };
  });
}

export async function loadInventoryForRooms(
  db: Prisma.TransactionClient | PrismaService,
  rooms: { id: string; quantity: number }[],
  dates: Date[],
): Promise<Map<string, InventoryDay[]>> {
  const result = new Map<string, InventoryDay[]>();
  if (!rooms.length || !dates.length) return result;
  const roomIds = rooms.map((room) => room.id);
  const start = dates[0];
  const end = new Date(dates[dates.length - 1].getTime() + DAY_MS);
  const [bookings, blocks, overrides] = await Promise.all([
    db.booking.findMany({
      where: {
        roomId: { in: roomIds },
        OR: [
          {
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
          },
          {
            status: BookingStatus.PENDING_PAYMENT,
            OR: [
              { paymentDeadline: null },
              { paymentDeadline: { gt: new Date() } },
            ],
          },
        ],
        checkIn: { lt: end },
        checkOut: { gt: start },
      },
      select: { roomId: true, checkIn: true, checkOut: true, roomCount: true },
    }),
    db.roomInventoryBlock.findMany({
      where: {
        roomId: { in: roomIds },
        active: true,
        startDate: { lt: end },
        endDateExclusive: { gt: start },
      },
      select: {
        roomId: true,
        startDate: true,
        endDateExclusive: true,
        quantity: true,
      },
    }),
    db.roomInventoryOverride.findMany({
      where: { roomId: { in: roomIds }, date: { gte: start, lt: end } },
      select: { roomId: true, date: true, sellableQty: true },
    }),
  ]);
  const bookingsByRoom = groupByRoom(bookings);
  const blocksByRoom = groupByRoom(blocks);
  const overridesByRoom = groupByRoom(overrides);
  for (const room of rooms) {
    const days = calculateInventoryDays(
      dates,
      room.quantity,
      bookingsByRoom.get(room.id) ?? [],
      blocksByRoom.get(room.id) ?? [],
      overridesByRoom.get(room.id) ?? [],
    );
    result.set(room.id, days);
    if (days.some((day) => day.oversold))
      inventoryLogger.warn(`Inconsistent room inventory for room ${room.id}`);
  }
  return result;
}

export async function loadInventoryDays(
  db: Prisma.TransactionClient | PrismaService,
  roomId: string,
  totalRooms: number,
  dates: Date[],
): Promise<InventoryDay[]> {
  if (!dates.length) return [];
  const start = dates[0];
  const end = new Date(dates[dates.length - 1].getTime() + DAY_MS);
  const [bookings, blocks, overrides] = await Promise.all([
    db.booking.findMany({
      where: {
        roomId,
        OR: [
          {
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
          },
          {
            status: BookingStatus.PENDING_PAYMENT,
            OR: [
              { paymentDeadline: null },
              { paymentDeadline: { gt: new Date() } },
            ],
          },
        ],
        checkIn: { lt: end },
        checkOut: { gt: start },
      },
      select: { checkIn: true, checkOut: true, roomCount: true },
    }),
    db.roomInventoryBlock.findMany({
      where: {
        roomId,
        active: true,
        startDate: { lt: end },
        endDateExclusive: { gt: start },
      },
      select: { startDate: true, endDateExclusive: true, quantity: true },
    }),
    db.roomInventoryOverride.findMany({
      where: { roomId, date: { gte: start, lt: end } },
      select: { date: true, sellableQty: true },
    }),
  ]);
  const days = calculateInventoryDays(
    dates,
    totalRooms,
    bookings,
    blocks,
    overrides,
  );
  if (days.some((day) => day.oversold))
    inventoryLogger.warn(`Inconsistent room inventory for room ${roomId}`);
  return days;
}

export function minimumAvailable(days: InventoryDay[]): number {
  return Math.min(...days.map((day) => day.available));
}
