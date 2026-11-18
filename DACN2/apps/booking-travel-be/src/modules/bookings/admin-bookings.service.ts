import {
  BadRequestException,
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
import { AuditService } from '../../common/authorization/audit.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminBookingQueryDto } from './dto/admin-booking-query.dto';

const CAPTURED_ONLINE_STATUSES = [
  PaymentStatus.SUCCESS,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];
const TIMELINE_LIMIT = 100;

function maskEmail(value: string): string {
  const [name, domain] = value.split('@');
  return domain ? `${name.slice(0, 2)}***@${domain}` : 'Chưa có email';
}

function maskPhone(value: string | null): string | null {
  return value ? `${value.slice(0, 2)}***${value.slice(-2)}` : null;
}

function validDay(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('Ngày không hợp lệ.');
  }
  return date;
}

function dateRange(
  query: AdminBookingQueryDto,
): Prisma.DateTimeFilter | undefined {
  if (!query.from && !query.to) return undefined;
  const from = query.from && validDay(query.from);
  const to = query.to && validDay(query.to);
  if (from && to && from > to)
    throw new BadRequestException('Khoảng ngày không hợp lệ.');
  if (query.dateField === 'createdAt') {
    // Calendar input is interpreted in Vietnam time; stored timestamps remain UTC.
    return {
      ...(query.from ? { gte: new Date(`${query.from}T00:00:00+07:00`) } : {}),
      ...(query.to
        ? {
            lt: new Date(
              new Date(`${query.to}T00:00:00+07:00`).getTime() + 86_400_000,
            ),
          }
        : {}),
    };
  }
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

type TimelineEntry = {
  id: string;
  at: Date;
  label: string;
  source: string;
  kind: 'actual' | 'scheduled';
  actorId?: string | null;
  referenceId?: string | null;
};

@Injectable()
export class AdminBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private requireAdmin(user: AuthenticatedUser) {
    if (
      user.role !== UserRole.ADMIN ||
      !user.permissions.includes('BOOKING_SUPPORT')
    ) {
      throw new ForbiddenException('Thiếu quyền giám sát đặt phòng.');
    }
  }

  async list(user: AuthenticatedUser, query: AdminBookingQueryDto) {
    this.requireAdmin(user);
    const range = dateRange(query);
    const search = query.search?.trim();
    const where: Prisma.BookingWhereInput = {
      ...(query.hotelId ? { hotelId: query.hotelId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus
        ? { payments: { some: { status: query.paymentStatus } } }
        : {}),
      ...(query.refundStatus
        ? { refundRequests: { some: { status: query.refundStatus } } }
        : {}),
      ...(range ? { [query.dateField]: range } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const order = query.sort === 'oldest' ? 'asc' : 'desc';
    const [total, bookings] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        select: {
          id: true,
          code: true,
          hotelId: true,
          userId: true,
          hotelNameSnapshot: true,
          roomNameSnapshot: true,
          roomTypeSnapshot: true,
          guestEmail: true,
          checkIn: true,
          checkOut: true,
          adults: true,
          children: true,
          roomCount: true,
          totalAmount: true,
          currency: true,
          status: true,
          paymentMethod: true,
          createdAt: true,
          updatedAt: true,
          payments: {
            select: { status: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
          refundRequests: {
            select: { status: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
        orderBy: [{ createdAt: order }, { id: order }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      items: bookings.map((booking) => ({
        id: booking.id,
        code: booking.code,
        hotelId: booking.hotelId,
        userId: booking.userId,
        hotelName: booking.hotelNameSnapshot,
        roomName: booking.roomNameSnapshot,
        roomType: booking.roomTypeSnapshot,
        guest: maskEmail(booking.guestEmail),
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: booking.adults + booking.children,
        roomCount: booking.roomCount,
        totalAmount: booking.totalAmount.toString(),
        currency: booking.currency,
        status: booking.status,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.payments[0]?.status ?? null,
        refundStatus: booking.refundRequests[0]?.status ?? null,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async detail(user: AuthenticatedUser, id: string) {
    this.requireAdmin(user);
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        quoteId: true,
        userId: true,
        hotelId: true,
        roomId: true,
        hotelNameSnapshot: true,
        hotelAddressSnapshot: true,
        roomNameSnapshot: true,
        roomTypeSnapshot: true,
        checkIn: true,
        checkOut: true,
        adults: true,
        children: true,
        roomCount: true,
        nights: true,
        pricePerNight: true,
        totalAmount: true,
        currency: true,
        nightlyRatesSnapshot: true,
        cancellationPolicySnapshot: true,
        refundRulesSnapshot: true,
        checkInTimeSnapshot: true,
        status: true,
        paymentMethod: true,
        paymentDeadline: true,
        guestName: true,
        guestEmail: true,
        guestPhone: true,
        cancellationReason: true,
        cancellationFee: true,
        refundEstimate: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        hotel: {
          select: {
            name: true,
            status: true,
            ownerId: true,
            owner: { select: { fullName: true } },
          },
        },
        user: { select: { fullName: true } },
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy đặt phòng.');

    const [payments, refunds, paymentCount, refundCount, captured, refunded] =
      await this.prisma.$transaction([
        this.prisma.payment.findMany({
          where: { bookingId: id },
          select: {
            id: true,
            status: true,
            provider: true,
            reference: true,
            merchantReference: true,
            providerTxnId: true,
            amount: true,
            currency: true,
            createdAt: true,
            paidAt: true,
            succeededAt: true,
            failedAt: true,
            cancelledAt: true,
            reconciliationRequired: true,
            reconciliationCases: {
              select: { id: true, status: true, reason: true, createdAt: true },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              take: 20,
            },
            receipts: {
              select: { id: true, outcome: true, createdAt: true },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              take: 20,
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: TIMELINE_LIMIT,
        }),
        this.prisma.refundRequest.findMany({
          where: { bookingId: id },
          select: {
            id: true,
            paymentId: true,
            status: true,
            amount: true,
            currency: true,
            provider: true,
            providerRefundRef: true,
            requesterId: true,
            reviewerId: true,
            reason: true,
            reviewReason: true,
            failureCode: true,
            createdAt: true,
            reviewedAt: true,
            completedAt: true,
            failedAt: true,
            events: {
              select: {
                id: true,
                eventType: true,
                actorId: true,
                createdAt: true,
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              take: TIMELINE_LIMIT,
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: TIMELINE_LIMIT,
        }),
        this.prisma.payment.count({ where: { bookingId: id } }),
        this.prisma.refundRequest.count({ where: { bookingId: id } }),
        this.prisma.payment.aggregate({
          where: { bookingId: id, status: { in: CAPTURED_ONLINE_STATUSES } },
          _sum: { amount: true },
        }),
        this.prisma.refundRequest.aggregate({
          where: { bookingId: id, status: RefundRequestStatus.COMPLETED },
          _sum: { amount: true },
        }),
      ]);

    const timeline: TimelineEntry[] = [
      {
        id: `booking:${id}`,
        at: booking.createdAt,
        label: 'Booking được tạo',
        source: 'booking',
        kind: 'actual',
      },
    ];
    if (booking.paymentDeadline)
      timeline.push({
        id: `deadline:${id}`,
        at: booking.paymentDeadline,
        label: 'Hạn thanh toán dự kiến',
        source: 'booking',
        kind: 'scheduled',
      });
    if (booking.cancelledAt)
      timeline.push({
        id: `cancel:${id}`,
        at: booking.cancelledAt,
        label:
          booking.status === BookingStatus.EXPIRED
            ? 'Booking hết hạn'
            : 'Booking bị hủy',
        source: 'booking',
        kind: 'actual',
      });
    for (const payment of payments) {
      timeline.push({
        id: `payment:${payment.id}`,
        at: payment.createdAt,
        label: 'Tạo giao dịch thanh toán',
        source: 'payment',
        kind: 'actual',
        referenceId: payment.id,
      });
      if (payment.succeededAt ?? payment.paidAt)
        timeline.push({
          id: `payment-success:${payment.id}`,
          at: (payment.succeededAt ?? payment.paidAt)!,
          label:
            payment.status === PaymentStatus.PAID
              ? 'Thu tại khách sạn'
              : 'Thanh toán thành công',
          source: 'payment',
          kind: 'actual',
          referenceId: payment.id,
        });
      if (payment.failedAt)
        timeline.push({
          id: `payment-failed:${payment.id}`,
          at: payment.failedAt,
          label: 'Thanh toán thất bại',
          source: 'payment',
          kind: 'actual',
          referenceId: payment.id,
        });
      if (payment.cancelledAt)
        timeline.push({
          id: `payment-cancelled:${payment.id}`,
          at: payment.cancelledAt,
          label: 'Giao dịch bị hủy',
          source: 'payment',
          kind: 'actual',
          referenceId: payment.id,
        });
      for (const receipt of payment.receipts ?? [])
        timeline.push({
          id: `payment-receipt:${receipt.id}`,
          at: receipt.createdAt,
          label: `Callback thanh toán: ${receipt.outcome}`,
          source: 'payment',
          kind: 'actual',
          referenceId: payment.id,
        });
      for (const reconciliation of payment.reconciliationCases)
        timeline.push({
          id: `reconciliation:${reconciliation.id}`,
          at: reconciliation.createdAt,
          label: `Cần đối soát: ${reconciliation.reason}`,
          source: 'payment',
          kind: 'actual',
          referenceId: payment.id,
        });
    }
    for (const refund of refunds) {
      timeline.push({
        id: `refund:${refund.id}`,
        at: refund.createdAt,
        label: 'Yêu cầu hoàn tiền',
        source: 'refund',
        kind: 'actual',
        actorId: refund.requesterId,
        referenceId: refund.id,
      });
      for (const event of refund.events)
        timeline.push({
          id: `refund-event:${event.id}`,
          at: event.createdAt,
          label: `Hoàn tiền: ${event.eventType}`,
          source: 'refund',
          kind: 'actual',
          actorId: event.actorId,
          referenceId: refund.id,
        });
      if (
        refund.reviewedAt &&
        !refund.events.some(
          (event) => event.createdAt.getTime() === refund.reviewedAt?.getTime(),
        )
      )
        timeline.push({
          id: `refund-reviewed:${refund.id}`,
          at: refund.reviewedAt,
          label:
            refund.status === RefundRequestStatus.REJECTED
              ? 'Yêu cầu hoàn bị từ chối'
              : 'Yêu cầu hoàn đã được xét duyệt',
          source: 'refund',
          kind: 'actual',
          actorId: refund.reviewerId,
          referenceId: refund.id,
        });
      if (
        refund.failedAt &&
        !refund.events.some(
          (event) => event.createdAt.getTime() === refund.failedAt?.getTime(),
        )
      )
        timeline.push({
          id: `refund-failed:${refund.id}`,
          at: refund.failedAt,
          label: 'Hoàn tiền thất bại',
          source: 'refund',
          kind: 'actual',
          referenceId: refund.id,
        });
      if (
        refund.completedAt &&
        !refund.events.some(
          (event) =>
            event.createdAt.getTime() === refund.completedAt?.getTime(),
        )
      )
        timeline.push({
          id: `refund-completed:${refund.id}`,
          at: refund.completedAt,
          label: 'Hoàn tiền hoàn tất',
          source: 'refund',
          kind: 'actual',
          referenceId: refund.id,
        });
    }
    timeline.sort(
      (a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id),
    );
    const gaps = [
      'Không lưu riêng thời điểm tạo quote/hold và lịch sử mọi lần chuyển trạng thái booking.',
    ];
    if (
      booking.status === BookingStatus.CONFIRMED ||
      booking.status === BookingStatus.CHECKED_IN ||
      booking.status === BookingStatus.COMPLETED
    )
      gaps.push('Chưa có mốc xác nhận booking độc lập để hiển thị chính xác.');
    if (
      booking.status === BookingStatus.CHECKED_IN ||
      booking.status === BookingStatus.COMPLETED
    )
      gaps.push(
        'Chưa có thời điểm check-in/check-out thực tế trên nhánh develop.',
      );
    if (
      paymentCount > payments.length ||
      refundCount > refunds.length ||
      refunds.some((refund) => refund.events.length === TIMELINE_LIMIT)
    )
      gaps.push(
        'Lịch sử sự kiện dài đã được giới hạn; xem giao dịch hoặc hoàn tiền tương ứng để điều tra tiếp.',
      );

    const capturedTotal = captured._sum.amount ?? new Prisma.Decimal(0);
    const refundedTotal = refunded._sum.amount ?? new Prisma.Decimal(0);
    const needsReconciliation =
      payments.some(
        (payment) =>
          payment.reconciliationRequired ||
          payment.reconciliationCases.some((item) => item.status === 'OPEN'),
      ) ||
      capturedTotal.gt(booking.totalAmount) ||
      (booking.paymentMethod === BookingPaymentMethod.SIMULATOR &&
        booking.status === BookingStatus.CONFIRMED &&
        capturedTotal.isZero()) ||
      (booking.status === BookingStatus.PENDING_PAYMENT && capturedTotal.gt(0));

    this.audit.recordSuccess(user, 'ADMIN_BOOKING_DETAIL_VIEW', 'BOOKING', id);
    return {
      booking: {
        ...booking,
        guestEmail: maskEmail(booking.guestEmail),
        guestPhone: maskPhone(booking.guestPhone),
        pricePerNight: booking.pricePerNight.toString(),
        totalAmount: booking.totalAmount.toString(),
        cancellationFee: booking.cancellationFee?.toString() ?? null,
        refundEstimate: booking.refundEstimate?.toString() ?? null,
      },
      payments: payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
      })),
      refunds: refunds.map((refund) => ({
        ...refund,
        amount: refund.amount?.toString() ?? null,
      })),
      paymentCount,
      refundCount,
      capturedOnlineAmount: capturedTotal.toString(),
      refundedAmount: refundedTotal.toString(),
      needsReconciliation,
      timeline,
      dataGaps: gaps,
    };
  }
}
