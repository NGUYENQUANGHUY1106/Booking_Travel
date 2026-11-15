import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class PaymentExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.expireDue(), 30_000);
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
      const due = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.PENDING_PAYMENT,
          paymentDeadline: { lte: new Date() },
        },
        select: { id: true },
        take: 100,
        orderBy: { paymentDeadline: 'asc' },
      });
      for (const item of due) {
        await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${item.id} FOR UPDATE`;
          await tx.booking.updateMany({
            where: {
              id: item.id,
              status: BookingStatus.PENDING_PAYMENT,
              paymentDeadline: { lte: new Date() },
            },
            data: { status: BookingStatus.EXPIRED },
          });
        });
      }
    } catch (error) {
      this.logger.error(
        `Payment expiry sweep failed: ${error instanceof Error ? error.name : 'unknown'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
