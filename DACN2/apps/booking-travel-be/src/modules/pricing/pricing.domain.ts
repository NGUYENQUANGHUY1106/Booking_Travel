import { BadRequestException } from '@nestjs/common';
import { Prisma, RoomPricingRuleKind } from '@prisma/client';
import { inventoryDate } from '../rooms/inventory';

export type PricingRuleLike = {
  id: string;
  kind: RoomPricingRuleKind;
  startDate: Date;
  endDateExclusive: Date;
  price: Prisma.Decimal;
  active: boolean;
};

const DAY_MS = 86_400_000;
export const RULE_PRIORITY: Record<RoomPricingRuleKind, number> = {
  DATE: 4,
  HOLIDAY: 3,
  SEASON: 2,
  WEEKDAY: 1,
  WEEKEND: 1,
};

export function pricingDates(start: string, endExclusive: string): Date[] {
  const from = inventoryDate(start).getTime();
  const to = inventoryDate(endExclusive).getTime();
  const length = (to - from) / DAY_MS;
  if (!Number.isInteger(length) || length < 1 || length > 366)
    throw new BadRequestException(
      'Khoảng giá phải từ 1 đến 366 đêm; ngày kết thúc không tính.',
    );
  return Array.from({ length }, (_, index) => new Date(from + index * DAY_MS));
}

export function ruleApplies(rule: PricingRuleLike, date: Date): boolean {
  const at = date.getTime();
  if (
    !rule.active ||
    at < rule.startDate.getTime() ||
    at >= rule.endDateExclusive.getTime()
  )
    return false;
  const day = date.getUTCDay();
  if (rule.kind === 'WEEKDAY') return day !== 0 && day !== 6;
  if (rule.kind === 'WEEKEND') return day === 0 || day === 6;
  return true;
}

export function findRuleConflict(
  candidate: PricingRuleLike,
  rules: PricingRuleLike[],
): { ruleId: string; date: string } | null {
  const dates = pricingDates(
    candidate.startDate.toISOString().slice(0, 10),
    candidate.endDateExclusive.toISOString().slice(0, 10),
  );
  for (const date of dates) {
    if (!ruleApplies(candidate, date)) continue;
    const existing = rules.find(
      (rule) =>
        rule.id !== candidate.id &&
        RULE_PRIORITY[rule.kind] === RULE_PRIORITY[candidate.kind] &&
        ruleApplies(rule, date),
    );
    if (existing)
      return { ruleId: existing.id, date: date.toISOString().slice(0, 10) };
  }
  return null;
}

export function resolveNightlyRates(
  basePrice: Prisma.Decimal,
  dates: Date[],
  rules: PricingRuleLike[],
) {
  return dates.map((date) => {
    const matching = rules
      .filter((rule) => ruleApplies(rule, date))
      .sort(
        (a, b) =>
          RULE_PRIORITY[b.kind] - RULE_PRIORITY[a.kind] ||
          a.id.localeCompare(b.id),
      );
    const winner = matching[0];
    return {
      date: date.toISOString().slice(0, 10),
      price: winner?.price ?? basePrice,
      source: winner?.kind ?? 'BASE',
      ruleId: winner?.id ?? null,
    };
  });
}
