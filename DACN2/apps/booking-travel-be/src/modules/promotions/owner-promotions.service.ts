import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OwnerPromotion,
  OwnerPromotionStatus,
  PlatformDiscountType,
  Prisma,
  UserRole,
  VoucherRedemptionStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { publicStayDates } from '../rooms/inventory';
import {
  OwnerPromotionActionDto,
  OwnerPromotionInputDto,
  OwnerPromotionListDto,
  OwnerPromotionPreviewDto,
  OwnerPromotionUpdateDto,
} from './owner-promotion.dto';

type Db = PrismaService | Prisma.TransactionClient;
type Rate = { date: string; price: Prisma.Decimal };
type PromotionPricing = Pick<
  OwnerPromotion,
  | 'id'
  | 'title'
  | 'version'
  | 'hotelId'
  | 'status'
  | 'discountType'
  | 'discountValue'
  | 'maxDiscount'
  | 'currency'
  | 'startsAt'
  | 'endsAt'
  | 'stayStart'
  | 'stayEnd'
  | 'roomIds'
  | 'minNights'
  | 'quota'
  | 'reservedCount'
  | 'consumedCount'
>;
type PriceContext = {
  hotelId: string;
  roomId: string;
  currency: string;
  roomCount: number;
  rates: Rate[];
  now?: Date;
};

function fail(code: string, message: string): never {
  throw new ConflictException({ code, message });
}
function date(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException({
      code: 'PROMOTION_INVALID_DATE',
      message: 'Ngày không hợp lệ.',
    });
  return parsed;
}
function decimal(value: string) {
  return new Prisma.Decimal(value);
}

