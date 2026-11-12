import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HotelStatus,
  Prisma,
  RoomPricingRuleKind,
  RoomStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  inventoryDate,
  loadInventoryDays,
  todayInVietnam,
} from '../rooms/inventory';
import { BasePriceDto, PricingRangeDto, PricingRuleDto } from './pricing.dto';
import {
  findRuleConflict,
  pricingDates,
  resolveNightlyRates,
  ruleApplies,
} from './pricing.domain';

type Db = Prisma.TransactionClient | PrismaService;
type OwnedRoom = Prisma.RoomGetPayload<{
  include: { hotel: { select: { ownerId: true; status: true } } };
}>;

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedRoom(
    db: Db,
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
  ): Promise<OwnedRoom> {
    const room = await db.room.findFirst({
      where: {
        id: roomId,
        hotelId,
        deletedAt: null,
        hotel: { deletedAt: null },
      },
      include: { hotel: { select: { ownerId: true, status: true } } },
    });
    if (!room)
      throw new NotFoundException(
        'Không tìm thấy hạng phòng trong khách sạn này.',
      );
    if (room.hotel.ownerId !== user.id)
      throw new ForbiddenException('Bạn không sở hữu hạng phòng này.');
    return room;
  }

  private assertEditable(room: OwnedRoom) {
    if (
      room.hotel.status === HotelStatus.PENDING ||
      room.hotel.status === HotelStatus.SUSPENDED
    )
      throw new ConflictException(
        'Trạng thái khách sạn chưa cho phép sửa giá.',
      );
  }

  private validPrice(value: string): Prisma.Decimal {
    const price = new Prisma.Decimal(value);
    if (!price.isFinite() || price.lte(0))
      throw new BadRequestException('Giá phòng phải lớn hơn 0.');
    return price;
  }

  private validateRule(input: PricingRuleDto) {
    const dates = pricingDates(input.startDate, input.endDateExclusive);
    if (input.startDate < todayInVietnam())
      throw new BadRequestException('Không thể sửa giá cho ngày đã qua.');
    if (input.kind === RoomPricingRuleKind.HOLIDAY && !input.label?.trim())
      throw new BadRequestException(
        'Ngày lễ cần có tên để Chủ khách sạn nhận biết.',
      );
    const data = {
      kind: input.kind,
      label: input.label?.trim() || null,
      startDate: inventoryDate(input.startDate),
      endDateExclusive: inventoryDate(input.endDateExclusive),
      price: this.validPrice(input.price),
    };
    if (
      !dates.some((date) =>
        ruleApplies({ ...data, id: 'validation', active: true }, date),
      )
    )
      throw new BadRequestException(
        'Khoảng ngày không có đêm phù hợp với loại quy tắc.',
      );
    return data;
  }

  async loadRates(
    db: Db,
    roomId: string,
    basePrice: Prisma.Decimal,
    dates: Date[],
  ) {
    if (!dates.length) return [];
    const start = dates[0];
    const end = new Date(dates[dates.length - 1].getTime() + 86_400_000);
    const rules = await db.roomPricingRule.findMany({
      where: {
        roomId,
        active: true,
        startDate: { lt: end },
        endDateExclusive: { gt: start },
      },
    });
    return resolveNightlyRates(basePrice, dates, rules);
  }

  async month(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    month: string,
  ) {
    const room = await this.ownedRoom(this.prisma, user, hotelId, roomId);
    const [year, monthNumber] = month.split('-').map(Number);
    const end = new Date(Date.UTC(year, monthNumber, 1))
      .toISOString()
      .slice(0, 10);
    const dates = pricingDates(`${month}-01`, end);
    const [rates, inventory, rules] = await Promise.all([
      this.loadRates(this.prisma, roomId, room.basePrice, dates),
      loadInventoryDays(this.prisma, roomId, room.quantity, dates),
      this.prisma.roomPricingRule.findMany({
        where: { roomId, active: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      hotelId,
      roomId,
      roomName: room.name,
      currency: room.currency,
      basePrice: room.basePrice,
      version: room.pricingVersion,
      month,
      rules,
      days: rates.map((rate, index) => ({
        ...rate,
        booked: inventory[index].booked,
        blocked: inventory[index].blocked,
        available: inventory[index].available,
        closedForSale: inventory[index].available <= 0,
      })),
    };
  }

  async publicRange(roomId: string, query: PricingRangeDto) {
    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
        status: RoomStatus.ACTIVE,
        quantity: { gt: 0 },
        hotel: {
          deletedAt: null,
          status: HotelStatus.APPROVED,
          isVisible: true,
        },
      },
      select: { id: true, basePrice: true, currency: true },
    });
    if (!room) throw new NotFoundException('Hạng phòng không còn mở bán.');
    const dates = pricingDates(query.checkIn, query.checkOut);
    const rates = await this.loadRates(
      this.prisma,
      room.id,
      room.basePrice,
      dates,
    );
    const minPricePerNight = rates.reduce(
      (lowest, rate) => (rate.price.lt(lowest) ? rate.price : lowest),
      rates[0].price,
    );
    const total = rates
      .reduce((sum, rate) => sum.add(rate.price), new Prisma.Decimal(0))
      .mul(query.roomCount ?? 1);
    return {
      roomId,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      roomCount: query.roomCount ?? 1,
      currency: room.currency,
      basePrice: room.basePrice,
      minPricePerNight,
      nights: rates,
      totalAmount: total,
    };
  }

  async preview(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    input: PricingRuleDto,
  ) {
    const room = await this.ownedRoom(this.prisma, user, hotelId, roomId);
    this.assertEditable(room);
    if (room.pricingVersion !== input.expectedVersion)
      throw new ConflictException(
        'Giá phòng đã thay đổi. Vui lòng tải lại lịch trước khi xem trước.',
      );
    const data = this.validateRule(input);
    const dates = pricingDates(input.startDate, input.endDateExclusive);
    const existing = await this.prisma.roomPricingRule.findMany({
      where: {
        roomId,
        active: true,
        startDate: { lt: data.endDateExclusive },
        endDateExclusive: { gt: data.startDate },
      },
    });
    const candidate = { ...data, id: input.ruleId ?? 'preview', active: true };
    const conflict = findRuleConflict(candidate, existing);
    if (conflict)
      throw new ConflictException({
        message: `Quy tắc ${conflict.ruleId} đã áp dụng cho ngày ${conflict.date}.`,
        ...conflict,
      });
    const before = resolveNightlyRates(room.basePrice, dates, existing);
    const after = resolveNightlyRates(room.basePrice, dates, [
      ...existing.filter((rule) => rule.id !== input.ruleId),
      candidate,
    ]);
    return {
      roomId,
      version: room.pricingVersion,
      currency: room.currency,
      days: after.map((item, index) => ({
        date: item.date,
        before: before[index].price,
        after: item.price,
        source: item.source,
        changed: !item.price.eq(before[index].price),
      })),
    };
  }

  private async mutate<T extends object>(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    expectedVersion: number,
    action: string,
    apply: (
      tx: Prisma.TransactionClient,
      room: OwnedRoom,
    ) => Promise<{ result: T; before: unknown; after: unknown }>,
  ): Promise<T & { version: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${roomId}))`;
      const room = await this.ownedRoom(tx, user, hotelId, roomId);
      this.assertEditable(room);
      if (room.pricingVersion !== expectedVersion)
        throw new ConflictException(
          'Giá phòng đã được sửa trên thiết bị khác. Vui lòng tải lại trước khi lưu.',
        );
      const applied = await apply(tx, room);
      await tx.room.update({
        where: { id: roomId },
        data: { pricingVersion: { increment: 1 } },
      });
      await tx.roomPricingAudit.create({
        data: {
          roomId,
          actorId: user.id,
          action,
          before: JSON.parse(
            JSON.stringify(applied.before),
          ) as Prisma.InputJsonValue,
          after: JSON.parse(
            JSON.stringify(applied.after),
          ) as Prisma.InputJsonValue,
        },
      });
      return { ...applied.result, version: expectedVersion + 1 };
    });
  }

  async setBase(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    input: BasePriceDto,
  ) {
    const price = this.validPrice(input.price);
    return this.mutate(
      user,
      hotelId,
      roomId,
      input.expectedVersion,
      'BASE_UPDATE',
      async (tx, room) => {
        const updated = await tx.room.update({
          where: { id: roomId },
          data: { basePrice: price, revision: { increment: 1 } },
        });
        return {
          result: { basePrice: updated.basePrice, currency: updated.currency },
          before: { basePrice: room.basePrice },
          after: { basePrice: price },
        };
      },
    );
  }

  async createRule(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    input: PricingRuleDto,
  ) {
    const data = this.validateRule(input);
    return this.mutate(
      user,
      hotelId,
      roomId,
      input.expectedVersion,
      'RULE_CREATE',
      async (tx) => {
        const existing = await tx.roomPricingRule.findMany({
          where: {
            roomId,
            active: true,
            startDate: { lt: data.endDateExclusive },
            endDateExclusive: { gt: data.startDate },
          },
        });
        const conflict = findRuleConflict(
          { ...data, id: 'new', active: true },
          existing,
        );
        if (conflict)
          throw new ConflictException({
            message: `Quy tắc ${conflict.ruleId} đã áp dụng cho ngày ${conflict.date}.`,
            ...conflict,
          });
        const rule = await tx.roomPricingRule.create({
          data: { ...data, roomId, createdById: user.id, updatedById: user.id },
        });
        return { result: { rule }, before: {}, after: rule };
      },
    );
  }

  async updateRule(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    ruleId: string,
    input: PricingRuleDto,
  ) {
    const data = this.validateRule(input);
    return this.mutate(
      user,
      hotelId,
      roomId,
      input.expectedVersion,
      'RULE_UPDATE',
      async (tx) => {
        const previous = await tx.roomPricingRule.findFirst({
          where: { id: ruleId, roomId, active: true },
        });
        if (!previous)
          throw new NotFoundException('Không tìm thấy quy tắc giá.');
        const existing = await tx.roomPricingRule.findMany({
          where: {
            roomId,
            active: true,
            id: { not: ruleId },
            startDate: { lt: data.endDateExclusive },
            endDateExclusive: { gt: data.startDate },
          },
        });
        const conflict = findRuleConflict(
          { ...data, id: ruleId, active: true },
          existing,
        );
        if (conflict)
          throw new ConflictException({
            message: `Quy tắc ${conflict.ruleId} đã áp dụng cho ngày ${conflict.date}.`,
            ...conflict,
          });
        const rule = await tx.roomPricingRule.update({
          where: { id: ruleId },
          data: { ...data, updatedById: user.id },
        });
        return { result: { rule }, before: previous, after: rule };
      },
    );
  }

  async deleteRule(
    user: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    ruleId: string,
    expectedVersion: number,
  ) {
    return this.mutate(
      user,
      hotelId,
      roomId,
      expectedVersion,
      'RULE_DELETE',
      async (tx) => {
        const previous = await tx.roomPricingRule.findFirst({
          where: { id: ruleId, roomId, active: true },
        });
        if (!previous)
          throw new NotFoundException('Không tìm thấy quy tắc giá.');
        const rule = await tx.roomPricingRule.update({
          where: { id: ruleId },
          data: { active: false, updatedById: user.id },
        });
        return { result: { ruleId }, before: previous, after: rule };
      },
    );
  }
}
