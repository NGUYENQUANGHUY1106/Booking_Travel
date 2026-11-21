import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    userNotification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    pushDeviceToken: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it('lists only the current user notifications newest first', async () => {
    prisma.userNotification.findMany.mockResolvedValue([
      { id: 'notification-1', title: 'Đặt phòng thành công' },
    ]);

    await expect(service.list('user-1')).resolves.toEqual([
      { id: 'notification-1', title: 'Đặt phòng thành công' },
    ]);
    expect(prisma.userNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
  });

  it('returns unread count', async () => {
    prisma.userNotification.count.mockResolvedValue(3);
    await expect(service.unreadCount('user-1')).resolves.toEqual({ count: 3 });
  });

  it('marks a notification read only when it belongs to the user', async () => {
    prisma.userNotification.findFirst.mockResolvedValue({
      id: 'notification-1',
    });
    prisma.userNotification.update.mockResolvedValue({
      id: 'notification-1',
      readAt: new Date(),
    });

    await expect(
      service.markRead('user-1', 'notification-1'),
    ).resolves.toMatchObject({ id: 'notification-1' });

    prisma.userNotification.findFirst.mockResolvedValue(null);
    await expect(
      service.markRead('user-1', 'notification-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks all unread notifications as read', async () => {
    prisma.userNotification.updateMany.mockResolvedValue({ count: 4 });
    await expect(service.readAll('user-1')).resolves.toEqual({ updated: 4 });
  });

  it('registers and revokes a push token with user ownership', async () => {
    prisma.pushDeviceToken.upsert.mockResolvedValue({
      id: 'device-1',
      enabled: true,
    });
    await expect(
      service.registerDevice('user-1', {
        token: 'ExpoPushToken[test-token]',
        platform: 'android',
      }),
    ).resolves.toMatchObject({ enabled: true });

    prisma.pushDeviceToken.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      service.revokeDevice('user-1', 'ExpoPushToken[test-token]'),
    ).resolves.toEqual({ revoked: true });
  });

  it('creates an in-app notification and skips push when no Expo device is registered', async () => {
    prisma.userNotification.create.mockResolvedValue({
      id: 'notification-1',
      type: 'BOOKING_CONFIRMED',
    });
    prisma.pushDeviceToken.findMany.mockResolvedValue([]);

    await expect(
      service.createNotification({
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Đặt phòng thành công',
        body: 'Đơn đặt phòng của bạn đã được xác nhận.',
      }),
    ).resolves.toMatchObject({
      id: 'notification-1',
      type: 'BOOKING_CONFIRMED',
    });
  });
});
