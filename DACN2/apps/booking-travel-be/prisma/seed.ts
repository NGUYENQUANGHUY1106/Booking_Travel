import {
  BookingStatus,
  HotelStatus,
  PrismaClient,
  RoomStatus,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

const IDS = {
  adminUser: 'seed-user-admin',
  adminProfile: 'seed-admin-profile',
  ownerUser: 'seed-user-owner',
  travelerUser: 'seed-user-traveler',
  hotel: 'seed-hotel-blue-horizon',
  roomDeluxe: 'seed-room-deluxe-sea-view',
  roomSuperior: 'seed-room-superior-city-view',
  booking: 'seed-booking-confirmed',
} as const;

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@bookingtravel.vn' },
    update: { fullName: 'Quản trị viên Demo', role: UserRole.ADMIN },
    create: {
      id: IDS.adminUser,
      email: 'admin@bookingtravel.vn',
      passwordHash: 'AUTH_NOT_IMPLEMENTED',
      fullName: 'Quản trị viên Demo',
      role: UserRole.ADMIN,
    },
  });
  await prisma.user.upsert({
    where: { email: 'owner@bookingtravel.vn' },
    update: { fullName: 'Nguyễn Minh Quang', role: UserRole.HOTEL_OWNER },
    create: {
      id: IDS.ownerUser,
      email: 'owner@bookingtravel.vn',
      passwordHash: 'AUTH_NOT_IMPLEMENTED',
      fullName: 'Nguyễn Minh Quang',
      phone: '0901234567',
      role: UserRole.HOTEL_OWNER,
    },
  });
  await prisma.user.upsert({
    where: { email: 'traveler@bookingtravel.vn' },
    update: { fullName: 'Khách du lịch Demo', role: UserRole.USER },
    create: {
      id: IDS.travelerUser,
      email: 'traveler@bookingtravel.vn',
      passwordHash: 'AUTH_NOT_IMPLEMENTED',
      fullName: 'Khách du lịch Demo',
      phone: '0912345678',
      role: UserRole.USER,
    },
  });

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin@bookingtravel.vn' },
  });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'owner@bookingtravel.vn' },
  });
  const traveler = await prisma.user.findUniqueOrThrow({
    where: { email: 'traveler@bookingtravel.vn' },
  });

  await prisma.adminProfile.upsert({
    where: { userId: admin.id },
    update: {
      title: 'System Administrator',
      permissions: ['HOTEL_REVIEW', 'USER_MANAGEMENT', 'BOOKING_SUPPORT'],
    },
    create: {
      id: IDS.adminProfile,
      userId: admin.id,
      title: 'System Administrator',
      permissions: ['HOTEL_REVIEW', 'USER_MANAGEMENT', 'BOOKING_SUPPORT'],
    },
  });

  const hotel = await prisma.hotel.upsert({
    where: { slug: 'blue-horizon-my-khe-hotel' },
    update: { ownerId: owner.id, status: HotelStatus.APPROVED },
    create: {
      id: IDS.hotel,
      ownerId: owner.id,
      name: 'Blue Horizon My Khe Hotel',
      slug: 'blue-horizon-my-khe-hotel',
      description: 'Khách sạn gần biển Mỹ Khê với hồ bơi và phòng hướng biển.',
      addressLine: '38 Võ Nguyên Giáp',
      city: 'Đà Nẵng',
      province: 'Đà Nẵng',
      latitude: 16.0583,
      longitude: 108.2462,
      starRating: 4,
      status: HotelStatus.APPROVED,
      amenities: ['Hồ bơi', 'Wi-Fi', 'Bữa sáng', 'Gần biển'],
    },
  });

  await prisma.room.upsert({
    where: { id: IDS.roomDeluxe },
    update: { hotelId: hotel.id, status: RoomStatus.ACTIVE },
    create: {
      id: IDS.roomDeluxe,
      hotelId: hotel.id,
      name: 'Deluxe Sea View',
      type: 'DELUXE',
      description: 'Phòng hướng biển, diện tích 32 m².',
      capacityAdults: 2,
      capacityChildren: 1,
      bedInfo: '1 giường King',
      quantity: 5,
      basePrice: 1450000,
      status: RoomStatus.ACTIVE,
      amenities: ['Hướng biển', 'Điều hòa', 'TV', 'Minibar'],
    },
  });
  await prisma.room.upsert({
    where: { id: IDS.roomSuperior },
    update: { hotelId: hotel.id, status: RoomStatus.ACTIVE },
    create: {
      id: IDS.roomSuperior,
      hotelId: hotel.id,
      name: 'Superior City View',
      type: 'SUPERIOR',
      description: 'Phòng hướng phố, diện tích 28 m².',
      capacityAdults: 2,
      capacityChildren: 0,
      bedInfo: '1 giường đôi',
      quantity: 4,
      basePrice: 1180000,
      status: RoomStatus.ACTIVE,
      amenities: ['Hướng phố', 'Điều hòa', 'TV'],
    },
  });

  await prisma.booking.upsert({
    where: { code: 'BT-DEMO-001' },
    update: {
      userId: traveler.id,
      hotelId: hotel.id,
      roomId: IDS.roomDeluxe,
      status: BookingStatus.CONFIRMED,
    },
    create: {
      id: IDS.booking,
      code: 'BT-DEMO-001',
      userId: traveler.id,
      hotelId: hotel.id,
      roomId: IDS.roomDeluxe,
      checkIn: new Date('2026-12-10T00:00:00.000Z'),
      checkOut: new Date('2026-12-13T00:00:00.000Z'),
      adults: 2,
      children: 0,
      roomCount: 1,
      nights: 3,
      pricePerNight: 1450000,
      totalAmount: 4350000,
      status: BookingStatus.CONFIRMED,
      guestName: 'Khách du lịch Demo',
      guestEmail: 'traveler@bookingtravel.vn',
      guestPhone: '0912345678',
    },
  });

  console.log('Seed hoàn tất: 3 users, 1 admin, 1 hotel, 2 rooms, 1 booking.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
