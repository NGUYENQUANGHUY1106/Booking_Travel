import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HotelStatus,
  PlatformDiscountType,
  PlatformVoucherStatus,
  Prisma,
  RoomStatus,
  UserStatus,
  VoucherRedemptionStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { OwnerPromotionsService } from './owner-promotions.service';
import {
  VoucherActionDto,
  VoucherInputDto,
  VoucherListQueryDto,
  VoucherPreviewDto,
  VoucherUpdateDto,
} from './voucher.dto';

type Db = PrismaService | Prisma.TransactionClient;
type Context = {
  code: string;
  userId: string;
  hotelId: string;
  currency: string;
  subtotal: Prisma.Decimal;
  nights: number;
};

function problem(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

function normalized(code: string) {
  return code.trim().toUpperCase();
}

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

@Injectable()
export class PlatformVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerPromotions: OwnerPromotionsService = new OwnerPromotionsService(
      prisma,
    ),
  ) {}

  private async validateInput(input: VoucherInputDto, currentId?: string) {
    const code = normalized(input.code);
    const value = decimal(input.discountValue);
    const cap = input.maxDiscount == null ? null : decimal(input.maxDiscount);
    const minSpend = decimal(input.minSpend);
    const budget = decimal(input.budget);
    if (!/^[A-Z0-9_-]{4,32}$/.test(code))
      problem(
        'VOUCHER_INVALID_CODE',
        'Mã ưu đãi chỉ gồm chữ, số, gạch dưới hoặc gạch ngang.',
      );
    if (
      value.lte(0) ||
      (input.discountType === PlatformDiscountType.PERCENT && value.gt(100)) ||
      (input.discountType === PlatformDiscountType.PERCENT && !cap) ||
      (cap && cap.lte(0)) ||
      (input.discountType === PlatformDiscountType.FIXED &&
        !value.isInteger()) ||
      (cap && !cap.isInteger()) ||
      !minSpend.isInteger() ||
      !budget.isInteger() ||
      minSpend.lt(0) ||
      budget.lte(0)
    )
      problem(
        'VOUCHER_INVALID_AMOUNT',
        'Mức giảm, giới hạn hoặc ngân sách không hợp lệ.',
      );
    if (new Date(input.startsAt).getTime() >= new Date(input.endsAt).getTime())
      problem(
        'VOUCHER_INVALID_DATES',
        'Thời điểm kết thúc phải sau thời điểm bắt đầu.',
      );
    if (input.perUserLimit > input.globalLimit)
      problem(
        'VOUCHER_INVALID_QUOTA',
        'Giới hạn mỗi khách không thể lớn hơn tổng lượt.',
      );
    const hotelIds = [...new Set(input.hotelIds ?? [])];
    const eligibleUserIds = [...new Set(input.eligibleUserIds ?? [])];
    if (
      hotelIds.some((id) => !id.trim()) ||
      eligibleUserIds.some((id) => !id.trim())
    )
      problem(
        'VOUCHER_INVALID_SCOPE',
        'Danh sách khách sạn hoặc khách hàng không hợp lệ.',
      );
    if (hotelIds.length) {
      const count = await this.prisma.hotel.count({
        where: { id: { in: hotelIds }, deletedAt: null },
      });
      if (count !== hotelIds.length)
        problem(
          'VOUCHER_INVALID_SCOPE',
          'Có khách sạn không tồn tại trong phạm vi áp dụng.',
        );
    }
    if (eligibleUserIds.length) {
      const count = await this.prisma.user.count({
        where: { id: { in: eligibleUserIds }, isActive: true },
      });
      if (count !== eligibleUserIds.length)
        problem(
          'VOUCHER_INVALID_AUDIENCE',
          'Có tài khoản không hợp lệ trong danh sách khách.',
        );
    }
    const duplicate = await this.prisma.platformVoucher.findUnique({
      where: { code },
    });
    if (duplicate && duplicate.id !== currentId)
      throw new ConflictException({
        code: 'VOUCHER_CODE_EXISTS',
        message: 'Mã ưu đãi đã tồn tại.',
      });
    return {
      code,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      discountType: input.discountType,
      discountValue: value,
      maxDiscount: cap,
      minSpend,
      budget,
      currency: input.currency,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      minNights: input.minNights,
      globalLimit: input.globalLimit,
      perUserLimit: input.perUserLimit,
      hotelIds,
      eligibleUserIds,
    };
  }

  private summary(voucher: {
    code: string;
    title: string;
    status: PlatformVoucherStatus;
    discountType: PlatformDiscountType;
    discountValue: Prisma.Decimal;
    maxDiscount: Prisma.Decimal | null;
    minSpend: Prisma.Decimal;
    budget: Prisma.Decimal;
    globalLimit: number;
    perUserLimit: number;
    startsAt: Date;
    endsAt: Date;
    hotelIds: string[];
    eligibleUserIds: string[];
    version: number;
  }) {
    return {
      code: voucher.code,
      title: voucher.title,
      status: voucher.status,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue.toString(),
      maxDiscount: voucher.maxDiscount?.toString() ?? null,
      minSpend: voucher.minSpend.toString(),
      budget: voucher.budget.toString(),
      globalLimit: voucher.globalLimit,
      perUserLimit: voucher.perUserLimit,
      startsAt: voucher.startsAt.toISOString(),
      endsAt: voucher.endsAt.toISOString(),
      hotelIds: voucher.hotelIds,
      eligibleUserIds: voucher.eligibleUserIds,
      version: voucher.version,
    };
  }

  async list(query: VoucherListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();
    const exhaustedIds = ['ACTIVE', 'EXHAUSTED'].includes(query.status ?? '')
      ? (
          await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "PlatformVoucher"
          WHERE "status" = 'ACTIVE'::"PlatformVoucherStatus"
            AND "startsAt" <= statement_timestamp()
            AND "endsAt" > statement_timestamp()
            AND (
              "reservedCount" + "consumedCount" >= "globalLimit"
              OR "reservedAmount" + "consumedAmount" >= "budget"
            )
        `
        ).map((row) => row.id)
      : [];
    const statusWhere: Prisma.PlatformVoucherWhereInput =
      query.status === 'SCHEDULED'
        ? { status: PlatformVoucherStatus.ACTIVE, startsAt: { gt: now } }
        : query.status === 'EXPIRED'
          ? { status: PlatformVoucherStatus.ACTIVE, endsAt: { lte: now } }
          : query.status === 'EXHAUSTED'
            ? { id: { in: exhaustedIds } }
            : query.status === 'ACTIVE'
              ? {
                  status: PlatformVoucherStatus.ACTIVE,
                  startsAt: { lte: now },
                  endsAt: { gt: now },
                  id: { notIn: exhaustedIds },
                }
              : query.status
                ? { status: query.status as PlatformVoucherStatus }
                : {};
    const where: Prisma.PlatformVoucherWhereInput = {
      ...(query.search
        ? {
            OR: [
              {
                code: {
                  contains: query.search.trim(),
                  mode: 'insensitive' as const,
                },
              },
              {
                title: {
                  contains: query.search.trim(),
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
      ...statusWhere,
      ...(query.discountType
        ? { discountType: query.discountType as PlatformDiscountType }
        : {}),
      ...(query.scope ? { hotelIds: { isEmpty: query.scope === 'ALL' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.platformVoucher.findMany({
        where,
        orderBy: [
          { updatedAt: query.sort === 'oldest' ? 'asc' : 'desc' },
          { id: query.sort === 'oldest' ? 'asc' : 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
        omit: { eligibleUserIds: true },
      }),
      this.prisma.platformVoucher.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async get(id: string) {
    const voucher = await this.prisma.platformVoucher.findUnique({
      where: { id },
      include: {
        audits: { orderBy: { createdAt: 'desc' }, take: 50 },
        _count: { select: { redemptions: true } },
      },
    });
    if (!voucher) throw new NotFoundException('Không tìm thấy mã ưu đãi.');
    return voucher;
  }

  async redemptions(id: string, page = 1) {
    await this.get(id);
    const limit = 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.voucherRedemption.findMany({
        where: { voucherId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          bookingId: true,
          amount: true,
          currency: true,
          status: true,
          reservedUntil: true,
          createdAt: true,
          consumedAt: true,
          releasedAt: true,
        },
      }),
      this.prisma.voucherRedemption.count({ where: { voucherId: id } }),
    ]);
    return { items, total, page, limit };
  }

  async create(input: VoucherInputDto, actor: AuthenticatedUser) {
    const data = await this.validateInput(input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const voucher = await tx.platformVoucher.create({
          data: { ...data, createdById: actor.id, updatedById: actor.id },
        });
        await tx.platformVoucherAudit.create({
          data: {
            voucherId: voucher.id,
            actorId: actor.id,
            action: 'CREATE',
            reason: 'Tạo bản nháp',
            after: this.summary(voucher),
          },
        });
        return voucher;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException({
          code: 'VOUCHER_CODE_EXISTS',
          message: 'Mã ưu đãi đã tồn tại.',
        });
      throw error;
    }
  }

  async update(id: string, input: VoucherUpdateDto, actor: AuthenticatedUser) {
    const data = await this.validateInput(input, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PlatformVoucher" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.platformVoucher.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Không tìm thấy mã ưu đãi.');
      if (current.version !== input.version)
        throw new ConflictException({
          code: 'VOUCHER_VERSION_CONFLICT',
          message: 'Mã đã thay đổi. Vui lòng tải lại.',
        });
      if (
        !(
          [
            PlatformVoucherStatus.DRAFT,
            PlatformVoucherStatus.PAUSED,
          ] as PlatformVoucherStatus[]
        ).includes(current.status) ||
        current.reservedCount + current.consumedCount > 0 ||
        (await tx.voucherRedemption.count({ where: { voucherId: id } })) > 0
      )
        throw new ConflictException({
          code: 'VOUCHER_IMMUTABLE',
          message:
            'Mã đã sử dụng hoặc đang hoạt động; chỉ có thể tạm dừng hoặc kết thúc.',
        });
      const updated = await tx.platformVoucher.update({
        where: { id },
        data: { ...data, updatedById: actor.id, version: { increment: 1 } },
      });
      await tx.platformVoucherAudit.create({
        data: {
          voucherId: id,
          actorId: actor.id,
          action: 'UPDATE',
          reason: input.reason.trim(),
          before: this.summary(current),
          after: this.summary(updated),
        },
      });
      return updated;
    });
  }

  async action(
    id: string,
    action: 'activate' | 'pause' | 'end',
    input: VoucherActionDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PlatformVoucher" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.platformVoucher.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Không tìm thấy mã ưu đãi.');
      if (current.version !== input.version)
        throw new ConflictException({
          code: 'VOUCHER_VERSION_CONFLICT',
          message: 'Mã đã thay đổi. Vui lòng tải lại.',
        });
      const allowed: PlatformVoucherStatus[] =
        action === 'activate'
          ? [PlatformVoucherStatus.DRAFT, PlatformVoucherStatus.PAUSED]
          : action === 'pause'
            ? [PlatformVoucherStatus.ACTIVE]
            : [
                PlatformVoucherStatus.ACTIVE,
                PlatformVoucherStatus.PAUSED,
                PlatformVoucherStatus.DRAFT,
              ];
      if (!allowed.includes(current.status))
        throw new ConflictException({
          code: 'VOUCHER_INVALID_TRANSITION',
          message: 'Trạng thái hiện tại không cho phép thao tác.',
        });
      if (
        action === 'activate' &&
        (current.endsAt <= new Date() ||
          current.reservedCount + current.consumedCount >=
            current.globalLimit ||
          current.reservedAmount
            .add(current.consumedAmount)
            .gte(current.budget))
      )
        throw new ConflictException({
          code: 'VOUCHER_EXHAUSTED',
          message: 'Mã đã hết hạn hoặc hết nguồn lực.',
        });
      const status =
        action === 'activate'
          ? PlatformVoucherStatus.ACTIVE
          : action === 'pause'
            ? PlatformVoucherStatus.PAUSED
            : PlatformVoucherStatus.ENDED;
      const updated = await tx.platformVoucher.update({
        where: { id },
        data: { status, updatedById: actor.id, version: { increment: 1 } },
      });
      await tx.platformVoucherAudit.create({
        data: {
          voucherId: id,
          actorId: actor.id,
          action: action.toUpperCase(),
          reason: input.reason.trim(),
          before: this.summary(current),
          after: this.summary(updated),
        },
      });
      return updated;
    });
  }

  async previewAdmin(id: string, input: VoucherPreviewDto) {
    const voucher = await this.get(id);
    const [room, user] = await Promise.all([
      this.prisma.room.findFirst({
        where: {
          id: input.roomId,
          status: RoomStatus.ACTIVE,
          deletedAt: null,
          hotel: {
            deletedAt: null,
            status: HotelStatus.APPROVED,
            isVisible: true,
          },
        },
        select: { hotelId: true },
      }),
      this.prisma.user.findFirst({
        where: {
          id: input.userId,
          isActive: true,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      }),
    ]);
    if (!room || !user)
      problem(
        'VOUCHER_PREVIEW_CONTEXT_INVALID',
        'Phòng hoặc khách hàng không hợp lệ.',
      );
    const price = await new PricingService(this.prisma).publicRange(
      input.roomId,
      {
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        roomCount: input.roomCount ?? 1,
      },
    );
    const { discount } = await this.preview(
      this.prisma,
      {
        code: voucher.code,
        userId: user.id,
        hotelId: room.hotelId,
        currency: price.currency,
        subtotal: price.totalAmount,
        nights: price.nights.length,
      },
      { ignoreLifecycle: true },
    );
    return {
      code: voucher.code,
      currency: price.currency,
      roomId: input.roomId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      roomCount: input.roomCount ?? 1,
      subtotal: price.totalAmount.toString(),
      discount: discount.toString(),
      finalAmount: price.totalAmount.sub(discount).toString(),
      note: 'Xem trước không giữ lượt dùng hoặc ngân sách. Trạng thái và thời gian kích hoạt được bỏ qua; lúc đặt phòng sẽ kiểm tra lại.',
    };
  }

  async preview(
    db: Db,
    context: Context,
    options?: { ignoreLifecycle?: boolean },
  ) {
    const voucher = await db.platformVoucher.findUnique({
      where: { code: normalized(context.code) },
    });
    if (!voucher) problem('VOUCHER_INVALID', 'Mã ưu đãi không tồn tại.');
    const now = new Date();
    if (
      !options?.ignoreLifecycle &&
      voucher.status !== PlatformVoucherStatus.ACTIVE
    )
      problem(
        'VOUCHER_INACTIVE',
        'Mã ưu đãi chưa được kích hoạt hoặc đã tạm dừng.',
      );
    if (!options?.ignoreLifecycle && now < voucher.startsAt)
      problem('VOUCHER_SCHEDULED', 'Mã ưu đãi chưa đến thời gian áp dụng.');
    if (!options?.ignoreLifecycle && now >= voucher.endsAt)
      problem('VOUCHER_EXPIRED', 'Mã ưu đãi đã hết hạn.');
    if (voucher.currency !== context.currency)
      problem(
        'VOUCHER_CURRENCY_MISMATCH',
        'Mã ưu đãi không áp dụng cho tiền tệ này.',
      );
    if (voucher.hotelIds.length && !voucher.hotelIds.includes(context.hotelId))
      problem(
        'VOUCHER_HOTEL_INELIGIBLE',
        'Mã ưu đãi không áp dụng cho khách sạn này.',
      );
    if (
      voucher.eligibleUserIds.length &&
      !voucher.eligibleUserIds.includes(context.userId)
    )
      problem(
        'VOUCHER_USER_INELIGIBLE',
        'Tài khoản không thuộc chương trình ưu đãi.',
      );
    if (
      context.nights < voucher.minNights ||
      context.subtotal.lt(voucher.minSpend)
    )
      problem(
        'VOUCHER_MINIMUM_NOT_MET',
        'Chưa đủ số đêm hoặc giá trị đặt phòng tối thiểu.',
      );
    const raw =
      voucher.discountType === PlatformDiscountType.PERCENT
        ? context.subtotal.mul(voucher.discountValue).div(100)
        : voucher.discountValue;
    const discount = Prisma.Decimal.min(
      raw.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP),
      voucher.maxDiscount ??
        raw.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP),
      context.subtotal,
    );
    if (discount.lte(0) || discount.gte(context.subtotal))
      problem(
        'VOUCHER_AMOUNT_NOT_PAYABLE',
        'Mức giảm không phù hợp với tổng tiền đặt phòng.',
      );
    if (
      voucher.reservedCount + voucher.consumedCount >= voucher.globalLimit ||
      voucher.reservedAmount
        .add(voucher.consumedAmount)
        .add(discount)
        .gt(voucher.budget)
    )
      problem('VOUCHER_EXHAUSTED', 'Mã ưu đãi đã hết lượt hoặc ngân sách.');
    const used = await db.voucherRedemption.count({
      where: {
        voucherId: voucher.id,
        userId: context.userId,
        status: {
          in: [
            VoucherRedemptionStatus.RESERVED,
            VoucherRedemptionStatus.CONSUMED,
          ],
        },
      },
    });
    if (used >= voucher.perUserLimit)
      problem('VOUCHER_USER_LIMIT', 'Bạn đã dùng hết lượt cho mã ưu đãi này.');
    return { voucher, discount };
  }

  async reserve(
    tx: Prisma.TransactionClient,
    context: Context & { bookingId: string; reservedUntil: Date | null },
  ) {
    const code = normalized(context.code);
    await tx.$queryRaw`SELECT "id" FROM "PlatformVoucher" WHERE "code" = ${code} FOR UPDATE`;
    const { voucher, discount } = await this.preview(tx, context);
    await tx.voucherRedemption.create({
      data: {
        voucherId: voucher.id,
        bookingId: context.bookingId,
        userId: context.userId,
        amount: discount,
        currency: context.currency,
        status: context.reservedUntil
          ? VoucherRedemptionStatus.RESERVED
          : VoucherRedemptionStatus.CONSUMED,
        reservedUntil: context.reservedUntil,
        consumedAt: context.reservedUntil ? null : new Date(),
      },
    });
    await tx.platformVoucher.update({
      where: { id: voucher.id },
      data: context.reservedUntil
        ? {
            reservedCount: { increment: 1 },
            reservedAmount: { increment: discount },
          }
        : {
            consumedCount: { increment: 1 },
            consumedAmount: { increment: discount },
          },
    });
    return { voucher, discount };
  }

  async settle(
    tx: Prisma.TransactionClient,
    bookingId: string,
    target: 'CONSUMED' | 'RELEASED',
  ) {
    await this.ownerPromotions.settle(tx, bookingId, target);
    const redemption = await tx.voucherRedemption.findUnique({
      where: { bookingId },
    });
    if (!redemption || redemption.status !== VoucherRedemptionStatus.RESERVED)
      return;
    await tx.$queryRaw`SELECT "id" FROM "PlatformVoucher" WHERE "id" = ${redemption.voucherId} FOR UPDATE`;
    const updated = await tx.voucherRedemption.updateMany({
      where: { id: redemption.id, status: VoucherRedemptionStatus.RESERVED },
      data:
        target === 'CONSUMED'
          ? { status: VoucherRedemptionStatus.CONSUMED, consumedAt: new Date() }
          : {
              status: VoucherRedemptionStatus.RELEASED,
              releasedAt: new Date(),
            },
    });
    if (!updated.count) return;
    await tx.platformVoucher.update({
      where: { id: redemption.voucherId },
      data: {
        reservedCount: { decrement: 1 },
        reservedAmount: { decrement: redemption.amount },
        ...(target === 'CONSUMED'
          ? {
              consumedCount: { increment: 1 },
              consumedAmount: { increment: redemption.amount },
            }
          : {}),
      },
    });
  }
}
