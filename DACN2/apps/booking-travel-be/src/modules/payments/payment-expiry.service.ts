import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const SWEEP_INTERVAL_MS = 30_000;
const SWEEP_BATCH_SIZE = 100;

@Injectable()
export class PaymentExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.expireDue(), SWEEP_INTERVAL_MS);
    this.timer.unref();
    void this.expireDue();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async expireDue() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Another worker or webhook can finish a locked booking on its own.
        const due = await tx.$queryRaw<{ id: string; paymentDeadline: Date }[]>`
          SELECT "id", "paymentDeadline" FROM "Booking"
          WHERE "status" = 'PENDING_PAYMENT'::"BookingStatus"
            AND "paymentDeadline" <= statement_timestamp()
          ORDER BY "paymentDeadline", "id"
          LIMIT ${SWEEP_BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        `;
        let expired = 0;
        let confirmed = 0;
        for (const booking of due) {
          const success = await tx.payment.findFirst({
            where: {
              bookingId: booking.id,
              status: PaymentStatus.SUCCESS,
              reconciliationRequired: false,
              succeededAt: { lt: booking.paymentDeadline },
            },
            select: { id: true },
          });
          const updated = await tx.booking.updateMany({
            where: { id: booking.id, status: BookingStatus.PENDING_PAYMENT },
            data: {
              status: success ? BookingStatus.CONFIRMED : BookingStatus.EXPIRED,
            },
          });
          if (updated.count) {
            if (success) {
              await tx.paymentOutboxEvent.upsert({
                where: {
                  paymentId_eventType: {
                    paymentId: success.id,
                    eventType: 'BOOKING_CONFIRMED',
                  },
                },
                create: {
                  paymentId: success.id,
                  eventType: 'BOOKING_CONFIRMED',
                },
                update: {},
              });
              confirmed++;
            } else expired++;
          }
        }
        return { scanned: due.length, expired, confirmed };
      });
      if (result.scanned)
        this.logger.log(
          `Hold sweep scanned=${result.scanned} expired=${result.expired} confirmed=${result.confirmed}`,
        );
    } catch (error) {
      this.logger.error(
        `Payment expiry sweep failed: ${error instanceof Error ? error.name : 'unknown'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
