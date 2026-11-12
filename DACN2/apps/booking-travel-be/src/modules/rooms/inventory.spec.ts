import { BadRequestException } from '@nestjs/common';
import {
  calculateInventoryDays,
  inventoryRange,
  minimumAvailable,
} from './inventory';

describe('room inventory per night', () => {
  const dates = inventoryRange('2026-12-12', '2026-12-16');
  const booking = {
    checkIn: new Date('2026-12-12'),
    checkOut: new Date('2026-12-15'),
    roomCount: 4,
  };
  const block = {
    startDate: new Date('2026-12-12'),
    endDateExclusive: new Date('2026-12-15'),
    quantity: 3,
  };

  it('counts check-in nights but excludes check-out, with partial blocks', () => {
    const result = calculateInventoryDays(dates, 10, [booking], [block], []);
    expect(result.map((day) => day.available)).toEqual([3, 3, 3, 10]);
    expect(minimumAvailable(result.slice(0, 3))).toBe(3);
    expect(minimumAvailable(result.slice(3))).toBe(10);
  });

  it('applies sellable capacity before deducting booked and blocked rooms', () => {
    const result = calculateInventoryDays(
      dates.slice(0, 1),
      10,
      [booking],
      [block],
      [{ date: dates[0], sellableQty: 8 }],
    );
    expect(result[0]).toMatchObject({
      effectiveCapacity: 8,
      booked: 4,
      blocked: 3,
      available: 1,
    });
  });

  it('uses calendar dates across leap days and rejects invalid ranges', () => {
    expect(
      inventoryRange('2028-02-28', '2028-03-02').map((date) =>
        date.toISOString().slice(0, 10),
      ),
    ).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
    expect(() => inventoryRange('2026-02-29', '2026-03-01')).toThrow(
      BadRequestException,
    );
    expect(() => inventoryRange('2026-12-15', '2026-12-12')).toThrow(
      BadRequestException,
    );
  });

  it('uses the minimum of every occupied night and returns the actual shortfall', () => {
    const stay = inventoryRange('2026-12-12', '2026-12-15');
    const days = calculateInventoryDays(
      stay,
      5,
      [
        {
          checkIn: new Date('2026-12-13'),
          checkOut: new Date('2026-12-14'),
          roomCount: 1,
        },
        {
          checkIn: new Date('2026-12-14'),
          checkOut: new Date('2026-12-15'),
          roomCount: 3,
        },
      ],
      [
        {
          startDate: new Date('2026-12-13'),
          endDateExclusive: new Date('2026-12-14'),
          quantity: 2,
        },
      ],
      [],
    );
    expect(days.map((day) => day.available)).toEqual([5, 2, 2]);
    expect(minimumAvailable(days)).toBe(2);
    expect(minimumAvailable(days.slice(0, 2))).toBe(2);
  });

  it('clamps inconsistent occupied inventory to zero and marks the oversold day', () => {
    const stay = inventoryRange('2026-12-12', '2026-12-14');
    const days = calculateInventoryDays(
      stay,
      2,
      [{ checkIn: stay[0], checkOut: stay[1], roomCount: 2 }],
      [{ startDate: stay[0], endDateExclusive: stay[1], quantity: 1 }],
      [],
    );
    expect(days[0]).toMatchObject({ available: 0, oversold: true });
    expect(days[1]).toMatchObject({ available: 2, oversold: false });
  });
});
