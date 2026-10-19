import {
  BookingStatus,
  HotelStatus,
  PrismaClient,
  RoomStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD_HASH_ROUNDS = 12;

const DEMO_ACCOUNTS = {
  admin: {
    email: 'admin@bookingtravel.vn',
    password: 'admin123',
  },
  owner: {
    email: 'owner@bookingtravel.vn',
    password: 'owner123',
  },
  traveler: {
    email: 'traveler@bookingtravel.vn',
    password: 'traveler123',
  },
} as const;

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
  const [adminPasswordHash, ownerPasswordHash, travelerPasswordHash] =
    await Promise.all([
      hash(DEMO_ACCOUNTS.admin.password, PASSWORD_HASH_ROUNDS),
      hash(DEMO_ACCOUNTS.owner.password, PASSWORD_HASH_ROUNDS),
      hash(DEMO_ACCOUNTS.traveler.password, PASSWORD_HASH_ROUNDS),
    ]);
  const verifiedAt = new Date();

  await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.admin.email },
    update: {
      passwordHash: adminPasswordHash,
      fullName: 'Quản trị viên Demo',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
    create: {
      id: IDS.adminUser,
      email: DEMO_ACCOUNTS.admin.email,
      passwordHash: adminPasswordHash,
      fullName: 'Quản trị viên Demo',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
  });
  await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.owner.email },
    update: {
      passwordHash: ownerPasswordHash,
      fullName: 'Nguyễn Minh Quang',
      phone: '+84901234567',
      role: UserRole.HOTEL_OWNER,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
    create: {
      id: IDS.ownerUser,
      email: DEMO_ACCOUNTS.owner.email,
      passwordHash: ownerPasswordHash,
      fullName: 'Nguyễn Minh Quang',
      phone: '+84901234567',
      role: UserRole.HOTEL_OWNER,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
  });
  await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.traveler.email },
    update: {
      passwordHash: travelerPasswordHash,
      fullName: 'Khách du lịch Demo',
      phone: '+84912345678',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
    create: {
      id: IDS.travelerUser,
      email: DEMO_ACCOUNTS.traveler.email,
      passwordHash: travelerPasswordHash,
      fullName: 'Khách du lịch Demo',
      phone: '+84912345678',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
  });

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_ACCOUNTS.admin.email },
  });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_ACCOUNTS.owner.email },
  });
  const traveler = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_ACCOUNTS.traveler.email },
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

  console.log('Seed hoàn tất: 3 tài khoản demo đã có mật khẩu đăng nhập.');
  console.table(DEMO_ACCOUNTS);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
