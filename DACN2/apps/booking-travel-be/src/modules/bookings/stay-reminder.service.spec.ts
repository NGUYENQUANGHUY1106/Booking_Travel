import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  scheduledStayDateTime,
  StayReminderService,
} from './stay-reminder.service';

describe('StayReminderService', () => {
  it('builds reminder time from the stay date and configured time', () => {
    const date = new Date('2026-12-01T00:00:00.000Z');
    expect(scheduledStayDateTime(date, '14:30', '14:00').toISOString()).toBe(
      '2026-12-01T07:30:00.000Z',
    );
  });

  it('lists reminders only for the requested booking and user', async () => {
    const prisma = {
      stayReminder: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const notifications = {} as NotificationsService;
    const service = new StayReminderService(
      prisma as unknown as PrismaService,
      notifications,
    );

    await service.listForBooking('user-1', 'booking-1');
    expect(prisma.stayReminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', bookingId: 'booking-1' },
      }),
    );
  });

  it('sends a 24-hour check-in reminder once', async () => {
    const now = new Date('2026-12-01T15:00:00.000+07:00');
    jest.useFakeTimers().setSystemTime(now);
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'booking-1',
            code: 'BT-12345678',
            userId: 'user-1',
            hotelNameSnapshot: 'Khách sạn Biển',
            status: BookingStatus.CONFIRMED,
            checkIn: new Date('2026-12-02T00:00:00.000Z'),
            checkOut: new Date('2026-12-03T00:00:00.000Z'),
            checkInTimeSnapshot: '14:00',
            checkOutTimeSnapshot: '12:00',
            hotel: { checkInTime: '14:00', checkOutTime: '12:00' },
          },
        ]),
      },
      stayReminder: {
        create: jest.fn().mockResolvedValue({ id: 'reminder-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const createNotification = jest
      .fn()
      .mockResolvedValue({ id: 'notification-1' });
    const notifications = {
      createNotification,
    } as unknown as NotificationsService;
    const service = new StayReminderService(
      prisma as unknown as PrismaService,
      notifications,
    );

    const result = await service.sweep();
    expect(result.sent).toBe(1);
    expect(prisma.stayReminder.create).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
