export const STAY_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const CHECKOUT_GRACE_MS = 2 * 60 * 60 * 1000;

export function scheduledCheckoutAt(
  date: Date,
  time: string | null,
): Date | null {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return new Date(`${date.toISOString().slice(0, 10)}T${time}:00+07:00`);
}

type StayAction = 'CHECK_IN' | 'CHECK_OUT';

export function stayDatePolicy(input: {
  action: StayAction;
  now: Date;
  checkIn: Date;
  checkOut: Date;
  checkInTime: string | null;
  checkOutTime: string | null;
}): {
  eligible: boolean;
  code: string | null;
  message: string | null;
  timeZone: string;
  scheduledTime: string | null;
} {
  const scheduledTime =
    input.action === 'CHECK_IN' ? input.checkInTime : input.checkOutTime;
  if (!scheduledTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) {
    return {
      eligible: false,
      code: 'STAY_TIME_NOT_CONFIGURED',
      message:
        'Khách sạn chưa có giờ nhận/trả phòng hợp lệ. Vui lòng liên hệ quản trị viên.',
      timeZone: STAY_TIME_ZONE,
      scheduledTime: null,
    };
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: STAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(input.now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const localDate = `${value('year')}-${value('month')}-${value('day')}`;
  const localTime = `${value('hour')}:${value('minute')}`;
  const stayDate = (
    input.action === 'CHECK_IN' ? input.checkIn : input.checkOut
  )
    .toISOString()
    .slice(0, 10);
  const checkoutAt = scheduledCheckoutAt(input.checkOut, input.checkOutTime);
  const eligible =
    input.action === 'CHECK_IN'
      ? localDate === stayDate && localTime >= scheduledTime
      : Boolean(
          checkoutAt &&
          localDate >= stayDate &&
          input.now.getTime() <= checkoutAt.getTime() + CHECKOUT_GRACE_MS,
        );
  return {
    eligible,
    code: eligible ? null : 'STAY_OUTSIDE_POLICY',
    message: eligible
      ? null
      : input.action === 'CHECK_IN'
        ? `Chỉ được nhận phòng từ ${scheduledTime} trong ngày ${stayDate} (giờ Việt Nam).`
        : `Chỉ được xác nhận trả phòng trước hoặc đúng 2 giờ sau ${scheduledTime} ngày ${stayDate} (giờ Việt Nam).`,
    timeZone: STAY_TIME_ZONE,
    scheduledTime,
  };
}
