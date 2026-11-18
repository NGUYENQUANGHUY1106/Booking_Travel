export const STAY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

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
  const eligible =
    input.action === 'CHECK_IN'
      ? localDate === stayDate && localTime >= scheduledTime
      : localDate === stayDate && localTime <= scheduledTime;
  return {
    eligible,
    code: eligible ? null : 'STAY_OUTSIDE_POLICY',
    message: eligible
      ? null
      : input.action === 'CHECK_IN'
        ? `Chỉ được nhận phòng từ ${scheduledTime} trong ngày ${stayDate} (giờ Việt Nam).`
        : `Chỉ được trả phòng trong ngày ${stayDate}, trước hoặc đúng ${scheduledTime} (giờ Việt Nam).`,
    timeZone: STAY_TIME_ZONE,
    scheduledTime,
  };
}
