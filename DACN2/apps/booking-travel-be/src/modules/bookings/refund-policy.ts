import { Prisma } from '@prisma/client';

export type RefundRule = {
  minimumHoursBeforeCheckIn: number;
  refundPercent: number;
};

export type RefundEstimate = {
  refundPercent: number;
  refundAmount: Prisma.Decimal;
  cancellationFee: Prisma.Decimal;
  currency: string;
  rule: RefundRule;
};

const HOUR_MS = 3_600_000;

export function parseRefundRules(value: unknown): RefundRule[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10)
    return null;
  const rules: RefundRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const rule = item as Record<string, unknown>;
    if (
      !Number.isInteger(rule.minimumHoursBeforeCheckIn) ||
      Number(rule.minimumHoursBeforeCheckIn) < 0 ||
      Number(rule.minimumHoursBeforeCheckIn) > 8760 ||
      !Number.isInteger(rule.refundPercent) ||
      Number(rule.refundPercent) < 0 ||
      Number(rule.refundPercent) > 100
    )
      return null;
    rules.push({
      minimumHoursBeforeCheckIn: Number(rule.minimumHoursBeforeCheckIn),
      refundPercent: Number(rule.refundPercent),
    });
  }
  rules.sort(
    (a, b) => a.minimumHoursBeforeCheckIn - b.minimumHoursBeforeCheckIn,
  );
  if (rules[0].minimumHoursBeforeCheckIn !== 0) return null;
  for (let i = 1; i < rules.length; i++) {
    if (
      rules[i].minimumHoursBeforeCheckIn ===
        rules[i - 1].minimumHoursBeforeCheckIn ||
      rules[i].refundPercent < rules[i - 1].refundPercent
    )
      return null;
  }
  return rules;
}

export function refundEstimate(input: {
  rules: unknown;
  checkIn: Date;
  checkInTime: string | null;
  cancelledAt: Date;
  paidAmount: Prisma.Decimal;
  currency: string;
}): RefundEstimate | null {
  const rules = parseRefundRules(input.rules);
  if (
    !rules ||
    !input.checkInTime ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.checkInTime)
  )
    return null;
  const localDate = input.checkIn.toISOString().slice(0, 10);
  const checkInAt = new Date(`${localDate}T${input.checkInTime}:00+07:00`);
  const hours = (checkInAt.getTime() - input.cancelledAt.getTime()) / HOUR_MS;
  if (!Number.isFinite(hours)) return null;
  const rule = [...rules]
    .reverse()
    .find((candidate) => hours >= candidate.minimumHoursBeforeCheckIn);
  if (!rule) return null;
  const scale = input.currency === 'VND' ? 0 : 2;
  const refundAmount = input.paidAmount
    .mul(rule.refundPercent)
    .div(100)
    .toDecimalPlaces(scale, Prisma.Decimal.ROUND_DOWN);
  return {
    refundPercent: rule.refundPercent,
    refundAmount,
    cancellationFee: input.paidAmount.sub(refundAmount),
    currency: input.currency,
    rule,
  };
}
