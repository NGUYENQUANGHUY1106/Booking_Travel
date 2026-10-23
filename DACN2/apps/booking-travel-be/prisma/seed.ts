import {
  BookingStatus,
  HotelStatus,
  OwnerApplicationStatus,
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
  limitedAdminUser: 'seed-user-admin-limited',
  limitedAdminProfile: 'seed-admin-profile-limited',
  ownerUser: 'seed-user-owner',
  ownerBUser: 'seed-user-owner-b',
  travelerUser: 'seed-user-traveler',
  travelerBUser: 'seed-user-traveler-b',
  hotel: 'seed-hotel-blue-horizon',
  hotelB: 'seed-hotel-riverside-hoi-an',
  hotelBDraft: 'seed-hotel-owner-b-draft',
  roomDeluxe: 'seed-room-deluxe-sea-view',
  roomSuperior: 'seed-room-superior-city-view',
  roomB: 'seed-room-riverside-garden-view',
  roomBDraft: 'seed-room-owner-b-draft',
  booking: 'seed-booking-confirmed',
  bookingB: 'seed-booking-owner-b-traveler-b',
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
  const limitedAdmin = await prisma.user.upsert({
    where: { email: 'admin-limited@bookingtravel.vn' },
    update: {
      passwordHash: adminPasswordHash,
      fullName: 'Quản trị viên giới hạn',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
    create: {
      id: IDS.limitedAdminUser,
      email: 'admin-limited@bookingtravel.vn',
      passwordHash: adminPasswordHash,
      fullName: 'Quản trị viên giới hạn',
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
  const ownerB = await prisma.user.upsert({
    where: { email: 'owner-b@bookingtravel.vn' },
    update: {
      passwordHash: ownerPasswordHash,
      fullName: 'Chủ khách sạn B',
      role: UserRole.HOTEL_OWNER,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
    create: {
      id: IDS.ownerBUser,
      email: 'owner-b@bookingtravel.vn',
      passwordHash: ownerPasswordHash,
      fullName: 'Chủ khách sạn B',
      role: UserRole.HOTEL_OWNER,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
  });
  const travelerB = await prisma.user.upsert({
    where: { email: 'traveler-b@bookingtravel.vn' },
    update: {
      passwordHash: travelerPasswordHash,
      fullName: 'Khách du lịch B',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: verifiedAt,
    },
    create: {
      id: IDS.travelerBUser,
      email: 'traveler-b@bookingtravel.vn',
      passwordHash: travelerPasswordHash,
      fullName: 'Khách du lịch B',
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

  for (const demoOwner of [owner, ownerB]) {
    const existing = await prisma.hotelOwnerApplication.findUnique({
      where: { userId: demoOwner.id },
    });
    const application = existing ?? await prisma.hotelOwnerApplication.create({
      data: {
        userId: demoOwner.id,
        status: OwnerApplicationStatus.VERIFIED,
        businessName: `Cơ sở demo của ${demoOwner.fullName}`,
        businessAddress: 'Dữ liệu demo',
        submittedAt: verifiedAt,
        reviewedAt: verifiedAt,
      },
    });
    if (application.status === OwnerApplicationStatus.VERIFIED) {
      await prisma.hotelOwnerProfile.upsert({
        where: { userId: demoOwner.id },
        update: {},
        create: { userId: demoOwner.id, verifiedAt, isActive: true },
      });
    }
  }

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
  await prisma.adminProfile.upsert({
    where: { userId: limitedAdmin.id },
    update: { title: 'Limited Administrator', permissions: [] },
    create: {
      id: IDS.limitedAdminProfile,
      userId: limitedAdmin.id,
      title: 'Limited Administrator',
      permissions: [],
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
  const hotelB = await prisma.hotel.upsert({
    where: { slug: 'riverside-homestay-hoi-an' },
    update: { ownerId: ownerB.id, status: HotelStatus.APPROVED },
    create: {
      id: IDS.hotelB,
      ownerId: ownerB.id,
      name: 'Riverside Homestay Hoi An',
      slug: 'riverside-homestay-hoi-an',
      description: 'Homestay ven sông dành cho khách du lịch Hội An.',
      addressLine: '24 Nguyễn Phúc Tần',
      city: 'Hội An',
      province: 'Quảng Nam',
      latitude: 15.877,
      longitude: 108.327,
      starRating: 3,
      status: HotelStatus.APPROVED,
      amenities: ['Wi-Fi', 'Bữa sáng', 'Gần phố cổ'],
    },
  });
  const hotelBDraft = await prisma.hotel.upsert({
    where: { slug: 'owner-b-private-draft' },
    update: { ownerId: ownerB.id, status: HotelStatus.DRAFT },
    create: {
      id: IDS.hotelBDraft,
      ownerId: ownerB.id,
      name: 'Owner B Private Draft',
      slug: 'owner-b-private-draft',
      description:
        'Dữ liệu mẫu để kiểm tra quyền xem khách sạn chưa công khai.',
      addressLine: '26 Nguyễn Phúc Tần',
      city: 'Hội An',
      province: 'Quảng Nam',
      status: HotelStatus.DRAFT,
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
  const roomB = await prisma.room.upsert({
    where: { id: IDS.roomB },
    update: { hotelId: hotelB.id, status: RoomStatus.ACTIVE },
    create: {
      id: IDS.roomB,
      hotelId: hotelB.id,
      name: 'Garden View',
      type: 'STANDARD',
      description: 'Phòng hướng vườn, dành cho hai người lớn.',
      capacityAdults: 2,
      capacityChildren: 0,
      bedInfo: '1 giường đôi',
      quantity: 3,
      basePrice: 980000,
      status: RoomStatus.ACTIVE,
      amenities: ['Wi-Fi', 'Điều hòa', 'Hướng vườn'],
    },
  });
  await prisma.room.upsert({
    where: { id: IDS.roomBDraft },
    update: { hotelId: hotelBDraft.id, status: RoomStatus.ACTIVE },
    create: {
      id: IDS.roomBDraft,
      hotelId: hotelBDraft.id,
      name: 'Private Draft Room',
      type: 'STANDARD',
      description: 'Phòng mẫu thuộc khách sạn chưa công khai của Owner B.',
      capacityAdults: 2,
      bedInfo: '1 giường đôi',
      quantity: 1,
      basePrice: 790000,
      status: RoomStatus.ACTIVE,
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
  await prisma.booking.upsert({
    where: { code: 'BT-DEMO-002' },
    update: {
      userId: travelerB.id,
      hotelId: hotelB.id,
      roomId: roomB.id,
      status: BookingStatus.CONFIRMED,
    },
    create: {
      id: IDS.bookingB,
      code: 'BT-DEMO-002',
      userId: travelerB.id,
      hotelId: hotelB.id,
      roomId: roomB.id,
      checkIn: new Date('2026-12-15T00:00:00.000Z'),
      checkOut: new Date('2026-12-17T00:00:00.000Z'),
      adults: 2,
      children: 0,
      roomCount: 1,
      nights: 2,
      pricePerNight: 980000,
      totalAmount: 1960000,
      status: BookingStatus.CONFIRMED,
      guestName: 'Khách du lịch B',
      guestEmail: 'traveler-b@bookingtravel.vn',
    },
  });

  console.log(
    'Seed hoàn tất: 6 tài khoản đăng nhập, 2 admins, 3 hotels, 4 rooms, 2 bookings.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
