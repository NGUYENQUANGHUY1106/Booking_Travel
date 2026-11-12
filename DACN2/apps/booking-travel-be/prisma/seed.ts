import {
  AccommodationPreferenceType,
  BookingStatus,
  HotelMediaStatus,
  HotelStatus,
  OwnerApplicationStatus,
  PrismaClient,
  RoomStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const prisma = new PrismaClient();
const PASSWORD_HASH_ROUNDS = 12;
const DEMO_REFERENCE_DATE = new Date('2026-11-01T00:00:00.000Z');

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
  inventoryBlock: 'seed-inventory-block-deluxe',
  conversation: 'seed-conversation-blue-horizon',
  travelerMessage: 'seed-message-traveler-question',
  ownerMessage: 'seed-message-owner-reply',
  unreadMessage: 'seed-message-traveler-unread',
  amenityPool: 'seed-amenity-pool',
  amenityWifi: 'seed-amenity-wifi',
  amenityBreakfast: 'seed-amenity-breakfast',
} as const;

type HotelMediaSeed = {
  hotelId: string;
  ownerId: string;
  prefix: string;
  assets: readonly string[];
};

async function reusablePasswordHash(email: string, password: string) {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });
  if (existing && (await compare(password, existing.passwordHash))) {
    return existing.passwordHash;
  }
  return hash(password, PASSWORD_HASH_ROUNDS);
}

async function seedHotelMedia(groups: readonly HotelMediaSeed[]) {
  if (
    process.env.R2_ENDPOINT ||
    process.env.R2_BUCKET ||
    process.env.R2_ACCESS_KEY_ID
  ) {
    console.log('Bỏ qua ảnh seed local vì môi trường đang cấu hình R2.');
    return 0;
  }
  const storageDirectory = resolve(
    process.env.LOCAL_MEDIA_DIR ?? '../../.local-media',
  );
  const assetDirectory = resolve(
    __dirname,
    '../../booking-travel-app/src/features/traveler/assets',
  );
  await mkdir(storageDirectory, { recursive: true });
  let created = 0;

  for (const group of groups) {
    const existingCover = await prisma.hotelMedia.findFirst({
      where: {
        hotelId: group.hotelId,
        roomId: null,
        isCover: true,
        status: HotelMediaStatus.READY,
        deletedAt: null,
        id: { not: `${group.prefix}01` },
      },
      select: { id: true },
    });
    for (const [index, asset] of group.assets.entries()) {
      const position = String(index + 1).padStart(2, '0');
      const id = `${group.prefix}${position}`;
      const source = resolve(assetDirectory, asset);
      const destination = resolve(storageDirectory, id);
      await copyFile(source, destination);
      const file = await stat(destination);
      const previous = await prisma.hotelMedia.findUnique({
        where: { id },
        select: { id: true },
      });
      await prisma.hotelMedia.upsert({
        where: { id },
        update: {
          hotelId: group.hotelId,
          roomId: null,
          ownerId: group.ownerId,
          objectKey: `seed/hotels/${group.hotelId}/${position}.jpg`,
          mimeType: 'image/jpeg',
          expectedSize: file.size,
          status: HotelMediaStatus.READY,
          sortOrder: index,
          isCover: !existingCover && index === 0,
          verifiedAt: DEMO_REFERENCE_DATE,
          deletedAt: null,
        },
        create: {
          id,
          hotelId: group.hotelId,
          roomId: null,
          ownerId: group.ownerId,
          objectKey: `seed/hotels/${group.hotelId}/${position}.jpg`,
          mimeType: 'image/jpeg',
          expectedSize: file.size,
          status: HotelMediaStatus.READY,
          sortOrder: index,
          isCover: !existingCover && index === 0,
          verifiedAt: DEMO_REFERENCE_DATE,
        },
      });
      if (!previous) created += 1;
    }
  }
  return created;
}

