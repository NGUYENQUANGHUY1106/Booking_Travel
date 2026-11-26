import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { StayCompletionService } from '../src/modules/bookings/stay-completion.service';

async function main() {
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    if (process.argv[2] === '--inspect' && process.argv[3]) {
      const booking = await prisma.booking.findUnique({
        where: { code: process.argv[3] },
        select: { code: true, status: true, checkOut: true, checkOutTimeSnapshot: true,
          completedAt: true, completionMethod: true, actualCheckOutAt: true,
          payments: { select: { status: true, method: true, amount: true, paidAt: true } },
          handoverAlert: { select: { resolvedAt: true } },
        },
      });
      process.stdout.write(`${JSON.stringify(booking)}\n`);
      return;
    }
    const result = await new StayCompletionService(prisma).sweep();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`Stay reconciliation failed: ${String(error)}\n`);
  process.exitCode = 1;
});
