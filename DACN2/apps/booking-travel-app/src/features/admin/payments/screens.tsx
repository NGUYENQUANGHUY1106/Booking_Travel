import { useState } from 'react';

import { AdminText } from '../dashboard/components';
import { appendMockAudit, formatVnd, mockPaymentService } from '../shared/mock';
import { AdminButton, AdminCard, AdminDecisionDialog, AdminPage, AdminRow, openAdminDetail } from '../shared/ui';

export function PaymentsScreen() {
  const payments = mockPaymentService.useItems();
  return <AdminPage title="Thanh toán và hoàn tiền"><AdminCard title="Giao dịch">{payments.map((payment) => <AdminRow key={payment.id} title={payment.bookingId} subtitle={`${payment.id} · ${formatVnd(payment.amount)} · trạng thái ${payment.status}`} status="Xem chi tiết" onPress={() => openAdminDetail("payments", payment.id)} />)}</AdminCard><AdminCard title="Tra soát"><AdminText>Đối chiếu mã giao dịch, thời gian và phản hồi cổng thanh toán.</AdminText></AdminCard></AdminPage>;
}

export function PaymentDetailScreen({ id }: { id: string }) {
  const payment = mockPaymentService.useItems().find((item) => item.id === id);
  const [confirm, setConfirm] = useState(false);
  if (!payment) return <AdminPage title="Chi tiết giao dịch"><AdminCard><AdminText>Không tìm thấy giao dịch.</AdminText></AdminCard></AdminPage>;
  return <AdminPage title="Chi tiết giao dịch"><AdminCard title="Giao dịch"><AdminText>{payment.bookingId} · {formatVnd(payment.amount)} · trạng thái {payment.status}</AdminText><AdminText>Mã giao dịch: {payment.id}</AdminText></AdminCard><AdminRow title="Hoàn tiền" subtitle={`Theo chính sách hủy và cổng thanh toán · ${payment.refundId ?? 'Chưa có yêu cầu'}`} status={payment.refundStatus === 'PENDING' ? 'Đang xử lý' : payment.refundStatus ?? 'Chưa có'} /><AdminCard title="Tra soát"><AdminText>Đối chiếu mã giao dịch, thời gian và phản hồi cổng thanh toán.</AdminText></AdminCard>{payment.refundId && <AdminButton label="Tra soát hoàn tiền một phần" onPress={() => setConfirm(true)} style={{ width: 340 }} />}<AdminDecisionDialog visible={confirm} title="Tra soát hoàn tiền một phần" target={`${payment.bookingId} · ${payment.refundId}`} evidence={`Giá trị giao dịch ${formatVnd(payment.amount)}; số tiền hoàn do cổng thanh toán xác nhận. Không có lệnh chuyển tiền thật.`} reasonRequired confirmLabel="Ghi nhận tra soát minh họa" onCancel={() => setConfirm(false)} onConfirm={(reason) => { mockPaymentService.update(payment.id, { status: 'PARTIALLY_REFUNDED', refundStatus: 'SUCCESS', refundAmount: Math.round(payment.amount / 2) }); appendMockAudit('Tra soát hoàn tiền một phần', payment.id, reason); setConfirm(false); }} /></AdminPage>;
}
