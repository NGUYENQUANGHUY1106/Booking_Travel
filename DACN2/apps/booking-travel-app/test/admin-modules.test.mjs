import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOMMODATION_TYPES, appendMockAudit, mockAccommodationService, mockAuditService,
  mockBookingMonitorService, mockFraudService, mockOwnerVerificationService,
  mockPaymentService, mockReportService, mockUserService, mockVoucherService,
} from '../src/features/admin/shared/mock.ts';

test('ADM-UI-07 uses 24 linked accommodations across all six Figma types', () => {
  const hotels = mockAccommodationService.list();
  const users = mockUserService.list();
  assert.equal(hotels.filter((hotel) => hotel.status === 'PENDING').length, 24);
  assert.deepEqual(ACCOMMODATION_TYPES.map((type) => hotels.filter((hotel) => hotel.type === type.id).length), [10, 4, 3, 2, 3, 2]);
  assert.equal(hotels.filter((hotel) => ['HOTEL', 'RESORT'].includes(hotel.type)).length, 14);
  for (const hotel of hotels) assert.ok(users.some((user) => user.id === hotel.ownerId));
});

test('Admin fixtures link owner, booking, payment, report and fraud records by ID', () => {
  const hotels = mockAccommodationService.list();
  const users = mockUserService.list();
  const bookings = mockBookingMonitorService.list();
  const payments = mockPaymentService.list();
  for (const item of mockOwnerVerificationService.list()) {
    assert.ok(users.some((user) => user.id === item.userId));
    assert.ok(hotels.some((hotel) => hotel.id === item.accommodationId));
  }
  for (const booking of bookings) {
    assert.ok(users.some((user) => user.id === booking.guestId));
    assert.ok(hotels.some((hotel) => hotel.id === booking.hotelId));
  }
  for (const payment of payments) assert.ok(bookings.some((booking) => booking.id === payment.bookingId));
  for (const report of mockReportService.list()) assert.ok(hotels.some((hotel) => hotel.id === report.hotelId));
  for (const flag of mockFraudService.list()) {
    assert.ok(payments.some((payment) => payment.id === flag.transactionId));
    assert.ok(bookings.some((booking) => booking.id === flag.bookingId));
  }
});

test('Figma booking and payment amounts stay separate until backend reconciliation', () => {
  assert.equal(mockBookingMonitorService.get('BT-2027-DN-00128')?.displayAmount, 4350000);
  assert.equal(mockPaymentService.get('PAY-2027-DN-00128')?.amount, 4188000);
});

test('Sensitive mock changes update domain data and append an explicit demo audit event', () => {
  const before = mockAuditService.list().length;
  mockUserService.update('user-quang', { status: 'SUSPENDED' });
  appendMockAudit('Đình chỉ người dùng', 'Nguyễn Phan Nhật Quang', 'Vi phạm chính sách');
  assert.equal(mockUserService.get('user-quang')?.status, 'SUSPENDED');
  assert.equal(mockAuditService.list().length, before + 1);
  assert.equal(mockAuditService.list()[0].status, 'MOCK');
  assert.equal(mockVoucherService.get('voucher-travel12')?.code, 'TRAVEL12');
});
