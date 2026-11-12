import { BadRequestException } from '@nestjs/common';
import { Prisma, RoomPricingRuleKind } from '@prisma/client';
import {
  findRuleConflict,
  pricingDates,
  resolveNightlyRates,
  type PricingRuleLike,
} from './pricing.domain';

const rule = (
  id: string,
  kind: RoomPricingRuleKind,
  price: string,
  startDate = '2028-02-26',
  endDateExclusive = '2028-03-03',
): PricingRuleLike => ({
  id,
  kind,
  price: new Prisma.Decimal(price),
  startDate: new Date(`${startDate}T00:00:00Z`),
  endDateExclusive: new Date(`${endDateExclusive}T00:00:00Z`),
  active: true,
});

describe('ST-OWN-09 effective nightly pricing', () => {
  it('uses date > holiday > season > weekend/weekday > base and ignores checkout', () => {
    const dates = pricingDates('2028-02-28', '2028-03-03');
    const rates = resolveNightlyRates(new Prisma.Decimal('1000000'), dates, [
      rule('weekend', 'WEEKEND', '1200000'),
      rule('season', 'SEASON', '1400000'),
      rule('holiday', 'HOLIDAY', '1600000', '2028-02-29', '2028-03-02'),
      rule('specific', 'DATE', '1800000', '2028-03-01', '2028-03-02'),
    ]);
    expect(
      rates.map((item) => [item.date, item.price.toString(), item.source]),
    ).toEqual([
      ['2028-02-28', '1400000', 'SEASON'],
      ['2028-02-29', '1600000', 'HOLIDAY'],
      ['2028-03-01', '1800000', 'DATE'],
      ['2028-03-02', '1400000', 'SEASON'],
    ]);
  });

  it('falls back to lower priority after removing a rule', () => {
    const date = pricingDates('2028-02-29', '2028-03-01');
    const season = rule('season', 'SEASON', '1400000');
    const holiday = rule('holiday', 'HOLIDAY', '1600000');
    expect(
      resolveNightlyRates(new Prisma.Decimal('1000000'), date, [
        season,
        holiday,
      ])[0].price.toString(),
    ).toBe('1600000');
    expect(
      resolveNightlyRates(new Prisma.Decimal('1000000'), date, [
        season,
      ])[0].price.toString(),
    ).toBe('1400000');
  });

  it('rejects overlapping same-priority rules only on applicable nights', () => {
    expect(
      findRuleConflict(
        rule('new', 'DATE', '1800000', '2028-03-01', '2028-03-03'),
        [rule('existing', 'DATE', '1900000', '2028-03-02', '2028-03-04')],
      ),
    ).toEqual({ ruleId: 'existing', date: '2028-03-02' });
    expect(
      findRuleConflict(rule('weekday', 'WEEKDAY', '1200000'), [
        rule('weekend', 'WEEKEND', '1300000'),
      ]),
    ).toBeNull();
  });

  it('rejects invalid dates and intervals', () => {
    expect(() => pricingDates('2028-02-30', '2028-03-02')).toThrow(
      BadRequestException,
    );
    expect(() => pricingDates('2028-03-02', '2028-03-02')).toThrow(
      BadRequestException,
    );
  });
});
