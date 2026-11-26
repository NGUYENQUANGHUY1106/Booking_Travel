import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StayCompletionService } from './stay-completion.service';

const checkout = new Date('2026-11-21T00:00:00.000Z');
const candidate = {
  id: 'booking-a',
  checkOut: checkout,
  checkOutTimeSnapshot: '22:00',
  hotel: { checkOutTime: '12:00' },
};

function subject(now: Date, status: BookingStatus = BookingStatus.CHECKED_IN) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ now }]),
    booking: {
      findUnique: jest.fn().mockResolvedValue({
        ...candidate,
        hotelId: 'hotel-a',
        roomId: 'room-a',
        roomCount: 1,
        status,
        hotel: { ownerId: 'owner-a', checkOutTime: '12:00' },
        refundRequests: [],
        payments: [],
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    bookingStayTransition: { create: jest.fn().mockResolvedValue({}) },
    roomInventoryBlock: {
      create: jest.fn().mockResolvedValue({ id: 'block-a' }),
    },
    stayHandoverAlert: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    booking: { findMany: jest.fn().mockResolvedValue([candidate]) },
    $transaction: jest
      .fn()
      .mockImplementation((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
  };
  return {
    service: new StayCompletionService(prisma as unknown as PrismaService),
    tx,
    prisma,
  };
}

describe('StayCompletionService', () => {
  afterEach(() => jest.useRealTimers());

  it('leaves a checked-in booking untouched before 22 Nov 00:00 Vietnam time', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-21T16:59:59.000Z'));
    const { service, tx } = subject(new Date());
    expect(await service.sweep()).toMatchObject({ completed: 0 });
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it('completes at the grace boundary without fabricating actual checkout, and blocks inventory pending handover', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-21T17:00:00.000Z'));
    const { service, tx } = subject(new Date());
    expect(await service.sweep()).toMatchObject({ completed: 1 });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-a', status: BookingStatus.CHECKED_IN },
      data: {
        status: BookingStatus.COMPLETED,
        completedAt: new Date(),
        completionMethod: 'AUTO_AFTER_GRACE_PERIOD',
      },
    });
    const created = tx.bookingStayTransition.create.mock
      .calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect(created[0].data).toMatchObject({
      action: 'CHECK_OUT',
      actorId: null,
    });
    expect(tx.roomInventoryBlock.create).toHaveBeenCalledTimes(1);
    expect(tx.stayHandoverAlert.create).toHaveBeenCalledTimes(1);
  });

  it('does not create another completion if manual checkout won the lock', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-21T17:00:00.000Z'));
    const { service, tx } = subject(new Date(), BookingStatus.COMPLETED);
    expect(await service.sweep()).toMatchObject({ completed: 0 });
    expect(tx.bookingStayTransition.create).not.toHaveBeenCalled();
  });
});
