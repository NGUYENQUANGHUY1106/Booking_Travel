import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  InvoiceDocumentType,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingInvoicesService } from './booking-invoices.service';

describe('BookingInvoicesService', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    role: UserRole.USER,
    permissions: [],
  };
  const paymentBase = {
    id: 'payment-1',
    reference: 'PAY-001',
    bookingId: 'booking-1',
    userId: 'user-1',
    provider: 'SIMULATOR',
    merchantId: null,
    merchantReference: null,
    providerTxnId: 'TXN-001',
    amount: new Prisma.Decimal('1500000'),
    currency: 'VND',
    method: null,
    status: PaymentStatus.PENDING,
    idempotencyKey: null,
    paidAt: null,
    cancelledAt: null,
    failureReason: null,
    reconciliationRequired: false,
    createdAt: new Date('2026-11-15T01:00:00.000Z'),
    updatedAt: new Date('2026-11-15T01:00:00.000Z'),
    succeededAt: null,
    failedAt: null,
  };
  const booking = {
    id: 'booking-1',
    quoteId: null,
    code: 'BT-DEMO-001',
    userId: 'user-1',
    hotelId: 'hotel-1',
    roomId: 'room-1',
    roomNameSnapshot: 'Deluxe',
    roomTypeSnapshot: 'DOUBLE',
    checkIn: new Date('2026-12-01T00:00:00.000Z'),
    checkOut: new Date('2026-12-03T00:00:00.000Z'),
    adults: 2,
    children: 0,
    roomCount: 1,
    nights: 2,
    pricePerNight: new Prisma.Decimal('750000'),
    totalAmount: new Prisma.Decimal('1500000'),
    nightlyRatesSnapshot: null,
    cancellationPolicySnapshot: null,
    currency: 'VND',
    status: 'CONFIRMED',
    paymentMethod: 'PAY_AT_HOTEL',
    paymentDeadline: null,
    guestName: 'Nguyễn Văn A',
    guestEmail: 'a@example.com',
    guestPhone: '0901000000',
    note: null,
    cancelledAt: null,
    createdAt: new Date('2026-11-15T00:00:00.000Z'),
    updatedAt: new Date('2026-11-15T00:00:00.000Z'),
    hotel: {
      name: 'Blue Hotel',
      addressLine: '1 Đường Biển',
      ward: null,
      district: 'Sơn Trà',
      city: 'Đà Nẵng',
      province: 'Đà Nẵng',
      contactEmail: 'blue@example.com',
      contactPhone: '0902000000',
    },
    payments: [paymentBase],
  };

  function setup(found: unknown = booking) {
    const prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(found) },
      invoice: {
        upsert: jest.fn().mockImplementation(({ create }) =>
          Promise.resolve({
            id: 'invoice-1',
            ...create,
            issuedAt: new Date('2026-11-15T02:00:00.000Z'),
            createdAt: new Date('2026-11-15T02:00:00.000Z'),
          }),
        ),
      },
    };
    return {
      prisma,
      service: new BookingInvoicesService(prisma as unknown as PrismaService),
    };
  }

  it('returns 404 when the booking does not belong to the current user', async () => {
    const { service, prisma } = setup(null);
    await expect(service.getOrCreate('booking-other', user)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-other', userId: 'user-1' },
      }),
    );
  });

  it('creates only a booking summary for an unpaid booking', async () => {
    const { service, prisma } = setup();
    const result = await service.getOrCreate('booking-1', user);
    expect(result.documentType).toBe(InvoiceDocumentType.BOOKING_SUMMARY);
    expect(result.snapshot.payment).toBeNull();
    expect(result.snapshot.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(prisma.invoice.upsert).toHaveBeenCalledTimes(1);
  });

  it('creates a receipt only for a matching successful payment', async () => {
    const paidBooking = {
      ...booking,
      payments: [
        {
          ...paymentBase,
          status: PaymentStatus.SUCCESS,
          succeededAt: new Date('2026-11-15T01:05:00.000Z'),
        },
      ],
    };
    const { service } = setup(paidBooking);
    const result = await service.getOrCreate('booking-1', user);
    expect(result.documentType).toBe(InvoiceDocumentType.PAYMENT_RECEIPT);
    expect(result.snapshot.payment?.reference).toBe('PAY-001');
    expect(result.documentHtml).not.toContain('card');
  });

  it('rejects a successful payment whose amount differs from the booking', async () => {
    const invalid = {
      ...booking,
      payments: [
        {
          ...paymentBase,
          status: PaymentStatus.SUCCESS,
          amount: new Prisma.Decimal('1'),
        },
      ],
    };
    const { service, prisma } = setup(invalid);
    await expect(service.getOrCreate('booking-1', user)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.invoice.upsert).not.toHaveBeenCalled();
  });

  it('uses the same snapshot key when requested again without changes', async () => {
    const { service, prisma } = setup();
    const first = await service.getOrCreate('booking-1', user);
    const second = await service.getOrCreate('booking-1', user);
    expect(second.invoiceNumber).toBe(first.invoiceNumber);
    expect(prisma.invoice.upsert).toHaveBeenCalledTimes(2);
  });

  it('renders a downloadable PDF with an embedded Vietnamese font', async () => {
    const { service } = setup();
    const pdf = await service.getPdf('booking-1', user);
    expect(pdf.fileName).toMatch(/\.pdf$/);
    expect(pdf.content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.content.length).toBeGreaterThan(5_000);
  });
});