async function main() {
  const [adminPasswordHash, ownerPasswordHash, travelerPasswordHash] =
    await Promise.all([
      reusablePasswordHash(
        DEMO_ACCOUNTS.admin.email,
        DEMO_ACCOUNTS.admin.password,
      ),
      reusablePasswordHash(
        DEMO_ACCOUNTS.owner.email,
        DEMO_ACCOUNTS.owner.password,
      ),
      reusablePasswordHash(
        DEMO_ACCOUNTS.traveler.email,
        DEMO_ACCOUNTS.traveler.password,
      ),
    ]);
  const verifiedAt = DEMO_REFERENCE_DATE;

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
    await prisma.hotelOwnerApplication.upsert({
      where: { userId: demoOwner.id },
      update: {
        status: OwnerApplicationStatus.VERIFIED,
        businessName: `Cơ sở demo của ${demoOwner.fullName}`,
        businessAddress: 'Dữ liệu demo',
        rejectionReason: null,
        submittedAt: verifiedAt,
        reviewedAt: verifiedAt,
      },
      create: {
        userId: demoOwner.id,
        status: OwnerApplicationStatus.VERIFIED,
        businessName: `Cơ sở demo của ${demoOwner.fullName}`,
        businessAddress: 'Dữ liệu demo',
        submittedAt: verifiedAt,
        reviewedAt: verifiedAt,
      },
    });
    await prisma.hotelOwnerProfile.upsert({
      where: { userId: demoOwner.id },
      update: { verifiedAt, isActive: true },
      create: { userId: demoOwner.id, verifiedAt, isActive: true },
    });
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
    update: {
      ownerId: owner.id,
      name: 'Blue Horizon My Khe Hotel',
      description: 'Khách sạn gần biển Mỹ Khê với hồ bơi và phòng hướng biển.',
      addressLine: '38 Võ Nguyên Giáp',
      city: 'Đà Nẵng',
      province: 'Đà Nẵng',
      latitude: 16.0583,
      longitude: 108.2462,
      accommodationType: AccommodationPreferenceType.HOTEL,
      starRating: 4,
      status: HotelStatus.APPROVED,
      isVisible: true,
      amenities: ['Hồ bơi', 'Wi-Fi', 'Bữa sáng', 'Gần biển'],
      deletedAt: null,
    },
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
      accommodationType: AccommodationPreferenceType.HOTEL,
      starRating: 4,
      status: HotelStatus.APPROVED,
      amenities: ['Hồ bơi', 'Wi-Fi', 'Bữa sáng', 'Gần biển'],
    },
  });
  const hotelB = await prisma.hotel.upsert({
    where: { slug: 'riverside-homestay-hoi-an' },
    update: {
      ownerId: ownerB.id,
      name: 'Riverside Homestay Hoi An',
      description: 'Homestay ven sông dành cho khách du lịch Hội An.',
      addressLine: '24 Nguyễn Phúc Tần',
      city: 'Hội An',
      province: 'Quảng Nam',
      latitude: 15.877,
      longitude: 108.327,
      accommodationType: AccommodationPreferenceType.HOMESTAY,
      starRating: 3,
      status: HotelStatus.APPROVED,
      isVisible: true,
      amenities: ['Wi-Fi', 'Bữa sáng', 'Gần phố cổ'],
      deletedAt: null,
    },
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
      accommodationType: AccommodationPreferenceType.HOMESTAY,
      starRating: 3,
      status: HotelStatus.APPROVED,
      amenities: ['Wi-Fi', 'Bữa sáng', 'Gần phố cổ'],
    },
  });

  for (const amenity of [
    { id: IDS.amenityPool, name: 'Hồ bơi' },
    { id: IDS.amenityWifi, name: 'Wi-Fi miễn phí' },
    { id: IDS.amenityBreakfast, name: 'Bữa sáng' },
  ])
    await prisma.amenityCatalog.upsert({
      where: { id: amenity.id },
      update: { name: amenity.name, active: true },
      create: { ...amenity, active: true },
    });
  await prisma.hotelAmenity.createMany({
    data: [
      { hotelId: hotel.id, amenityId: IDS.amenityPool },
      { hotelId: hotel.id, amenityId: IDS.amenityWifi },
      { hotelId: hotel.id, amenityId: IDS.amenityBreakfast },
      { hotelId: hotelB.id, amenityId: IDS.amenityWifi },
      { hotelId: hotelB.id, amenityId: IDS.amenityBreakfast },
    ],
    skipDuplicates: true,
  });
  await prisma.hotelPolicy.upsert({
    where: { hotelId: hotel.id },
    update: {
      cancellationPolicy:
        'Hủy miễn phí trước 18:00 một ngày trước khi nhận phòng.',
    },
    create: {
      hotelId: hotel.id,
      cancellationPolicy:
        'Hủy miễn phí trước 18:00 một ngày trước khi nhận phòng.',
    },
  });
  await prisma.hotelPolicy.upsert({
    where: { hotelId: hotelB.id },
    update: { cancellationPolicy: 'Không hoàn tiền sau khi xác nhận.' },
    create: {
      hotelId: hotelB.id,
      cancellationPolicy: 'Không hoàn tiền sau khi xác nhận.',
    },
  });
  const hotelBDraft = await prisma.hotel.upsert({
    where: { slug: 'owner-b-private-draft' },
    update: {
      ownerId: ownerB.id,
      name: 'Owner B Private Draft',
      description:
        'Dữ liệu mẫu để kiểm tra quyền xem khách sạn chưa công khai.',
      addressLine: '26 Nguyễn Phúc Tần',
      city: 'Hội An',
      province: 'Quảng Nam',
      status: HotelStatus.DRAFT,
      isVisible: true,
      deletedAt: null,
    },
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
    update: {
      hotelId: hotel.id,
      name: 'Deluxe Sea View',
      type: 'DELUXE',
      description: 'Phòng hướng biển, diện tích 32 m².',
      capacityAdults: 2,
      capacityChildren: 1,
      bedInfo: '1 giường King',
      status: RoomStatus.ACTIVE,
      classCode: 'DLX',
      viewCode: 'SEA',
      bedConfigurations: [{ bedType: 'KING', quantity: 1 }],
      areaM2: 32,
      quantity: 5,
      basePrice: 1450000,
      currency: 'VND',
      amenities: ['Hướng biển', 'Điều hòa', 'TV', 'Minibar'],
      deletedAt: null,
    },
    create: {
      id: IDS.roomDeluxe,
      hotelId: hotel.id,
      name: 'Deluxe Sea View',
      type: 'DELUXE',
      description: 'Phòng hướng biển, diện tích 32 m².',
      capacityAdults: 2,
      capacityChildren: 1,
      bedInfo: '1 giường King',
      classCode: 'DLX',
      viewCode: 'SEA',
      bedConfigurations: [{ bedType: 'KING', quantity: 1 }],
      areaM2: 32,
      quantity: 5,
      basePrice: 1450000,
      status: RoomStatus.ACTIVE,
      amenities: ['Hướng biển', 'Điều hòa', 'TV', 'Minibar'],
    },
  });
  await prisma.room.upsert({
    where: { id: IDS.roomSuperior },
    update: {
      hotelId: hotel.id,
      name: 'Superior City View',
      type: 'SUPERIOR',
      description: 'Phòng hướng phố, diện tích 28 m².',
      capacityAdults: 2,
      capacityChildren: 0,
      bedInfo: '1 giường đôi',
      status: RoomStatus.ACTIVE,
      classCode: 'SUP',
      viewCode: 'CITY',
      bedConfigurations: [{ bedType: 'DOUBLE', quantity: 1 }],
      areaM2: 28,
      quantity: 4,
      basePrice: 1180000,
      currency: 'VND',
      amenities: ['Hướng phố', 'Điều hòa', 'TV'],
      deletedAt: null,
    },
    create: {
      id: IDS.roomSuperior,
      hotelId: hotel.id,
      name: 'Superior City View',
      type: 'SUPERIOR',
      description: 'Phòng hướng phố, diện tích 28 m².',
      capacityAdults: 2,
      capacityChildren: 0,
      bedInfo: '1 giường đôi',
      classCode: 'SUP',
      viewCode: 'CITY',
      bedConfigurations: [{ bedType: 'DOUBLE', quantity: 1 }],
      areaM2: 28,
      quantity: 4,
      basePrice: 1180000,
      status: RoomStatus.ACTIVE,
      amenities: ['Hướng phố', 'Điều hòa', 'TV'],
    },
  });
  const roomB = await prisma.room.upsert({
    where: { id: IDS.roomB },
    update: {
      hotelId: hotelB.id,
      name: 'Garden View',
      type: 'STANDARD',
      description: 'Phòng hướng vườn, dành cho hai người lớn.',
      capacityAdults: 2,
      capacityChildren: 0,
      bedInfo: '1 giường đôi',
      status: RoomStatus.ACTIVE,
      classCode: 'STD',
      viewCode: 'GRD',
      bedConfigurations: [{ bedType: 'DOUBLE', quantity: 1 }],
      quantity: 3,
      basePrice: 980000,
      currency: 'VND',
      amenities: ['Wi-Fi', 'Điều hòa', 'Hướng vườn'],
      deletedAt: null,
    },
    create: {
      id: IDS.roomB,
      hotelId: hotelB.id,
      name: 'Garden View',
      type: 'STANDARD',
      description: 'Phòng hướng vườn, dành cho hai người lớn.',
      capacityAdults: 2,
      capacityChildren: 0,
      bedInfo: '1 giường đôi',
      classCode: 'STD',
      viewCode: 'GRD',
      bedConfigurations: [{ bedType: 'DOUBLE', quantity: 1 }],
      quantity: 3,
      basePrice: 980000,
      status: RoomStatus.ACTIVE,
      amenities: ['Wi-Fi', 'Điều hòa', 'Hướng vườn'],
    },
  });
  await prisma.room.upsert({
    where: { id: IDS.roomBDraft },
    update: {
      hotelId: hotelBDraft.id,
      name: 'Private Draft Room',
      type: 'STANDARD',
      description: 'Phòng mẫu thuộc khách sạn chưa công khai của Owner B.',
      capacityAdults: 2,
      capacityChildren: 0,
      bedInfo: '1 giường đôi',
      quantity: 1,
      basePrice: 790000,
      currency: 'VND',
      status: RoomStatus.ACTIVE,
      deletedAt: null,
    },
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
      roomNameSnapshot: 'Deluxe Sea View',
      roomTypeSnapshot: 'DELUXE',
      checkIn: new Date('2026-12-10T00:00:00.000Z'),
      checkOut: new Date('2026-12-13T00:00:00.000Z'),
      adults: 2,
      children: 0,
      roomCount: 1,
      nights: 3,
      pricePerNight: 1450000,
      totalAmount: 4350000,
      currency: 'VND',
      status: BookingStatus.CONFIRMED,
      guestName: 'Khách du lịch Demo',
      guestEmail: DEMO_ACCOUNTS.traveler.email,
      guestPhone: '0912345678',
      note: null,
      cancelledAt: null,
    },
    create: {
      id: IDS.booking,
      code: 'BT-DEMO-001',
      userId: traveler.id,
      hotelId: hotel.id,
      roomId: IDS.roomDeluxe,
      roomNameSnapshot: 'Deluxe Sea View',
      roomTypeSnapshot: 'DELUXE',
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
      roomNameSnapshot: roomB.name,
      roomTypeSnapshot: roomB.type,
      checkIn: new Date('2026-12-15T00:00:00.000Z'),
      checkOut: new Date('2026-12-17T00:00:00.000Z'),
      adults: 2,
      children: 0,
      roomCount: 1,
      nights: 2,
      pricePerNight: 980000,
      totalAmount: 1960000,
      currency: 'VND',
      status: BookingStatus.CONFIRMED,
      guestName: 'Khách du lịch B',
      guestEmail: 'traveler-b@bookingtravel.vn',
      guestPhone: null,
      note: null,
      cancelledAt: null,
    },
    create: {
      id: IDS.bookingB,
      code: 'BT-DEMO-002',
      userId: travelerB.id,
      hotelId: hotelB.id,
      roomId: roomB.id,
      roomNameSnapshot: roomB.name,
      roomTypeSnapshot: roomB.type,
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

  await prisma.roomInventoryBlock.upsert({
    where: { idempotencyKey: 'seed:block:deluxe:2026-12-20' },
    update: {
      roomId: IDS.roomDeluxe,
      hotelId: hotel.id,
      actorId: owner.id,
      startDate: new Date('2026-12-20T00:00:00.000Z'),
      endDateExclusive: new Date('2026-12-22T00:00:00.000Z'),
      quantity: 1,
      reason: 'Bảo trì phòng demo',
      active: true,
      releasedAt: null,
    },
    create: {
      id: IDS.inventoryBlock,
      roomId: IDS.roomDeluxe,
      hotelId: hotel.id,
      actorId: owner.id,
      startDate: new Date('2026-12-20T00:00:00.000Z'),
      endDateExclusive: new Date('2026-12-22T00:00:00.000Z'),
      quantity: 1,
      reason: 'Bảo trì phòng demo',
      idempotencyKey: 'seed:block:deluxe:2026-12-20',
    },
  });
  await prisma.roomInventoryOverride.upsert({
    where: {
      roomId_date: {
        roomId: IDS.roomDeluxe,
        date: new Date('2026-12-24T00:00:00.000Z'),
      },
    },
    update: { sellableQty: 3 },
    create: {
      roomId: IDS.roomDeluxe,
      date: new Date('2026-12-24T00:00:00.000Z'),
      sellableQty: 3,
    },
  });

  const conversation = await prisma.conversation.upsert({
    where: {
      userId_hotelId: { userId: traveler.id, hotelId: hotel.id },
    },
    update: { ownerId: owner.id },
    create: {
      id: IDS.conversation,
      userId: traveler.id,
      ownerId: owner.id,
      hotelId: hotel.id,
    },
  });
  const demoMessages = [
    {
      id: IDS.travelerMessage,
      senderId: traveler.id,
      content: 'Xin chào, khách sạn còn phòng hướng biển không?',
      createdAt: new Date('2026-11-01T08:00:00.000Z'),
      readAt: new Date('2026-11-01T08:01:00.000Z'),
    },
    {
      id: IDS.ownerMessage,
      senderId: owner.id,
      content: 'Chào bạn, hạng Deluxe Sea View vẫn còn phòng.',
      createdAt: new Date('2026-11-01T08:02:00.000Z'),
      readAt: new Date('2026-11-01T08:03:00.000Z'),
    },
    {
      id: IDS.unreadMessage,
      senderId: traveler.id,
      content: 'Tôi muốn đặt cho 2 người từ ngày 10 đến 13/12.',
      createdAt: new Date('2026-11-01T08:04:00.000Z'),
      readAt: null,
    },
  ] as const;
  for (const message of demoMessages) {
    await prisma.message.upsert({
      where: { id: message.id },
      update: {
        conversationId: conversation.id,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt,
        readAt: message.readAt,
      },
      create: {
        ...message,
        conversationId: conversation.id,
      },
    });
  }

  const mediaCreated = await seedHotelMedia([
    {
      hotelId: hotel.id,
      ownerId: hotel.ownerId,
      prefix: 'seedblue',
      assets: ['a83c5.png', '9d43f.png', 'a6086.png', 'b561a.png'],
    },
    {
      hotelId: hotelB.id,
      ownerId: hotelB.ownerId,
      prefix: 'seedriverside',
      assets: ['b561a.png', 'a83c5.png', '9d43f.png', 'a6086.png'],
    },
  ]);

  console.log(
    `Seed hoàn tất: 6 tài khoản, 3 roles, 3 hotels, 4 rooms, 2 bookings, 1 inventory block, 1 conversation, 3 messages, ${mediaCreated} ảnh khách sạn mới.`,
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
