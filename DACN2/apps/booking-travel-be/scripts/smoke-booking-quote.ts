import { UserRole } from '@prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { todayInVietnam } from '../src/modules/rooms/inventory';
import type { AuthorizationService } from '../src/common/authorization/authorization.service';
import type { AuditService } from '../src/common/authorization/audit.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const traveler = await prisma.user.findFirst({
      where: { role: UserRole.USER, isActive: true },
      select: { id: true },
    });
    if (!traveler) throw new Error('Không có tài khoản User để smoke báo giá.');
    const rooms = await prisma.room.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        quantity: { gt: 0 },
        hotel: { status: 'APPROVED', isVisible: true, deletedAt: null },
      },
      select: { id: true, hotel: { select: { ownerId: true } } },
      take: 100,
    });
    const today = new Date(`${todayInVietnam()}T00:00:00Z`);
    const day = (offset: number) =>
      new Date(today.getTime() + offset * 86_400_000)
        .toISOString()
        .slice(0, 10);
    const service = new BookingsService(
      prisma,
      {} as AuthorizationService,
      {} as AuditService,
      new PricingService(prisma),
    );
    const owners = new Set<string>();
    const results: {
      roomId: string;
      hotelId: string;
      nights: number;
      amount: string;
      currency: string;
      expiresAt: string;
    }[] = [];
    for (const room of rooms) {
      if (owners.has(room.hotel.ownerId)) continue;
      try {
        const quote = await service.quote(
          {
            roomId: room.id,
            checkIn: day(30),
            checkOut: day(32),
            adults: 1,
            roomCount: 1,
          },
          {
            id: traveler.id,
            role: UserRole.USER,
            permissions: [],
            sessionId: 'readonly-smoke-session',
          },
        );
        owners.add(room.hotel.ownerId);
        results.push({
          roomId: room.id,
          hotelId: quote.hotel.id,
          nights: quote.nights,
          amount: quote.finalAmount,
          currency: quote.currency,
          expiresAt: quote.expiresAt,
        });
        if (results.length >= 2) break;
      } catch {
        /* Another public room may have an inventory block. */
      }
    }
    console.log(
      JSON.stringify(
        {
          publicRooms: rooms.length,
          publicOwners: new Set(rooms.map((room) => room.hotel.ownerId)).size,
          quotedOwners: results.length,
          quotes: results,
        },
        null,
        2,
      ),
    );
    if (results.length < 2) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
