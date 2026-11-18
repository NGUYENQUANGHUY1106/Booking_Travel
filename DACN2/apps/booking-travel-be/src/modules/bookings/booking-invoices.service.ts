import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceDocumentType, PaymentStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';

type InvoiceSnapshot = {
  booking: {
    id: string;
    code: string;
    status: string;
    createdAt: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    roomCount: number;
    adults: number;
    children: number;
    roomName: string;
    roomType: string;
    totalAmount: string;
    currency: string;
  };
  hotel: {
    name: string;
    address: string;
    email: string | null;
    phone: string | null;
  };
  guest: {
    name: string;
    email: string;
    phone: string | null;
  };
  paymentStatus: string | null;
  payment: {
    id: string;
    reference: string | null;
    provider: string | null;
    method: string | null;
    amount: string;
    currency: string;
    paidAt: string;
  } | null;
};

const invoiceBookingArgs = Prisma.validator<Prisma.BookingDefaultArgs>()({
  include: {
    hotel: {
      select: {
        contactEmail: true,
        contactPhone: true,
      },
    },
    payments: { orderBy: { createdAt: 'desc' } },
  },
});
type BookingWithInvoiceData = Prisma.BookingGetPayload<
  typeof invoiceBookingArgs
>;
type InvoicePayment = BookingWithInvoiceData['payments'][number];

const nodeRequire = createRequire(__filename);
const interRegular = nodeRequire.resolve(
  '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf',
);
const interBold = nodeRequire.resolve(
  '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf',
);

