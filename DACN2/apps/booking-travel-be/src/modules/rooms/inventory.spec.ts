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
});
