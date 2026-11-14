export function todayInVietnam(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export type StaySelection = {
  source: 'search' | 'hotel';
  hotelId: string | null;
  confirmedAt: number;
};

export function validStayDates(checkIn: string, checkOut: string, today = todayInVietnam()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) return false;
  const start = Date.parse(`${checkIn}T00:00:00.000Z`);
  const end = Date.parse(`${checkOut}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (new Date(start).toISOString().slice(0, 10) !== checkIn || new Date(end).toISOString().slice(0, 10) !== checkOut) return false;
  const nights = (end - start) / 86_400_000;
  return checkIn >= today && nights >= 1 && nights <= 366;
}

export function confirmedStayForHotel(
  selection: StaySelection | null,
  checkIn: string,
  checkOut: string,
  activeHotelId: string,
  hotelId: string,
): boolean {
  if (!selection || !hotelId || !validStayDates(checkIn, checkOut)) return false;
  return selection.source === 'hotel'
    ? selection.hotelId === hotelId
    : activeHotelId === hotelId;
}

export function confirmedSearchStay(selection: StaySelection | null, checkIn: string, checkOut: string): boolean {
  return selection?.source === 'search' && validStayDates(checkIn, checkOut);
}

export function guestContextKey(roomId: string, checkIn: string, checkOut: string, adults: number, children: number, rooms: number, selection: StaySelection | null): string {
  return selection && roomId ? [roomId, checkIn, checkOut, adults, children, rooms, selection.confirmedAt].join('|') : '';
}