@Injectable()
export class OwnerPromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService = new PricingService(prisma),
  ) {}

  private async ownerHotel(hotelId: string, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.HOTEL_OWNER)
      throw new ForbiddenException('Chỉ chủ khách sạn được quản lý ưu đãi.');
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, ownerId: actor.id, deletedAt: null },
      select: {
        id: true,
        owner: {
          select: {
            isActive: true,
            ownerApplication: { select: { status: true } },
          },
        },
      },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    if (
      !hotel.owner.isActive ||
      hotel.owner.ownerApplication?.status !== 'VERIFIED'
    )
      throw new ForbiddenException('Chủ khách sạn chưa được xác minh.');
    return hotel;
  }

  private async inputData(hotelId: string, input: OwnerPromotionInputDto) {
    if (input.title.trim().length < 2)
      throw new BadRequestException({
        code: 'PROMOTION_INVALID_TITLE',
        message: 'Tên chương trình cần ít nhất 2 ký tự.',
      });
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const stayStart = date(input.stayStart);
    const stayEnd = date(input.stayEnd);
    const discountValue = decimal(input.discountValue);
    const maxDiscount = input.maxDiscount ? decimal(input.maxDiscount) : null;
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt >= endsAt ||
      stayStart >= stayEnd
    )
      throw new BadRequestException({
        code: 'PROMOTION_INVALID_PERIOD',
        message: 'Khoảng thời gian ưu đãi không hợp lệ.',
      });
    if (
      input.currency !== 'VND' ||
      !discountValue.isFinite() ||
      discountValue.lte(0) ||
      (input.discountType === PlatformDiscountType.PERCENT &&
        (discountValue.gt(100) || !maxDiscount)) ||
      (input.discountType === PlatformDiscountType.FIXED &&
        !discountValue.isInteger()) ||
      (maxDiscount && (!maxDiscount.isInteger() || maxDiscount.lte(0)))
    )
      throw new BadRequestException({
        code: 'PROMOTION_INVALID_DISCOUNT',
        message: 'Mức giảm hoặc giới hạn giảm không hợp lệ.',
      });
    const roomIds = [...new Set(input.roomIds)];
    if (roomIds.length !== input.roomIds.length)
      throw new BadRequestException('Danh sách phòng bị trùng.');
    if (roomIds.length) {
      const count = await this.prisma.room.count({
        where: { id: { in: roomIds }, hotelId, deletedAt: null },
      });
      if (count !== roomIds.length)
        throw new BadRequestException({
          code: 'PROMOTION_ROOM_SCOPE_INVALID',
          message: 'Phòng không thuộc khách sạn đã chọn.',
        });
    }
    return {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      discountType: input.discountType,
      discountValue,
      maxDiscount,
      currency: input.currency,
      startsAt,
      endsAt,
      stayStart,
      stayEnd,
      roomIds,
      minNights: input.minNights,
      quota: input.quota,
    };
  }

  private view(p: OwnerPromotion) {
    return {
      ...p,
      discountValue: p.discountValue.toString(),
      maxDiscount: p.maxDiscount?.toString() ?? null,
      remaining: p.quota - p.reservedCount - p.consumedCount,
      effectiveStatus:
        p.status === OwnerPromotionStatus.ACTIVE && p.endsAt <= new Date()
          ? 'EXPIRED'
          : p.status,
    };
  }

  async list(
    hotelId: string,
    query: OwnerPromotionListDto,
    actor: AuthenticatedUser,
  ) {
    await this.ownerHotel(hotelId, actor);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();
    const where: Prisma.OwnerPromotionWhereInput = {
      hotelId,
      ...(query.status === 'EXPIRED'
        ? { status: OwnerPromotionStatus.ACTIVE, endsAt: { lte: now } }
        : query.status === 'ACTIVE'
          ? { status: OwnerPromotionStatus.ACTIVE, endsAt: { gt: now } }
          : query.status
            ? { status: query.status as OwnerPromotionStatus }
            : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.ownerPromotion.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ownerPromotion.count({ where }),
    ]);
    return { items: items.map((item) => this.view(item)), page, limit, total };
  }

  async get(hotelId: string, id: string, actor: AuthenticatedUser) {
    await this.ownerHotel(hotelId, actor);
    const promotion = await this.prisma.ownerPromotion.findFirst({
      where: { id, hotelId },
    });
    if (!promotion) throw new NotFoundException('Không tìm thấy ưu đãi.');
    return this.view(promotion);
  }

  async create(
    hotelId: string,
    input: OwnerPromotionInputDto,
    actor: AuthenticatedUser,
  ) {
    await this.ownerHotel(hotelId, actor);
    const data = await this.inputData(hotelId, input);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.ownerPromotion.create({
        data: { ...data, hotelId, createdById: actor.id },
      });
      await tx.ownerPromotionAudit.create({
        data: {
          promotionId: created.id,
          actorId: actor.id,
          action: 'CREATE',
          after: { version: created.version, status: created.status },
        },
      });
      return this.view(created);
    });
  }

  async update(
    hotelId: string,
    id: string,
    input: OwnerPromotionUpdateDto,
    actor: AuthenticatedUser,
  ) {
    await this.ownerHotel(hotelId, actor);
    const data = await this.inputData(hotelId, input);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OwnerPromotion" WHERE "id" = ${id} AND "hotelId" = ${hotelId} FOR UPDATE`;
      const current = await tx.ownerPromotion.findFirst({
        where: { id, hotelId },
      });
      if (!current) throw new NotFoundException('Không tìm thấy ưu đãi.');
      if (current.version !== input.version)
        fail(
          'PROMOTION_VERSION_CHANGED',
          'Ưu đãi đã được cập nhật. Hãy tải lại.',
        );
      if (
        !(
          [
            OwnerPromotionStatus.DRAFT,
            OwnerPromotionStatus.PAUSED,
          ] as OwnerPromotionStatus[]
        ).includes(current.status) ||
        (await tx.ownerPromotionUsage.count({ where: { promotionId: id } }))
      )
        fail(
          'PROMOTION_NOT_EDITABLE',
          'Chương trình đã có lượt sử dụng hoặc đang hoạt động.',
        );
      const updated = await tx.ownerPromotion.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
      await tx.ownerPromotionAudit.create({
        data: {
          promotionId: id,
          actorId: actor.id,
          action: 'UPDATE',
          before: { version: current.version },
          after: { version: updated.version },
        },
      });
      return this.view(updated);
    });
  }

  async action(
    hotelId: string,
    id: string,
    action: 'activate' | 'pause' | 'end',
    input: OwnerPromotionActionDto,
    actor: AuthenticatedUser,
  ) {
    await this.ownerHotel(hotelId, actor);
    if (
      action !== 'activate' &&
      (!input.reason || input.reason.trim().length < 5)
    )
      throw new BadRequestException('Cần nêu lý do tạm dừng hoặc kết thúc.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OwnerPromotion" WHERE "id" = ${id} AND "hotelId" = ${hotelId} FOR UPDATE`;
      const current = await tx.ownerPromotion.findFirst({
        where: { id, hotelId },
      });
      if (!current) throw new NotFoundException('Không tìm thấy ưu đãi.');
      if (current.version !== input.version)
        fail(
          'PROMOTION_VERSION_CHANGED',
          'Ưu đãi đã được cập nhật. Hãy tải lại.',
        );
      const allowed =
        action === 'activate'
          ? [OwnerPromotionStatus.DRAFT, OwnerPromotionStatus.PAUSED]
          : action === 'pause'
            ? [OwnerPromotionStatus.ACTIVE]
            : [
                OwnerPromotionStatus.DRAFT,
                OwnerPromotionStatus.ACTIVE,
                OwnerPromotionStatus.PAUSED,
              ];
      if (!(allowed as OwnerPromotionStatus[]).includes(current.status))
        fail(
          'PROMOTION_INVALID_TRANSITION',
          'Không thể đổi trạng thái ưu đãi.',
        );
      if (action === 'activate' && current.endsAt <= new Date())
        fail('PROMOTION_EXPIRED', 'Thời gian đặt của ưu đãi đã hết.');
      const status =
        action === 'activate'
          ? OwnerPromotionStatus.ACTIVE
          : action === 'pause'
            ? OwnerPromotionStatus.PAUSED
            : OwnerPromotionStatus.ENDED;
      const updated = await tx.ownerPromotion.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
      await tx.ownerPromotionAudit.create({
        data: {
          promotionId: id,
          actorId: actor.id,
          action: action.toUpperCase(),
          reason: input.reason?.trim(),
          before: { status: current.status, version: current.version },
          after: { status, version: updated.version },
        },
      });
      return this.view(updated);
    });
  }

  async previewDraft(
    hotelId: string,
    input: OwnerPromotionPreviewDto,
    actor: AuthenticatedUser,
  ) {
    await this.ownerHotel(hotelId, actor);
    const data = await this.inputData(hotelId, input);
    const room = await this.prisma.room.findFirst({
      where: { id: input.roomId, hotelId, deletedAt: null },
      select: { id: true, basePrice: true, currency: true },
    });
    if (!room)
      throw new NotFoundException('Không tìm thấy hạng phòng của khách sạn.');
    const dates = publicStayDates(input.checkIn, input.checkOut);
    const rates = await this.pricing.loadRates(
      this.prisma,
      room.id,
      room.basePrice,
      dates,
    );
    const context: PriceContext = {
      hotelId,
      roomId: room.id,
      currency: room.currency,
      roomCount: input.roomCount,
      rates,
      now: data.startsAt,
    };
    const draft: PromotionPricing = {
      ...data,
      id: 'preview',
      hotelId,
      version: 1,
      status: OwnerPromotionStatus.ACTIVE,
      reservedCount: 0,
      consumedCount: 0,
    };
    const priced = this.price(draft, context);
    const subtotal = rates
      .reduce((sum, rate) => sum.add(rate.price), new Prisma.Decimal(0))
      .mul(input.roomCount);
    return {
      currency: room.currency,
      roomSubtotal: subtotal.toString(),
      discount: priced?.discount.toString() ?? '0',
      finalAmount: subtotal.sub(priced?.discount ?? 0).toString(),
      eligibleDates: priced?.eligibleDates ?? [],
      reasonCode: priced ? null : 'PROMOTION_NOT_ELIGIBLE',
      previewAt: data.startsAt.toISOString(),
      nightlyRates: rates.map((rate) => ({
        date: rate.date,
        price: rate.price.toString(),
      })),
    };
  }

  private price(p: PromotionPricing, context: PriceContext) {
    const now = context.now ?? new Date();
    if (
      p.status !== OwnerPromotionStatus.ACTIVE ||
      now < p.startsAt ||
      now >= p.endsAt ||
      p.hotelId !== context.hotelId ||
      p.currency !== context.currency ||
      (p.roomIds.length && !p.roomIds.includes(context.roomId)) ||
      context.rates.length < p.minNights ||
      p.reservedCount + p.consumedCount >= p.quota
    )
      return null;
    const start = p.stayStart.toISOString().slice(0, 10);
    const end = p.stayEnd.toISOString().slice(0, 10);
    const eligible = context.rates.filter(
      (rate) => rate.date >= start && rate.date < end,
    );
    if (!eligible.length) return null;
    const eligibleSubtotal = eligible
      .reduce((sum, rate) => sum.add(rate.price), new Prisma.Decimal(0))
      .mul(context.roomCount);
    const raw =
      p.discountType === PlatformDiscountType.PERCENT
        ? eligibleSubtotal.mul(p.discountValue).div(100)
        : p.discountValue;
    const rounded = raw.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const discount = Prisma.Decimal.min(
      rounded,
      p.maxDiscount ?? rounded,
      eligibleSubtotal,
    );
    const fullSubtotal = context.rates
      .reduce((sum, rate) => sum.add(rate.price), new Prisma.Decimal(0))
      .mul(context.roomCount);
    if (!discount.isFinite() || discount.lte(0) || discount.gte(fullSubtotal))
      return null;
    return {
      promotion: p,
      discount,
      eligibleSubtotal,
      eligibleDates: eligible.map((rate) => rate.date),
    };
  }

  async preview(db: Db, context: PriceContext) {
    if (!context.rates.length) return null;
    const now = context.now ?? new Date();
    const candidates = await db.ownerPromotion.findMany({
      where: {
        hotelId: context.hotelId,
        status: OwnerPromotionStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gt: now },
        stayStart: {
          lte: new Date(
            `${context.rates[context.rates.length - 1].date}T00:00:00Z`,
          ),
        },
        stayEnd: { gt: new Date(`${context.rates[0].date}T00:00:00Z`) },
      },
      orderBy: { id: 'asc' },
    });
    const priced = candidates
      .map((p) => this.price(p, { ...context, now }))
      .filter((v): v is NonNullable<typeof v> => v !== null);
    priced.sort(
      (a, b) =>
        b.discount.comparedTo(a.discount) ||
        a.promotion.id.localeCompare(b.promotion.id),
    );
    return priced[0] ?? null;
  }

  async reserve(
    tx: Prisma.TransactionClient,
    context: PriceContext & {
      promotionId: string;
      version: number;
      expectedDiscount: string;
      bookingId: string;
      reservedUntil: Date | null;
    },
  ) {
    await tx.$queryRaw`SELECT "id" FROM "OwnerPromotion" WHERE "id" = ${context.promotionId} FOR UPDATE`;
    const promotion = await tx.ownerPromotion.findUnique({
      where: { id: context.promotionId },
    });
    const priced = promotion && this.price(promotion, context);
    if (
      !priced ||
      promotion.version !== context.version ||
      !priced.discount.eq(context.expectedDiscount)
    )
      fail(
        'PROMOTION_CHANGED',
        'Ưu đãi đã thay đổi hoặc hết lượt. Hãy lấy báo giá mới.',
      );
    const status = context.reservedUntil
      ? VoucherRedemptionStatus.RESERVED
      : VoucherRedemptionStatus.CONSUMED;
    await tx.ownerPromotionUsage.create({
      data: {
        promotionId: promotion.id,
        bookingId: context.bookingId,
        amount: priced.discount,
        status,
        reservedUntil: context.reservedUntil,
        consumedAt: context.reservedUntil ? null : new Date(),
      },
    });
    await tx.ownerPromotion.update({
      where: { id: promotion.id },
      data:
        status === VoucherRedemptionStatus.RESERVED
          ? { reservedCount: { increment: 1 } }
          : { consumedCount: { increment: 1 } },
    });
    return priced;
  }

  async settle(
    tx: Prisma.TransactionClient,
    bookingId: string,
    target: 'CONSUMED' | 'RELEASED',
  ) {
    const usage = await tx.ownerPromotionUsage.findUnique({
      where: { bookingId },
    });
    if (!usage || usage.status !== VoucherRedemptionStatus.RESERVED) return;
    await tx.$queryRaw`SELECT "id" FROM "OwnerPromotion" WHERE "id" = ${usage.promotionId} FOR UPDATE`;
    const changed = await tx.ownerPromotionUsage.updateMany({
      where: { id: usage.id, status: VoucherRedemptionStatus.RESERVED },
      data:
        target === 'CONSUMED'
          ? { status: VoucherRedemptionStatus.CONSUMED, consumedAt: new Date() }
          : {
              status: VoucherRedemptionStatus.RELEASED,
              releasedAt: new Date(),
            },
    });
    if (!changed.count) return;
    await tx.ownerPromotion.update({
      where: { id: usage.promotionId },
      data: {
        reservedCount: { decrement: 1 },
        ...(target === 'CONSUMED' ? { consumedCount: { increment: 1 } } : {}),
      },
    });
  }
}
