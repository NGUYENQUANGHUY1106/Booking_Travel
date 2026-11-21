import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingPaymentMethod,
  BookingStatus,
  PaymentStatus,
  Prisma,
  RefundRequestStatus,
  UserRole,
} from '@prisma/client';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingQrToken } from './booking-qr-token';
import {
  CheckInOwnerStayDto,
  CheckOutOwnerStayDto,
  VerifyOwnerStayDto,
} from './dto/owner-stay.dto';
import { OwnerBookingsService } from './owner-bookings.service';
import { stayDatePolicy } from './stay-date-policy';

type Method = 'QR' | 'CODE';
type Action = 'CHECK_IN' | 'CHECK_OUT';

const STAY_SELECT = {
  id: true,
  code: true,
  userId: true,
  hotelId: true,
  status: true,
  checkIn: true,
  checkOut: true,
  checkInTimeSnapshot: true,
  checkOutTimeSnapshot: true,
  paymentMethod: true,
  actualCheckInAt: true,
  actualCheckOutAt: true,
  hotel: { select: { ownerId: true, checkInTime: true, checkOutTime: true } },
  payments: { select: { status: true, reconciliationRequired: true } },
  refundRequests: { select: { status: true } },
} satisfies Prisma.BookingSelect;

type StayBooking = Prisma.BookingGetPayload<{ select: typeof STAY_SELECT }>;

