export interface BookingQuote {
  nights: number;
  rooms: number;
  roomSubtotal: number;
  taxesAndFees: number;
  discount: number;
  total: number;
  voucherApplied: boolean;
}

export function nights(checkIn: string, checkOut: string): number {
  const difference = Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`);
  if (!Number.isFinite(difference) || difference <= 0) return 0;
  return Math.round(difference / 86400000);
}

export function roomRate(baseRate: number, roomName: string): number {
  return roomName === 'Superior City View' ? Math.max(780000, baseRate - 270000) : baseRate;
}

export function calculateBookingQuote(roomRate: number, checkIn: string, checkOut: string, rooms: number, voucher: string): BookingQuote {
  const stayNights = nights(checkIn, checkOut);
  const safeRooms = Math.max(1, Math.floor(rooms));
  const roomSubtotal = roomRate * stayNights * safeRooms;
  const taxesAndFees = stayNights > 0 ? 360000 * safeRooms : 0;
  const voucherApplied = ['TRAVEL12', 'MYKHE12'].includes(voucher.trim().toUpperCase());
  const discount = voucherApplied ? Math.min(522000, Math.round(roomSubtotal * 0.12)) : 0;
  return { nights: stayNights, rooms: safeRooms, roomSubtotal, taxesAndFees, discount, total: roomSubtotal + taxesAndFees - discount, voucherApplied };
}
