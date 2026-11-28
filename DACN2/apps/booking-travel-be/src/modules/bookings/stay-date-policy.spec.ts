import { stayDatePolicy } from './stay-date-policy';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const base = {
  checkIn: date('2026-11-18'),
  checkOut: date('2026-11-19'),
  checkInTime: '14:00',
  checkOutTime: '12:00',
};

describe('stayDatePolicy', () => {
  it('uses Vietnam local date and configured check-in time at the boundary', () => {
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_IN',
        now: new Date('2026-11-18T06:59:00Z'),
      }).eligible,
    ).toBe(false);
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_IN',
        now: new Date('2026-11-18T07:00:00Z'),
      }).eligible,
    ).toBe(true);
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_IN',
        now: new Date('2026-11-18T16:59:00Z'),
      }).eligible,
    ).toBe(true);
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_IN',
        now: new Date('2026-11-18T17:00:00Z'),
      }).eligible,
    ).toBe(false);
  });

  it('allows the owner to record a late arrival by booking code, but never before check-in', () => {
    const input = {
      ...base,
      action: 'CHECK_IN' as const,
      allowLateCheckIn: true,
    };
    expect(
      stayDatePolicy({ ...input, now: new Date('2026-11-18T06:59:00Z') })
        .eligible,
    ).toBe(false);
    expect(
      stayDatePolicy({ ...input, now: new Date('2026-11-21T07:00:00Z') })
        .eligible,
    ).toBe(true);
  });

  it('allows checkout through the two-hour grace period across midnight', () => {
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_OUT',
        now: new Date('2026-11-18T16:59:00Z'),
      }).eligible,
    ).toBe(false);
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_OUT',
        now: new Date('2026-11-18T17:00:00Z'),
      }).eligible,
    ).toBe(true);
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_OUT',
        now: new Date('2026-11-19T05:00:00Z'),
      }).eligible,
    ).toBe(true);
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_OUT',
        now: new Date('2026-11-19T07:00:00Z'),
      }).eligible,
    ).toBe(true);
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_OUT',
        now: new Date('2026-11-19T07:00:01Z'),
      }).eligible,
    ).toBe(false);
    const late = {
      ...base,
      checkOut: date('2026-11-21'),
      checkOutTime: '22:00',
    };
    expect(
      stayDatePolicy({
        ...late,
        action: 'CHECK_OUT',
        now: new Date('2026-11-21T17:00:00Z'),
      }).eligible,
    ).toBe(true);
    expect(
      stayDatePolicy({
        ...late,
        action: 'CHECK_OUT',
        now: new Date('2026-11-21T17:00:01Z'),
      }).eligible,
    ).toBe(false);
  });

  it('fails closed when the hotel has no configured time', () => {
    expect(
      stayDatePolicy({
        ...base,
        action: 'CHECK_IN',
        checkInTime: null,
        now: new Date('2026-11-18T07:00:00Z'),
      }),
    ).toMatchObject({ eligible: false, code: 'STAY_TIME_NOT_CONFIGURED' });
  });
});
