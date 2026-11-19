import { randomUUID } from 'node:crypto';
import {
  BookingPaymentMethod,
  PlatformDiscountType,
  PlatformVoucherStatus,
  Prisma,
  UserRole,
  VoucherRedemptionStatus,
} from '@prisma/client';
import type { AuditService } from '../src/common/authorization/audit.service';
import type { AuthorizationService } from '../src/common/authorization/authorization.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { BookingQuoteToken } from '../src/modules/bookings/booking-quote-token';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { PlatformVouchersService } from '../src/modules/promotions/platform-vouchers.service';

describe('ST-ADM-09 real database voucher checkout', () => {
  const prisma = new PrismaService();
  const vouchers = new PlatformVouchersService(prisma);
  const bookings = new BookingsService(
    prisma,
    {} as AuthorizationService,
    {} as AuditService,
    new PricingService(prisma),
    new BookingQuoteToken(),
    vouchers,
  );
  const code = `IT_${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  const voucherIds: string[] = [];
  let voucherId = '';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    for (const id of voucherIds) {
      const redemptions = await prisma.voucherRedemption.findMany({
        where: { voucherId: id },
        select: { bookingId: true },
      });
      await prisma.voucherRedemption.deleteMany({ where: { voucherId: id } });
      await prisma.booking.deleteMany({
        where: { id: { in: redemptions.map((row) => row.bookingId) } },
      });
      await prisma.platformVoucherAudit.deleteMany({
        where: { voucherId: id },
      });
      await prisma.platformVoucher.delete({ where: { id } });
    }
    await prisma.$disconnect();
  });

  it('lets one of two concurrent checkouts consume the only budget and quota slot', async () => {
    const room = await prisma.room.findUnique({
      where: { id: 'seed-room-deluxe-sea-view' },
      include: { hotel: true },
    });
    const users = await prisma.user.findMany({
      where: {
        id: { in: ['seed-user-traveler', 'seed-user-traveler-b'] },
        isActive: true,
      },
      select: { id: true, email: true, fullName: true },
    });
    expect(room?.hotel.status).toBe('APPROVED');
    expect(room?.hotel.isVisible).toBe(true);
    expect(users).toHaveLength(2);
    if (!room || users.length !== 2)
      throw new Error('Run prisma:seed before this integration test.');

    const inDate = new Date(Date.now() + 90 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const outDate = new Date(Date.now() + 92 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const voucher = await prisma.platformVoucher.create({
      data: {
        code,
        title: 'Kiểm thử đồng thời',
        status: PlatformVoucherStatus.ACTIVE,
        discountType: PlatformDiscountType.FIXED,
        discountValue: new Prisma.Decimal(100000),
        minSpend: new Prisma.Decimal(0),
        minNights: 1,
        currency: 'VND',
        startsAt: new Date(Date.now() - 86_400_000),
        endsAt: new Date(Date.now() + 30 * 86_400_000),
        globalLimit: 1,
        perUserLimit: 1,
        budget: new Prisma.Decimal(100000),
        createdById: 'seed-user-admin',
        updatedById: 'seed-user-admin',
      },
    });
    voucherId = voucher.id;
    voucherIds.push(voucher.id);
    const inputs = await Promise.all(
      users.map(async (user, index) => {
        const actor = {
          id: user.id,
          role: UserRole.USER,
          permissions: [],
          sessionId: `integration-${index}`,
        };
        const quote = await bookings.quote(
          {
            roomId: room.id,
            checkIn: inDate,
            checkOut: outDate,
            adults: 1,
            roomCount: 1,
            voucherCode: code,
          },
          actor,
        );
        return { actor, quote, user };
      }),
    );
    const outcomes = await Promise.allSettled(
      inputs.map(({ actor, quote, user }) =>
        bookings.create(actor, {
          quoteId: quote.quoteId,
          roomId: room.id,
          checkIn: inDate,
          checkOut: outDate,
          adults: 1,
          roomCount: 1,
          guestName: user.fullName || 'Khách kiểm thử',
          guestEmail: user.email || `integration-${user.id}@example.com`,
          paymentMethod: BookingPaymentMethod.PAY_AT_HOTEL,
        }),
      ),
    );
    const successful = outcomes.filter(
      (result) => result.status === 'fulfilled',
    );
    const rejected = outcomes.filter((result) => result.status === 'rejected');
    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const booking =
      successful[0].status === 'fulfilled' ? successful[0].value : null;
    expect(booking).not.toBeNull();
    expect(booking?.totalAmount.toString()).toBe(
      new Prisma.Decimal(inputs[0].quote.roomSubtotal).sub(100000).toString(),
    );
    expect(booking?.voucherSnapshot).toMatchObject({
      source: 'PLATFORM',
      code,
      discountAmount: '100000',
    });
    const ledger = await prisma.voucherRedemption.findMany({
      where: { voucherId },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].status).toBe(VoucherRedemptionStatus.CONSUMED);
    const saved = await prisma.platformVoucher.findUniqueOrThrow({
      where: { id: voucherId },
    });
    expect(saved.reservedCount).toBe(0);
    expect(saved.consumedCount).toBe(1);
    expect(saved.consumedAmount.toString()).toBe('100000');
    expect(saved.reservedAmount.toString()).toBe('0');
  });

  it('persists the admin lifecycle, audit and a read-only draft preview', async () => {
    const actor = {
      id: 'seed-user-admin',
      role: UserRole.ADMIN,
      permissions: ['PROMOTION_MANAGEMENT'],
      sessionId: 'integration-admin',
    };
    const inDate = new Date(Date.now() + 90 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const outDate = new Date(Date.now() + 92 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const created = await vouchers.create(
      {
        code: `${code}_B`,
        title: 'Kiểm tra vòng đời',
        discountType: PlatformDiscountType.FIXED,
        discountValue: '100000',
        minSpend: '0',
        minNights: 1,
        currency: 'VND',
        startsAt: new Date(Date.now() - 86_400_000).toISOString(),
        endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        globalLimit: 2,
        perUserLimit: 1,
        budget: '200000',
      },
      actor,
    );
    voucherIds.push(created.id);
    const preview = await vouchers.previewAdmin(created.id, {
      roomId: 'seed-room-deluxe-sea-view',
      userId: 'seed-user-traveler',
      checkIn: inDate,
      checkOut: outDate,
      roomCount: 1,
    });
    expect(preview.discount).toBe('100000');
    expect(
      new Prisma.Decimal(preview.subtotal).sub(preview.discount).toString(),
    ).toBe(preview.finalAmount);
    expect(
      await prisma.voucherRedemption.count({
        where: { voucherId: created.id },
      }),
    ).toBe(0);
    const edited = await vouchers.update(
      created.id,
      {
        code: created.code,
        title: 'Kiểm tra vòng đời đã sửa',
        discountType: PlatformDiscountType.FIXED,
        discountValue: '100000',
        minSpend: '0',
        minNights: 1,
        currency: 'VND',
        startsAt: created.startsAt.toISOString(),
        endsAt: created.endsAt.toISOString(),
        globalLimit: 2,
        perUserLimit: 1,
        budget: '200000',
        version: created.version,
        reason: 'Chỉnh tên trước khi chạy',
      },
      actor,
    );
    const active = await vouchers.action(
      created.id,
      'activate',
      {
        version: edited.version,
        reason: 'Đã kiểm tra ngân sách',
      },
      actor,
    );
    const paused = await vouchers.action(
      created.id,
      'pause',
      {
        version: active.version,
        reason: 'Dừng để kiểm tra',
      },
      actor,
    );
    const ended = await vouchers.action(
      created.id,
      'end',
      {
        version: paused.version,
        reason: 'Kết thúc thử nghiệm',
      },
      actor,
    );
    expect(ended.status).toBe(PlatformVoucherStatus.ENDED);
    const audits = await prisma.platformVoucherAudit.findMany({
      where: { voucherId: created.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits.map((audit) => audit.action)).toEqual([
      'CREATE',
      'UPDATE',
      'ACTIVATE',
      'PAUSE',
      'END',
    ]);
    expect(
      audits.every(
        (audit) => audit.actorId === actor.id && audit.reason.length > 0,
      ),
    ).toBe(true);
    expect(audits[1].before).toMatchObject({ title: 'Kiểm tra vòng đời' });
    expect(audits[1].after).toMatchObject({
      title: 'Kiểm tra vòng đời đã sửa',
    });
  });
});