@Injectable()
export class OwnerStayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: BookingQrToken,
    private readonly ownerBookings: OwnerBookingsService,
  ) {}

  async verify(user: AuthenticatedUser, input: VerifyOwnerStayDto) {
    this.assertOwner(user);
    const lookup = this.lookup(input);
    const booking = await this.prisma.booking.findFirst({
      where: { ...lookup.where, hotel: { ownerId: user.id } },
      select: STAY_SELECT,
    });
    if (!booking || !this.matchesQr(booking, lookup))
      throw new NotFoundException(
        'Không tìm thấy booking hợp lệ của khách sạn bạn sở hữu.',
      );
    const eligibility = this.eligibility(booking, 'CHECK_IN', new Date());
    return {
      booking: await this.ownerBookings.detail(user, booking.id),
      eligibility,
      verificationRef: eligibility.eligible
        ? this.issueRef(user.id, booking.id, lookup.method, lookup.proof)
        : null,
      verificationExpiresInSeconds: eligibility.eligible ? 300 : null,
      verificationMethod: lookup.method,
    };
  }

  async previewCheckOut(user: AuthenticatedUser, id: string) {
    this.assertOwner(user);
    const booking = await this.prisma.booking.findFirst({
      where: { id, hotel: { ownerId: user.id } },
      select: STAY_SELECT,
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');
    return {
      booking: await this.ownerBookings.detail(user, id),
      eligibility: this.eligibility(booking, 'CHECK_OUT', new Date()),
    };
  }

  async checkIn(
    user: AuthenticatedUser,
    id: string,
    input: CheckInOwnerStayDto,
  ) {
    this.assertOwner(user);
    const replay = await this.replay(
      user,
      id,
      'CHECK_IN',
      input.idempotencyKey,
    );
    if (replay)
      return { ...replay, booking: await this.ownerBookings.detail(user, id) };
    const lookup = this.lookup(input);
    this.verifyRef(
      input.verificationRef,
      user.id,
      id,
      lookup.method,
      lookup.proof,
    );
    const result = await this.transition(
      user,
      id,
      'CHECK_IN',
      input.idempotencyKey,
      lookup,
      input.verificationRef,
    );
    return { ...result, booking: await this.ownerBookings.detail(user, id) };
  }

  async checkOut(
    user: AuthenticatedUser,
    id: string,
    input: CheckOutOwnerStayDto,
  ) {
    this.assertOwner(user);
    const replay = await this.replay(
      user,
      id,
      'CHECK_OUT',
      input.idempotencyKey,
    );
    if (replay)
      return { ...replay, booking: await this.ownerBookings.detail(user, id) };
    const result = await this.transition(
      user,
      id,
      'CHECK_OUT',
      input.idempotencyKey,
    );
    return { ...result, booking: await this.ownerBookings.detail(user, id) };
  }

  private async replay(
    user: AuthenticatedUser,
    id: string,
    action: Action,
    idempotencyKey: string,
  ) {
    const owned = await this.prisma.booking.findFirst({
      where: { id, hotel: { ownerId: user.id } },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Không tìm thấy booking.');
    const previous = await this.prisma.bookingStayTransition.findUnique({
      where: { actorId_idempotencyKey: { actorId: user.id, idempotencyKey } },
    });
    if (!previous) return null;
    if (previous.bookingId !== id || previous.action !== action) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Mã yêu cầu đã được dùng cho thao tác khác.',
      });
    }
    return {
      replayed: true,
      happenedAt: previous.happenedAt,
      status: previous.newStatus,
    };
  }

  private async transition(
    user: AuthenticatedUser,
    id: string,
    action: Action,
    idempotencyKey: string,
    lookup?: ReturnType<OwnerStayService['lookup']>,
    verificationRef?: string,
  ) {
    const owned = await this.prisma.booking.findFirst({
      where: { id, hotel: { ownerId: user.id } },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Không tìm thấy booking.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${id} FOR UPDATE`;
      const booking = await tx.booking.findFirst({
        where: { id, hotel: { ownerId: user.id } },
        select: STAY_SELECT,
      });
      if (!booking) throw new NotFoundException('Không tìm thấy booking.');

      const previous = await tx.bookingStayTransition.findUnique({
        where: { actorId_idempotencyKey: { actorId: user.id, idempotencyKey } },
      });
      if (previous) {
        if (previous.bookingId !== id || previous.action !== action) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'Mã yêu cầu đã được dùng cho thao tác khác.',
          });
        }
        return {
          replayed: true,
          happenedAt: previous.happenedAt,
          status: previous.newStatus,
        };
      }

      if (lookup && verificationRef)
        this.verifyRef(
          verificationRef,
          user.id,
          id,
          lookup.method,
          lookup.proof,
        );
      if (lookup?.method === 'QR') this.qr.verify(lookup.proof);
      if (lookup && !this.matchesQr(booking, lookup)) {
        throw new ConflictException({
          code: 'STAY_VERIFICATION_STALE',
          message: 'Mã nhận phòng không còn khớp với booking.',
        });
      }
      const [{ now }] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT statement_timestamp() AS now`;
      const eligibility = this.eligibility(booking, action, now);
      if (!eligibility.eligible) {
        throw new ConflictException({
          code: eligibility.code,
          message: eligibility.message,
        });
      }
      const nextStatus =
        action === 'CHECK_IN'
          ? BookingStatus.CHECKED_IN
          : BookingStatus.COMPLETED;
      const expected =
        action === 'CHECK_IN'
          ? BookingStatus.CONFIRMED
          : BookingStatus.CHECKED_IN;
      const changed = await tx.booking.updateMany({
        where: { id, status: expected, hotel: { ownerId: user.id } },
        data:
          action === 'CHECK_IN'
            ? {
                status: nextStatus,
                actualCheckInAt: now,
                checkedInById: user.id,
              }
            : {
                status: nextStatus,
                actualCheckOutAt: now,
                checkedOutById: user.id,
              },
      });
      if (changed.count !== 1)
        throw new ConflictException({
          code: 'BOOKING_STATE_CHANGED',
          message: 'Booking vừa thay đổi. Vui lòng tải lại.',
        });

      const eventType =
        action === 'CHECK_IN' ? 'BOOKING_CHECKED_IN' : 'BOOKING_COMPLETED';
      const transition = await tx.bookingStayTransition.create({
        data: {
          id: randomUUID(),
          bookingId: id,
          hotelId: booking.hotelId,
          actorId: user.id,
          action,
          previousStatus: expected,
          newStatus: nextStatus,
          verificationMethod: lookup?.method ?? 'BOOKING_DETAIL',
          idempotencyKey,
          happenedAt: now,
          eventType,
          correlationId: idempotencyKey,
        },
      });
      const notification = JSON.stringify({
        eventId: transition.id,
        eventType,
        bookingId: id,
      });
      await tx.$queryRaw`SELECT 1 AS notified FROM pg_notify('booking_stay_changed', ${notification})`;
      return { replayed: false, happenedAt: now, status: nextStatus };
    });
  }

  private eligibility(booking: StayBooking, action: Action, now: Date) {
    const expected =
      action === 'CHECK_IN'
        ? BookingStatus.CONFIRMED
        : BookingStatus.CHECKED_IN;
    if (booking.status !== expected) {
      return {
        eligible: false,
        code: 'BOOKING_STATE_INVALID',
        message:
          action === 'CHECK_IN'
            ? 'Chỉ booking đã xác nhận mới được nhận phòng.'
            : 'Chỉ booking đã nhận phòng mới được trả phòng.',
      };
    }
    if (
      booking.refundRequests.some(
        (refund) => refund.status !== RefundRequestStatus.REJECTED,
      ) ||
      booking.payments.some(
        (payment) =>
          payment.reconciliationRequired ||
          payment.status === PaymentStatus.REFUNDED ||
          payment.status === PaymentStatus.PARTIALLY_REFUNDED,
      )
    ) {
      return {
        eligible: false,
        code: 'BOOKING_REFUND_CONFLICT',
        message:
          'Booking đang có hoàn tiền hoặc đối soát. Vui lòng xử lý trước.',
      };
    }
    if (
      booking.paymentMethod !== BookingPaymentMethod.PAY_AT_HOTEL &&
      !booking.payments.some(
        (payment) =>
          payment.status === PaymentStatus.PAID ||
          payment.status === PaymentStatus.SUCCESS,
      )
    ) {
      return {
        eligible: false,
        code: 'BOOKING_PAYMENT_UNCONFIRMED',
        message: 'Thanh toán trực tuyến chưa được xác nhận.',
      };
    }
    return stayDatePolicy({
      action,
      now,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      checkInTime: booking.checkInTimeSnapshot ?? booking.hotel.checkInTime,
      checkOutTime: booking.checkOutTimeSnapshot ?? booking.hotel.checkOutTime,
    });
  }

  private lookup(input: VerifyOwnerStayDto) {
    const hasQr = Boolean(input.qrToken?.trim());
    const hasCode = Boolean(input.bookingCode?.trim());
    if (hasQr === hasCode)
      throw new BadRequestException('Nhập một mã booking hoặc một mã QR.');
    if (hasQr) {
      const proof = input.qrToken!.trim();
      const claims = this.qr.verify(proof);
      return {
        method: 'QR' as Method,
        proof,
        where: {
          id: claims.bookingId,
          code: claims.bookingCode,
          hotelId: claims.hotelId,
        },
        claims,
      };
    }
    const proof = input.bookingCode!.trim().toUpperCase();
    if (!/^BT-[A-Z0-9-]{3,28}$/.test(proof))
      throw new BadRequestException('Mã booking không hợp lệ.');
    return {
      method: 'CODE' as Method,
      proof,
      where: { code: proof },
      claims: null,
    };
  }

  private matchesQr(
    booking: StayBooking,
    lookup: ReturnType<OwnerStayService['lookup']>,
  ) {
    const claims = lookup.claims;
    return (
      (!claims && booking.code === lookup.proof) ||
      (claims !== null &&
        booking.id === claims.bookingId &&
        booking.code === claims.bookingCode &&
        booking.hotelId === claims.hotelId &&
        booking.checkIn.toISOString().slice(0, 10) === claims.checkIn &&
        booking.checkOut.toISOString().slice(0, 10) === claims.checkOut)
    );
  }

  private secret() {
    const value =
      process.env.BOOKING_QR_SECRET ?? process.env.JWT_ACCESS_SECRET;
    if (!value && process.env.NODE_ENV !== 'test')
      throw new Error(
        'BOOKING_QR_SECRET or JWT_ACCESS_SECRET must be configured',
      );
    return `owner-stay-verification-v1:${value ?? 'test-only-secret'}`;
  }

  private issueRef(
    ownerId: string,
    bookingId: string,
    method: Method,
    proof: string,
  ) {
    const payload = Buffer.from(
      JSON.stringify({
        ownerId,
        bookingId,
        method,
        proofHash: createHash('sha256').update(proof).digest('hex'),
        expiresAt: Date.now() + 300_000,
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', this.secret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifyRef(
    value: string,
    ownerId: string,
    bookingId: string,
    method: Method,
    proof: string,
  ) {
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra || payload.length > 800)
      throw new ConflictException({
        code: 'STAY_VERIFICATION_STALE',
        message: 'Xác minh đã hết hiệu lực. Vui lòng xác minh lại.',
      });
    const expected = createHmac('sha256', this.secret())
      .update(payload)
      .digest();
    const received = Buffer.from(signature, 'base64url');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      throw new ConflictException({
        code: 'STAY_VERIFICATION_STALE',
        message: 'Xác minh đã hết hiệu lực. Vui lòng xác minh lại.',
      });
    let claims: {
      ownerId: string;
      bookingId: string;
      method: Method;
      proofHash: string;
      expiresAt: number;
    };
    try {
      claims = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as typeof claims;
    } catch {
      throw new ConflictException({
        code: 'STAY_VERIFICATION_STALE',
        message: 'Xác minh đã hết hiệu lực. Vui lòng xác minh lại.',
      });
    }
    if (
      claims.ownerId !== ownerId ||
      claims.bookingId !== bookingId ||
      claims.method !== method ||
      claims.proofHash !== createHash('sha256').update(proof).digest('hex') ||
      !Number.isFinite(claims.expiresAt) ||
      Date.now() > claims.expiresAt
    ) {
      throw new ConflictException({
        code: 'STAY_VERIFICATION_STALE',
        message: 'Xác minh đã hết hiệu lực. Vui lòng xác minh lại.',
      });
    }
  }

  private assertOwner(user: AuthenticatedUser) {
    if (user.role !== UserRole.HOTEL_OWNER || user.ownerAccessBlocked)
      throw new ForbiddenException(
        'Bạn không có quyền quản lý booking khách sạn.',
      );
  }
}
