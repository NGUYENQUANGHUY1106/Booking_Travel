import {
  BookingStatus,
  HotelStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  RoomStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { compare } from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_MESSAGE_IDS = [
  'seed-message-traveler-question',
  'seed-message-owner-reply',
  'seed-message-traveler-unread',
] as const;

const ACCOUNTS = [
  {
    email: 'admin@bookingtravel.vn',
    password: 'admin123',
    role: UserRole.ADMIN,
  },
  {
    email: 'owner@bookingtravel.vn',
    password: 'owner123',
    role: UserRole.HOTEL_OWNER,
  },
  {
    email: 'traveler@bookingtravel.vn',
    password: 'traveler123',
    role: UserRole.USER,
  },
] as const;

async function main() {
  const failures: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
  };

  const users = await prisma.user.findMany({
    where: { email: { in: ACCOUNTS.map(({ email }) => email) } },
    include: { adminProfile: true, ownerProfile: true },
  });
  for (const expected of ACCOUNTS) {
    const user = users.find(({ email }) => email === expected.email);
    check(Boolean(user), `Thiếu tài khoản ${expected.email}`);
    if (!user) continue;
    check(user.role === expected.role, `${expected.email} sai role`);
    check(
      user.status === UserStatus.ACTIVE && user.isActive,
      `${expected.email} chưa ACTIVE`,
    );
    check(
      await compare(expected.password, user.passwordHash),
      `${expected.email} sai mật khẩu demo`,
    );
    if (expected.role === UserRole.ADMIN) {
      check(Boolean(user.adminProfile), 'Admin thiếu AdminProfile');
    }
    if (expected.role === UserRole.HOTEL_OWNER) {
      check(
        Boolean(user.ownerProfile?.isActive),
        'Hotel Owner thiếu profile đã xác minh',
      );
    }
  }

  const owner = users.find(({ role }) => role === UserRole.HOTEL_OWNER);
  const traveler = users.find(({ role }) => role === UserRole.USER);
  const travelerId = traveler?.id ?? '__missing_demo_traveler__';
  const hotel = await prisma.hotel.findUnique({
    where: { slug: 'blue-horizon-my-khe-hotel' },
    include: {
      rooms: { where: { deletedAt: null } },
      bookings: { where: { code: 'BT-DEMO-001' } },
      conversations: {
        where: { userId: travelerId },
        include: {
          messages: {
            where: { id: { in: [...DEMO_MESSAGE_IDS] } },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
  check(Boolean(hotel), 'Thiếu khách sạn Blue Horizon');
  if (hotel) {
    check(hotel.ownerId === owner?.id, 'Khách sạn demo sai chủ sở hữu');
    check(
      hotel.status === HotelStatus.APPROVED && hotel.isVisible,
      'Khách sạn demo chưa được công khai',
    );
    check(
      hotel.rooms.length === 2 &&
        hotel.rooms.every(({ status }) => status === RoomStatus.ACTIVE),
      'Khách sạn demo phải có 2 hạng phòng ACTIVE',
    );
    check(
      hotel.bookings.length === 1 &&
        hotel.bookings[0].status === BookingStatus.CONFIRMED,
      'Thiếu booking BT-DEMO-001 đã xác nhận',
    );
    const conversation = hotel.conversations[0];
    check(Boolean(conversation), 'Thiếu hội thoại User ↔ Hotel Owner');
    if (conversation) {
      check(conversation.ownerId === owner?.id, 'Hội thoại sai Hotel Owner');
      check(conversation.messages.length === 3, 'Hội thoại phải có 3 tin nhắn');
      check(
        conversation.messages.filter(({ readAt }) => !readAt).length === 1,
        'Hội thoại phải có đúng 1 tin chưa đọc',
      );
    }
  }

  const [inventoryBlock, inventoryOverride] = await Promise.all([
    prisma.roomInventoryBlock.findUnique({
      where: { idempotencyKey: 'seed:block:deluxe:2026-12-20' },
    }),
    prisma.roomInventoryOverride.findUnique({
      where: {
        roomId_date: {
          roomId: 'seed-room-deluxe-sea-view',
          date: new Date('2026-12-24T00:00:00.000Z'),
        },
      },
    }),
  ]);
  check(
    Boolean(inventoryBlock?.active && inventoryBlock.quantity === 1),
    'Thiếu block inventory demo',
  );
  check(inventoryOverride?.sellableQty === 3, 'Thiếu override inventory demo');

  const payment = await prisma.payment.findUnique({
    where: { reference: 'PAY-DEMO-001' },
    include: { booking: true },
  });
  check(Boolean(payment), 'Thiếu payment PAY-DEMO-001');
  if (payment) {
    check(payment.userId === travelerId, 'Payment demo sai User');
    check(payment.booking.code === 'BT-DEMO-001', 'Payment demo sai Booking');
    check(
      payment.amount.equals(payment.booking.totalAmount),
      'Payment demo sai số tiền',
    );
    check(
      payment.method === PaymentMethod.PAY_AT_HOTEL &&
        payment.status === PaymentStatus.PENDING,
      'Payment demo sai phương thức hoặc trạng thái',
    );
  }

  if (failures.length) {
    throw new Error(`Seed không hợp lệ:\n- ${failures.join('\n- ')}`);
  }
  console.log(
    'Seed hợp lệ: 3 roles đăng nhập được; ownership, hotel, rooms, booking, payment, inventory và chat đều đúng.',
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
