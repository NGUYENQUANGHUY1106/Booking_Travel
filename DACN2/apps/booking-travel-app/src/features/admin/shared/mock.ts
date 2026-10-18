import { useSyncExternalStore } from 'react';

export type AccommodationType = 'HOTEL' | 'RESORT' | 'APARTMENT' | 'VILLA' | 'HOMESTAY' | 'HOSTEL';
export type MockUser = { id: string; name: string; email: string; phone: string; role: 'USER' | 'HOTEL_OWNER'; status: 'ACTIVE' | 'SUSPENDED' };
export type OwnerVerification = { id: string; userId: string; accommodationId: string; status: 'PENDING' | 'VERIFIED' | 'REJECTED'; documents: string; submittedAt: string };
export type Accommodation = { id: string; name: string; type: AccommodationType; ownerId: string; city: string; address: string; rooms: number; submittedAt: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'; image: 'coastal' | 'hoian' | 'villa' };
export type Booking = { id: string; hotelId: string; guestId: string; room: string; stay: string; guests: number; nights: number; status: 'CONFIRMED' | 'CANCELLED'; displayAmount: number };
export type Payment = { id: string; bookingId: string; amount: number; status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED'; refundId?: string; refundStatus?: 'PENDING' | 'SUCCESS' | 'FAILED'; refundAmount?: number };
export type Report = { id: string; hotelId: string; reason: string; evidence: string; status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED'; kind: 'REVIEW' | 'REPORT' };
export type Voucher = { id: string; code: string; discountType: 'PERCENT' | 'AMOUNT'; discountValue: number; maximumDiscount: number; start: string; end: string; minimumBooking: number; usageLimit: number; scope: string; status: 'ACTIVE' | 'INACTIVE' };
export type FraudFlag = { id: string; transactionId: string; bookingId: string; hotelId: string; riskScore: number; confidence: number; status: 'OPEN' | 'REVIEWED'; time: string };
export type AuditEvent = { id: string; at: string; actor: string; action: string; target: string; reason: string; status: 'MOCK' };

export function createMockRepository<T extends { id: string }>(initial: T[]) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
  const getSnapshot = () => snapshot;
  const publish = (next: T[]) => { snapshot = next; listeners.forEach((listener) => listener()); };
  return {
    list: getSnapshot,
    async listAsync(scenario: 'success' | 'empty' | 'error' | 'loading' = 'success') {
      if (scenario === 'loading') await new Promise((resolve) => setTimeout(resolve, 250));
      if (scenario === 'error') throw new Error('Không thể tải dữ liệu Admin demo.');
      return scenario === 'empty' ? [] as T[] : snapshot;
    },
    get: (id: string) => snapshot.find((item) => item.id === id),
    useItems: () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
    update: (id: string, patch: Partial<T>) => publish(snapshot.map((item) => item.id === id ? { ...item, ...patch } : item)),
    add: (item: T) => publish([item, ...snapshot]),
  };
}

export const ACCOMMODATION_TYPES: { id: AccommodationType; label: string; count: number }[] = [
  { id: 'HOTEL', label: 'Khách sạn', count: 10 }, { id: 'RESORT', label: 'Resort', count: 4 },
  { id: 'APARTMENT', label: 'Căn hộ', count: 3 }, { id: 'VILLA', label: 'Villa', count: 2 },
  { id: 'HOMESTAY', label: 'Homestay', count: 3 }, { id: 'HOSTEL', label: 'Hostel', count: 2 },
];
export const typeLabel = (type: AccommodationType) => ACCOMMODATION_TYPES.find((item) => item.id === type)?.label ?? type;
export const formatVnd = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;

export const mockUserService = createMockRepository<MockUser>([
  { id: 'user-quang', name: 'Nguyễn Phan Nhật Quang', email: 'quang@example.com', phone: '090 512 8838', role: 'USER', status: 'ACTIVE' },
  { id: 'owner-an', name: 'Nguyễn Minh An', email: 'an@bluehorizon.vn', phone: '090 512 8836', role: 'HOTEL_OWNER', status: 'ACTIVE' },
  { id: 'guest-b', name: 'Trần Gia Linh', email: 'linh@example.com', phone: '090 512 8840', role: 'USER', status: 'ACTIVE' },
  { id: 'owner-huy', name: 'Phạm Quang Huy', email: 'huy@suncoast.vn', phone: '090 512 8841', role: 'HOTEL_OWNER', status: 'ACTIVE' },
]);

export const mockOwnerVerificationService = createMockRepository<OwnerVerification>([
  { id: 'verify-an', userId: 'owner-an', accommodationId: 'hotel-blue', status: 'PENDING', documents: 'Giấy tờ sở hữu và thông tin pháp lý đã tải lên', submittedAt: '07/10/2026 · 09:38' },
  { id: 'verify-huy', userId: 'owner-huy', accommodationId: 'resort-sun', status: 'PENDING', documents: 'Giấy phép kinh doanh và căn cước đã tải lên', submittedAt: '07/10/2026 · 08:15' },
]);

const SEED_ACCOMMODATIONS: Accommodation[] = [
  { id: 'hotel-blue', name: 'Blue Horizon My Khe Hotel', type: 'HOTEL', ownerId: 'owner-an', city: 'Đà Nẵng', address: '38 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', rooms: 26, submittedAt: '07/10 · 09:42', status: 'PENDING', image: 'coastal' },
  { id: 'resort-sun', name: 'Sun Coast Resort', type: 'RESORT', ownerId: 'owner-huy', city: 'Đà Nẵng', address: 'Bãi biển Non Nước, Đà Nẵng', rooms: 38, submittedAt: '07/10 · 08:15', status: 'PENDING', image: 'coastal' },
  { id: 'resort-lagoon', name: 'Lagoon Garden Resort', type: 'RESORT', ownerId: 'owner-huy', city: 'Phú Quốc', address: 'Dương Đông, Phú Quốc', rooms: 42, submittedAt: '06/10 · 11:20', status: 'PENDING', image: 'hoian' },
  { id: 'homestay-anthu', name: 'An Thu Riverside Boutique', type: 'HOMESTAY', ownerId: 'owner-an', city: 'Hội An', address: 'Ven sông Hoài, Hội An', rooms: 8, submittedAt: '06/10 · 15:18', status: 'PENDING', image: 'hoian' },
];
for (const category of ACCOMMODATION_TYPES) {
  const existing = SEED_ACCOMMODATIONS.filter((item) => item.type === category.id).length;
  for (let n = existing + 1; n <= category.count; n++) {
    SEED_ACCOMMODATIONS.push({ id: `${category.id.toLowerCase()}-${n}`, name: `${category.label} ${n} · Đà Nẵng`, type: category.id, ownerId: n % 2 ? 'owner-an' : 'owner-huy', city: 'Đà Nẵng', address: 'Đà Nẵng, Việt Nam', rooms: 12 + n, submittedAt: `0${(n % 7) + 1}/10 · 10:00`, status: 'PENDING', image: n % 2 ? 'coastal' : 'hoian' });
  }
}
export const mockAccommodationService = createMockRepository<Accommodation>(SEED_ACCOMMODATIONS);

export const mockBookingMonitorService = createMockRepository<Booking>([
  { id: 'BT-2027-DN-00128', hotelId: 'hotel-blue', guestId: 'user-quang', room: 'Deluxe Ocean View', stay: '12–15/10/2026', guests: 2, nights: 3, status: 'CONFIRMED', displayAmount: 4350000 },
  { id: 'BT-2027-DN-00117', hotelId: 'hotel-blue', guestId: 'guest-b', room: 'Superior Double', stay: '18–20/10/2026', guests: 2, nights: 2, status: 'CONFIRMED', displayAmount: 3200000 },
]);

// Figma ADM-UI-11/12 shows 4,350,000 ₫ for booking BT-2027-DN-00128 while ADM-UI-13/14
// shows 4,188,000 ₫ for its transaction. These are separate visual fixtures, not a reconciled total.
export const mockPaymentService = createMockRepository<Payment>([
  { id: 'PAY-2027-DN-00128', bookingId: 'BT-2027-DN-00128', amount: 4188000, status: 'SUCCESS', refundId: 'RF-2027-00128', refundStatus: 'PENDING' },
  { id: 'PAY-2027-DN-00117', bookingId: 'BT-2027-DN-00117', amount: 3200000, status: 'PENDING' },
]);
export const mockReportService = createMockRepository<Report>([
  { id: 'report-blue', hotelId: 'hotel-blue', reason: 'Phản ánh nội dung khách sạn / đánh giá', evidence: 'Ảnh và mô tả cần kiểm tra', status: 'OPEN', kind: 'REPORT' },
  { id: 'review-blue', hotelId: 'hotel-blue', reason: 'Đánh giá có nội dung cần xác minh', evidence: 'Bình luận và ảnh đính kèm', status: 'OPEN', kind: 'REVIEW' },
]);
export const mockVoucherService = createMockRepository<Voucher>([
  { id: 'voucher-travel12', code: 'TRAVEL12', discountType: 'PERCENT', discountValue: 12, maximumDiscount: 522000, start: '2026-10-12', end: '2026-10-31', minimumBooking: 1000000, usageLimit: 100, scope: 'Toàn nền tảng', status: 'ACTIVE' },
]);
export const mockFraudService = createMockRepository<FraudFlag>([
  { id: 'fraud-117', transactionId: 'PAY-2027-DN-00117', bookingId: 'BT-2027-DN-00117', hotelId: 'hotel-blue', riskScore: 82, confidence: 94, status: 'OPEN', time: '07/10 · 08:35' },
]);
export const mockAuditService = createMockRepository<AuditEvent>([
  { id: 'audit-hotel', at: '07/10/2026 · 10:24', actor: 'Nguyễn H. Admin', action: 'Duyệt chỗ ở', target: 'Blue Horizon My Khe Hotel', reason: 'Đã đối chiếu hồ sơ', status: 'MOCK' },
  { id: 'audit-owner', at: '07/10/2026 · 09:38', actor: 'Nguyễn H. Admin', action: 'Xác minh chủ khách sạn', target: 'Nguyễn Minh An', reason: 'Đã đối chiếu giấy tờ', status: 'MOCK' },
]);
export function appendMockAudit(action: string, target: string, reason: string) {
  mockAuditService.add({ id: `audit-${Date.now()}`, at: new Date().toLocaleString('vi-VN'), actor: 'Nguyễn H. Admin', action, target, reason, status: 'MOCK' });
}
