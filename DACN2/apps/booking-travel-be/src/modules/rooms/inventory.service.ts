import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  CreateInventoryBlockDto,
  ReleaseInventoryBlockDto,
  SetInventoryOverrideDto,
  UpdateInventoryBlockDto,
} from './dto/inventory.dto';
import {
  inventoryDate,
  inventoryRange,
  loadInventoryDays,
  todayInVietnam,
} from './inventory';

type RoomRecord = {
  id: string;
  hotelId: string;
  quantity: number;
  revision: number;
  name: string;
  hotel: { ownerId: string; status: HotelStatus };
};
type Tx = Prisma.TransactionClient;

function assertFuture(start: string) {
  if (start < todayInVietnam())
    throw new BadRequestException(
      'Không thể thay đổi tồn phòng cho ngày đã qua.',
    );
}

function failIfInsufficient(
  days: { date: string; available: number }[],
  required: number,
) {
  const conflict = days.find((day) => day.available < required);
  if (conflict)
    throw new ConflictException({
      message: `Ngày ${conflict.date} chỉ còn ${conflict.available} phòng trống.`,
      date: conflict.date,
      availableQty: conflict.available,
    });
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedRoom(
    db: Tx | PrismaService,
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
  ): Promise<RoomRecord> {
    const room = await db.room.findFirst({
      where: {
        id: roomId,
        hotelId,
        deletedAt: null,
        hotel: { deletedAt: null },
      },
      select: {
        id: true,
        hotelId: true,
        quantity: true,
        revision: true,
        name: true,
        hotel: { select: { ownerId: true, status: true } },
      },
    });
    if (!room)
      throw new NotFoundException(
        'Không tìm thấy hạng phòng thuộc khách sạn này.',
      );
    if (room.hotel.ownerId !== user.id)
      throw new ForbiddenException('Không có quyền quản lý tồn phòng này.');
    if (room.hotel.status === HotelStatus.SUSPENDED)
      throw new ForbiddenException('Khách sạn đang bị đình chỉ.');
    return room;
  }

  async month(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    month: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const room = await this.ownedRoom(tx, user, hotelId, roomId);
        const [year, monthNumber] = month.split('-').map(Number);
        const start = `${month}-01`;
        const end = new Date(Date.UTC(year, monthNumber, 1))
          .toISOString()
          .slice(0, 10);
        const dates = inventoryRange(start, end);
        const days = await loadInventoryDays(tx, roomId, room.quantity, dates);
        const [blocks, bookings] = await Promise.all([
          tx.roomInventoryBlock.findMany({
            where: {
              roomId,
              active: true,
              startDate: { lt: inventoryDate(end) },
              endDateExclusive: { gt: inventoryDate(start) },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              startDate: true,
              endDateExclusive: true,
              quantity: true,
              reason: true,
              version: true,
            },
          }),
          tx.booking.findMany({
            where: {
              roomId,
              status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'] },
              checkIn: { lt: inventoryDate(end) },
              checkOut: { gt: inventoryDate(start) },
            },
            orderBy: { checkIn: 'asc' },
            select: {
              id: true,
              code: true,
              checkIn: true,
              checkOut: true,
              roomCount: true,
              status: true,
            },
          }),
        ]);
        return {
          hotelId,
          roomId,
          roomName: room.name,
          totalRooms: room.quantity,
          revision: room.revision,
          month,
          days,
          blocks,
          bookings,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async mutate<T extends object>(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    action: string,
    key: string,
    fingerprint: string,
    expectedRevision: number,
    apply: (tx: Tx, room: RoomRecord) => Promise<T>,
  ): Promise<T & { revision: number }> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${roomId}))`;
        const room = await this.ownedRoom(tx, user, hotelId, roomId);
        const prior = await tx.roomInventoryAudit.findUnique({
          where: { idempotencyKey: key },
        });
        if (prior) {
          if (
            prior.actorId !== user.id ||
            prior.roomId !== roomId ||
            prior.action !== action ||
            (prior.before as { fingerprint?: string } | null)?.fingerprint !==
              fingerprint
          )
            throw new ConflictException('Mã yêu cầu đã được sử dụng.');
          return prior.after as T & { revision: number };
        }
        if (room.revision !== expectedRevision)
          throw new ConflictException(
            'Tồn phòng đã thay đổi. Vui lòng tải lại lịch.',
          );
        const result = await apply(tx, room);
        const response = { ...result, revision: room.revision + 1 };
        await tx.room.update({
          where: { id: roomId },
          data: { revision: { increment: 1 } },
        });
        await tx.roomInventoryAudit.create({
          data: {
            roomId,
            hotelId,
            actorId: user.id,
            action,
            idempotencyKey: key,
            before: {
              revision: room.revision,
              fingerprint,
              previous: JSON.parse(
                JSON.stringify(
                  (result as { previous?: unknown }).previous ?? null,
                ),
              ) as Prisma.InputJsonValue,
            },
            after: JSON.parse(
              JSON.stringify(response),
            ) as Prisma.InputJsonValue,
          },
        });
        const event = JSON.stringify({
          hotelId,
          roomId,
          action,
          revision: response.revision,
        });
        await tx.$queryRaw`SELECT 1 AS notified FROM pg_notify('availability_changed', ${event})`;
        if (action === 'ROOM_BLOCKED')
          await tx.$queryRaw`SELECT 1 AS notified FROM pg_notify('room_blocked', ${event})`;
        return response;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 30_000,
      },
    );
  }

  createBlock(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    input: CreateInventoryBlockDto,
  ) {
    const dates = inventoryRange(input.startDate, input.endDateExclusive);
    assertFuture(input.startDate);
    const reason = input.reason.trim();
    if (!reason)
      throw new BadRequestException('Vui lòng nhập lý do chặn phòng.');
    return this.mutate(
      user,
      hotelId,
      roomId,
      'ROOM_BLOCKED',
      input.idempotencyKey,
      JSON.stringify({
        startDate: input.startDate,
        endDateExclusive: input.endDateExclusive,
        quantity: input.quantity,
        reason,
      }),
      input.expectedRevision,
      async (tx, room) => {
        if (input.quantity > room.quantity)
          throw new BadRequestException('Số phòng chặn vượt tổng số phòng.');
        const days = await loadInventoryDays(tx, roomId, room.quantity, dates);
        failIfInsufficient(days, input.quantity);
        const block = await tx.roomInventoryBlock.create({
          data: {
            roomId,
            hotelId,
            actorId: user.id,
            startDate: dates[0],
            endDateExclusive: inventoryDate(input.endDateExclusive),
            quantity: input.quantity,
            reason,
            idempotencyKey: input.idempotencyKey,
          },
        });
        return {
          blockId: block.id,
          startDate: input.startDate,
          endDateExclusive: input.endDateExclusive,
          quantity: input.quantity,
          reason,
          previous: { quantity: 0 },
        };
      },
    );
  }

  updateBlock(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    blockId: string,
    input: UpdateInventoryBlockDto,
  ) {
    const dates = inventoryRange(input.startDate, input.endDateExclusive);
    assertFuture(input.startDate);
    const reason = input.reason.trim();
    if (!reason)
      throw new BadRequestException('Vui lòng nhập lý do chặn phòng.');
    return this.mutate(
      user,
      hotelId,
      roomId,
      'ROOM_BLOCK_UPDATED',
      input.idempotencyKey,
      JSON.stringify({
        blockId,
        startDate: input.startDate,
        endDateExclusive: input.endDateExclusive,
        quantity: input.quantity,
        reason,
      }),
      input.expectedRevision,
      async (tx, room) => {
        const block = await tx.roomInventoryBlock.findFirst({
          where: { id: blockId, roomId, hotelId, active: true },
        });
        if (!block)
          throw new NotFoundException('Không tìm thấy khoảng ngày bị chặn.');
        if (block.version !== input.expectedVersion)
          throw new ConflictException('Khoảng chặn đã thay đổi.');
        if (block.startDate.toISOString().slice(0, 10) < todayInVietnam())
          throw new ConflictException(
            'Không thể sửa khoảng chặn đã bắt đầu trong quá khứ.',
          );
        if (input.quantity > room.quantity)
          throw new BadRequestException('Số phòng chặn vượt tổng số phòng.');
        const days = await loadInventoryDays(tx, roomId, room.quantity, dates);
        failIfInsufficient(
          days.map((day) => ({
            date: day.date,
            available:
              day.available +
              (block.startDate <= inventoryDate(day.date) &&
              inventoryDate(day.date) < block.endDateExclusive
                ? block.quantity
                : 0),
          })),
          input.quantity,
        );
        await tx.roomInventoryBlock.update({
          where: { id: blockId },
          data: {
            startDate: dates[0],
            endDateExclusive: inventoryDate(input.endDateExclusive),
            quantity: input.quantity,
            reason,
            version: { increment: 1 },
          },
        });
        return {
          blockId,
          startDate: input.startDate,
          endDateExclusive: input.endDateExclusive,
          quantity: input.quantity,
          reason,
          version: block.version + 1,
          previous: {
            startDate: block.startDate,
            endDateExclusive: block.endDateExclusive,
            quantity: block.quantity,
            reason: block.reason,
            version: block.version,
          },
        };
      },
    );
  }

  releaseBlock(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    blockId: string,
    input: ReleaseInventoryBlockDto,
  ) {
    return this.mutate(
      user,
      hotelId,
      roomId,
      'ROOM_BLOCK_RELEASED',
      input.idempotencyKey,
      JSON.stringify({ blockId, expectedVersion: input.expectedVersion }),
      input.expectedRevision,
      async (tx) => {
        const block = await tx.roomInventoryBlock.findFirst({
          where: { id: blockId, roomId, hotelId, active: true },
        });
        if (!block)
          throw new NotFoundException('Không tìm thấy khoảng ngày bị chặn.');
        if (block.version !== input.expectedVersion)
          throw new ConflictException('Khoảng chặn đã thay đổi.');
        if (block.startDate.toISOString().slice(0, 10) < todayInVietnam())
          throw new ConflictException(
            'Không thể bỏ chặn khoảng đã bắt đầu trong quá khứ.',
          );
        await tx.roomInventoryBlock.update({
          where: { id: blockId },
          data: {
            active: false,
            releasedAt: new Date(),
            version: { increment: 1 },
          },
        });
        return {
          blockId,
          released: true,
          previous: {
            startDate: block.startDate,
            endDateExclusive: block.endDateExclusive,
            quantity: block.quantity,
            reason: block.reason,
            version: block.version,
          },
        };
      },
    );
  }

  setOverride(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    input: SetInventoryOverrideDto,
  ) {
    const dates = inventoryRange(input.startDate, input.endDateExclusive);
    assertFuture(input.startDate);
    if (!Object.prototype.hasOwnProperty.call(input, 'sellableQty'))
      throw new BadRequestException(
        'Thiếu số phòng được bán; dùng null để bỏ giới hạn.',
      );
    return this.mutate(
      user,
      hotelId,
      roomId,
      'ROOM_CAPACITY_OVERRIDE',
      input.idempotencyKey,
      JSON.stringify({
        startDate: input.startDate,
        endDateExclusive: input.endDateExclusive,
        sellableQty: input.sellableQty,
      }),
      input.expectedRevision,
      async (tx, room) => {
        if (
          input.sellableQty !== null &&
          input.sellableQty !== undefined &&
          input.sellableQty > room.quantity
        )
          throw new BadRequestException(
            'Số phòng được bán không thể vượt tổng số phòng.',
          );
        const days = await loadInventoryDays(tx, roomId, room.quantity, dates);
        const sellableQty = input.sellableQty;
        if (sellableQty !== null && sellableQty !== undefined) {
          const conflict = days.find(
            (day) => day.booked + day.blocked > sellableQty,
          );
          if (conflict)
            throw new ConflictException({
              message: `Ngày ${conflict.date} đã có ${conflict.booked + conflict.blocked} phòng được giữ/chặn.`,
              date: conflict.date,
              committedQty: conflict.booked + conflict.blocked,
            });
        }
        await tx.roomInventoryOverride.deleteMany({
          where: {
            roomId,
            date: { gte: dates[0], lt: inventoryDate(input.endDateExclusive) },
          },
        });
        if (sellableQty !== null && sellableQty !== undefined)
          await tx.roomInventoryOverride.createMany({
            data: dates.map((date) => ({ roomId, date, sellableQty })),
          });
        return {
          startDate: input.startDate,
          endDateExclusive: input.endDateExclusive,
          sellableQty: input.sellableQty ?? null,
          affectedDays: dates.length,
          previous: days.map((day) => ({
            date: day.date,
            sellableQty: day.sellableOverride,
          })),
        };
      },
    );
  }
}