@Injectable()
export class BookingInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(bookingId: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.id },
      ...invoiceBookingArgs,
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking.');
    }

    const paidPayment = booking.payments.find(
      (payment) =>
        payment.status === PaymentStatus.PAID ||
        payment.status === PaymentStatus.SUCCESS,
    );
    if (
      paidPayment &&
      (!paidPayment.amount.equals(booking.totalAmount) ||
        paidPayment.currency !== booking.currency)
    ) {
      throw new ConflictException(
        'Số tiền hoặc loại tiền của thanh toán không khớp booking.',
      );
    }

    const snapshot = this.buildSnapshot(booking, paidPayment);
    const snapshotJson = JSON.stringify(snapshot);
    const snapshotHash = createHash('sha256')
      .update(snapshotJson)
      .digest('hex');
    const documentType = paidPayment
      ? InvoiceDocumentType.PAYMENT_RECEIPT
      : InvoiceDocumentType.BOOKING_SUMMARY;
    const prefix = paidPayment ? 'REC' : 'SUM';
    const invoiceNumber = `BT-${prefix}-${booking.code}-${snapshotHash.slice(0, 8).toUpperCase()}`;

    const invoice = await this.prisma.invoice.upsert({
      where: {
        bookingId_snapshotHash: { bookingId: booking.id, snapshotHash },
      },
      update: {},
      create: {
        invoiceNumber,
        bookingId: booking.id,
        paymentId: paidPayment?.id,
        userId: user.id,
        documentType,
        snapshotHash,
        snapshot,
      },
    });

    const fileName = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      documentType: invoice.documentType,
      issuedAt: invoice.issuedAt,
      snapshot,
      fileName,
      pdfFileName: fileName.replace(/\.html$/, '.pdf'),
      documentHtml: this.renderHtml(
        invoice.invoiceNumber,
        invoice.documentType,
        invoice.issuedAt,
        snapshot,
      ),
    };
  }

  async getPdf(bookingId: string, user: AuthenticatedUser) {
    const invoice = await this.getOrCreate(bookingId, user);
    return {
      fileName: invoice.pdfFileName,
      content: await this.renderPdf(
        invoice.invoiceNumber,
        invoice.documentType,
        invoice.issuedAt,
        invoice.snapshot,
      ),
    };
  }

  private buildSnapshot(
    booking: BookingWithInvoiceData,
    paidPayment?: InvoicePayment,
  ): InvoiceSnapshot {
    const latestPayment = booking.payments[0];
    return {
      booking: {
        id: booking.id,
        code: booking.code,
        status: booking.status,
        createdAt: booking.createdAt.toISOString(),
        checkIn: this.dateOnly(booking.checkIn),
        checkOut: this.dateOnly(booking.checkOut),
        nights: booking.nights,
        roomCount: booking.roomCount,
        adults: booking.adults,
        children: booking.children,
        roomName: booking.roomNameSnapshot,
        roomType: booking.roomTypeSnapshot,
        totalAmount: booking.totalAmount.toFixed(2),
        currency: booking.currency,
      },
      hotel: {
        name: booking.hotelNameSnapshot,
        address: booking.hotelAddressSnapshot,
        email: booking.hotel.contactEmail,
        phone: booking.hotel.contactPhone,
      },
      guest: {
        name: booking.guestName,
        email: booking.guestEmail,
        phone: booking.guestPhone,
      },
      paymentStatus: latestPayment?.status ?? null,
      payment: paidPayment
        ? {
            id: paidPayment.id,
            reference:
              paidPayment.reference ?? paidPayment.providerTxnId ?? null,
            provider: paidPayment.provider,
            method: paidPayment.method,
            amount: paidPayment.amount.toFixed(2),
            currency: paidPayment.currency,
            paidAt: (
              paidPayment.paidAt ??
              paidPayment.succeededAt ??
              paidPayment.updatedAt
            ).toISOString(),
          }
        : null,
    };
  }

  private renderHtml(
    invoiceNumber: string,
    documentType: InvoiceDocumentType,
    issuedAt: Date,
    snapshot: InvoiceSnapshot,
  ) {
    const receipt = documentType === InvoiceDocumentType.PAYMENT_RECEIPT;
    const e = (value: string | number | null | undefined) =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    const money = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: snapshot.booking.currency,
    }).format(Number(snapshot.booking.totalAmount));
    const issued = new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(issuedAt);
    const row = (label: string, value: string | number | null | undefined) =>
      `<tr><th>${e(label)}</th><td>${e(value)}</td></tr>`;

    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(invoiceNumber)}</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:0;background:#f5f7fb}.paper{max-width:760px;margin:24px auto;background:#fff;padding:32px;border-radius:16px}h1{font-size:26px;margin:0 0 6px;color:#1463e8}.muted{color:#667085}.total{font-size:24px;font-weight:700;color:#1749d1}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5e7eb}th{width:38%;color:#667085}footer{margin-top:24px;font-size:12px;color:#667085}@media print{body{background:#fff}.paper{margin:0;max-width:none}}</style></head><body><main class="paper"><h1>${receipt ? 'Biên nhận thanh toán' : 'Tóm tắt booking'}</h1><p class="muted">Booking Travel · ${e(invoiceNumber)} · Phát hành ${e(issued)}</p><table>${row('Mã booking', snapshot.booking.code)}${row('Khách sạn', snapshot.hotel.name)}${row('Địa chỉ', snapshot.hotel.address)}${row('Hạng phòng', `${snapshot.booking.roomName} (${snapshot.booking.roomType})`)}${row('Lưu trú', `${snapshot.booking.checkIn} – ${snapshot.booking.checkOut} · ${snapshot.booking.nights} đêm`)}${row('Số khách / phòng', `${snapshot.booking.adults} người lớn, ${snapshot.booking.children} trẻ em · ${snapshot.booking.roomCount} phòng`)}${row('Người đại diện', snapshot.guest.name)}${row('Email', snapshot.guest.email)}${row('Trạng thái booking', snapshot.booking.status)}${row('Trạng thái thanh toán', snapshot.paymentStatus ?? 'Chưa có thanh toán')}${snapshot.payment ? row('Mã giao dịch', snapshot.payment.reference ?? snapshot.payment.id) : ''}</table><p>Tổng tiền</p><p class="total">${e(money)}</p><footer>${receipt ? 'Biên nhận xác nhận giao dịch đã được hệ thống ghi nhận.' : 'Booking chưa có giao dịch thanh toán thành công; đây không phải biên nhận thanh toán.'}<br>Chứng từ tóm tắt phục vụ booking, không phải hóa đơn thuế điện tử. Không chứa dữ liệu thẻ thanh toán.</footer></main></body></html>`;
  }

  private renderPdf(
    invoiceNumber: string,
    documentType: InvoiceDocumentType,
    issuedAt: Date,
    snapshot: InvoiceSnapshot,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const document = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: {
          Title: invoiceNumber,
          Author: 'Booking Travel',
          Subject:
            documentType === InvoiceDocumentType.PAYMENT_RECEIPT
              ? 'Biên nhận thanh toán booking'
              : 'Tóm tắt booking',
        },
      });
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      document.registerFont('Inter', interRegular);
      document.registerFont('InterBold', interBold);

      const receipt = documentType === InvoiceDocumentType.PAYMENT_RECEIPT;
      const money = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: snapshot.booking.currency,
      }).format(Number(snapshot.booking.totalAmount));
      const issued = new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(issuedAt);
      const row = (
        label: string,
        value: string | number | null | undefined,
      ) => {
        document.font('InterBold').fontSize(9).fillColor('#667085').text(label);
        document
          .font('Inter')
          .fontSize(11)
          .fillColor('#172033')
          .text(String(value ?? '—'))
          .moveDown(0.55);
      };

      document.rect(0, 0, document.page.width, 112).fill('#1463E8');
      document
        .font('InterBold')
        .fontSize(24)
        .fillColor('#FFFFFF')
        .text(receipt ? 'Biên nhận thanh toán' : 'Tóm tắt booking', 48, 38);
      document
        .font('Inter')
        .fontSize(9)
        .text(`Booking Travel · ${invoiceNumber}`, 48, 75);
      document.y = 138;
      document
        .font('Inter')
        .fontSize(9)
        .fillColor('#667085')
        .text(`Phát hành: ${issued}`)
        .moveDown(1.2);

      row('Mã booking', snapshot.booking.code);
      row('Khách sạn', snapshot.hotel.name);
      row('Địa chỉ', snapshot.hotel.address);
      row(
        'Hạng phòng',
        `${snapshot.booking.roomName} (${snapshot.booking.roomType})`,
      );
      row(
        'Lưu trú',
        `${snapshot.booking.checkIn} – ${snapshot.booking.checkOut} · ${snapshot.booking.nights} đêm`,
      );
      row(
        'Khách / phòng',
        `${snapshot.booking.adults} người lớn, ${snapshot.booking.children} trẻ em · ${snapshot.booking.roomCount} phòng`,
      );
      row('Người đại diện', snapshot.guest.name);
      row('Email', snapshot.guest.email);
      row('Trạng thái booking', snapshot.booking.status);
      row(
        'Trạng thái thanh toán',
        snapshot.paymentStatus ?? 'Chưa có thanh toán',
      );
      if (snapshot.payment) {
        row('Mã giao dịch', snapshot.payment.reference ?? snapshot.payment.id);
      }

      document
        .moveDown(0.4)
        .font('InterBold')
        .fontSize(10)
        .fillColor('#667085')
        .text('TỔNG TIỀN');
      document
        .font('InterBold')
        .fontSize(22)
        .fillColor('#1749D1')
        .text(money)
        .moveDown(1.2);
      document
        .font('Inter')
        .fontSize(8)
        .fillColor('#667085')
        .text(
          receipt
            ? 'Biên nhận xác nhận giao dịch đã được hệ thống ghi nhận.'
            : 'Booking chưa có giao dịch thanh toán thành công; đây không phải biên nhận thanh toán.',
        )
        .text(
          'Chứng từ phục vụ booking, không phải hóa đơn thuế điện tử và không chứa dữ liệu thẻ.',
        );
      document.end();
    });
  }

  private dateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
