import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from '../src/common/authorization/audit.service';
import { AuthorizationService } from '../src/common/authorization/authorization.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { OwnerBookingsService } from '../src/modules/bookings/owner-bookings.service';
import { PricingService } from '../src/modules/pricing/pricing.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const hotels = await prisma.hotel.findMany({
      select: {
        id: true,
        ownerId: true,
        _count: { select: { bookings: true } },
      },
    });
    const owners = [...new Set(hotels.map((hotel) => hotel.ownerId))];
    const ownerBookings = (id: string) =>
      hotels
        .filter((hotel) => hotel.ownerId === id)
        .reduce((count, hotel) => count + hotel._count.bookings, 0);
    const ownerA = owners
      .filter(
        (id) =>
          hotels.filter((hotel) => hotel.ownerId === id).length >= 2 &&
          ownerBookings(id) > 0,
      )
      .sort((left, right) => ownerBookings(right) - ownerBookings(left))[0];
    const ownerB = owners.find((id) => id !== ownerA && ownerBookings(id) > 0);
    if (!ownerA || !ownerB) {
      throw new Error(
        'Cần ít nhất hai Owner có booking, trong đó một Owner sở hữu từ hai khách sạn.',
      );
    }

    const service = new OwnerBookingsService(prisma, new AuditService());
    const actor = { id: ownerA, role: UserRole.HOTEL_OWNER, permissions: [] };
    const ownedHotels = hotels.filter((hotel) => hotel.ownerId === ownerA);
    const ownHotelIds = new Set(ownedHotels.map((hotel) => hotel.id));
    const first = await service.list(actor, { limit: 2 });
    if (first.total !== ownerBookings(ownerA))
      throw new Error('Tổng booking Owner không khớp dữ liệu PostgreSQL.');
    const bookingIds = new Set<string>();
    let result = first;
    for (;;) {
      if (result.items.some((booking) => !ownHotelIds.has(booking.hotel.id))) {
        throw new Error('Danh sách chứa booking của Owner khác.');
      }
      for (const booking of result.items) {
        if (bookingIds.has(booking.id))
          throw new Error('Phân trang trả booking trùng lặp.');
        bookingIds.add(booking.id);
      }
      if (!result.nextCursor) break;
      result = await service.list(actor, {
        after: result.nextCursor,
        limit: 2,
      });
    }
    if (bookingIds.size !== first.total)
      throw new Error('Phân trang bỏ sót booking.');
    for (const hotel of ownedHotels) {
      const result = await service.list(actor, {
        hotelId: hotel.id,
        limit: 50,
      });
      if (
        result.total !== hotel._count.bookings ||
        result.items.some((booking) => booking.hotel.id !== hotel.id)
      ) {
        throw new Error('Bộ lọc khách sạn không khớp dữ liệu PostgreSQL.');
      }
    }

    const ownBooking = first.items[0];
    const otherBooking = await prisma.booking.findFirst({
      where: { hotel: { ownerId: ownerB } },
      select: { id: true },
    });
    if (!ownBooking || !otherBooking)
      throw new Error('Thiếu booking kiểm tra.');
    const ownDetail = await service.detail(actor, ownBooking.id);
    if (ownDetail.id !== ownBooking.id || !ownDetail.guest.name)
      throw new Error('Chi tiết booking Owner không hợp lệ.');
    const guestBooking = await prisma.booking.findUnique({
      where: { id: ownBooking.id },
      select: { userId: true },
    });
    if (!guestBooking) throw new Error('Thiếu người đặt phòng.');
    const generic = new BookingsService(
      prisma,
      new AuthorizationService(prisma),
      new AuditService(),
      {} as PricingService,
    );
    const customerDetail = await generic.get(ownBooking.id, {
      id: guestBooking.userId,
      role: UserRole.USER,
      permissions: [],
    });
    if (
      'ownerInternalNote' in customerDetail ||
      'ownerNoteUpdatedAt' in customerDetail ||
      'ownerNoteUpdatedBy' in customerDetail
    ) {
      throw new Error('API booking của khách lộ ghi chú nội bộ Owner.');
    }
    const customerList = await generic.list(
      {},
      { id: guestBooking.userId, role: UserRole.USER, permissions: [] },
    );
    if (
      customerList.some(
        (booking) =>
          'ownerInternalNote' in booking ||
          'ownerNoteUpdatedAt' in booking ||
          'ownerNoteUpdatedBy' in booking,
      )
    ) {
      throw new Error('Danh sách booking của khách lộ ghi chú nội bộ Owner.');
    }
    try {
      await service.detail(actor, otherBooking.id);
      throw new Error('Owner A đọc được booking Owner B.');
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    const otherHotel = hotels.find((hotel) => hotel.ownerId === ownerB);
    if (!otherHotel) throw new Error('Thiếu khách sạn Owner B.');
    try {
      await service.list(actor, { hotelId: otherHotel.id });
      throw new Error('Owner A lọc được khách sạn Owner B.');
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    process.stdout.write(
      JSON.stringify({
        owners: owners.length,
        ownerHotels: ownedHotels.length,
        bookingHotels: ownedHotels.filter((hotel) => hotel._count.bookings > 0)
          .length,
        ownerBookings: first.total,
        perHotelFilterPassed: true,
        cursorPaginationPassed: true,
        crossOwnerDenied: true,
        customerNoteHidden: true,
      }) + '\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    error instanceof Error
      ? `${error.message}\n`
      : 'Không thể kiểm tra booking Owner.\n',
  );
  process.exitCode = 1;
});
