import { useState } from 'react';
import { View } from 'react-native';

import { AdminText } from '../dashboard/components';
import { appendMockAudit, formatVnd, mockAccommodationService, mockFraudService, mockPaymentService } from '../shared/mock';
import { AdminButton, AdminCard, AdminDecisionDialog, AdminPage, openAdminDetail } from '../shared/ui';

export function FraudFlagsScreen() {
  const flags = mockFraudService.useItems();
  const hotels = mockAccommodationService.useItems();
  const open = flags.filter((item) => item.status === 'OPEN');
  const [confirm, setConfirm] = useState(false);
  const primary = flags[0];
  if (!primary) return <AdminPage title="Cảnh báo giao dịch bất thường"><AdminCard><AdminText>Không có cảnh báo cần xem.</AdminText></AdminCard></AdminPage>;
  return <AdminPage title="Cảnh báo giao dịch bất thường" eyebrow="CẢNH BÁO AI / DANH SÁCH RỦI RO" subtitle="Admin xác minh bằng chứng trước khi quyết định xử lý." trailing={<AdminText style={{ color: '#B85C14' }}>{open.length} cảnh báo cần xem</AdminText>}>
    {flags.map((flag) => <AdminCard key={flag.id} tone="red"><View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <View><AdminText weight="bold" style={{ fontSize: 26, color: '#B91C1C' }}>{flag.riskScore} / 100</AdminText><AdminText style={{ color: '#B91C1C', fontSize: 11 }}>RỦI RO CAO</AdminText></View>
      <View><AdminText weight="semibold">{flag.transactionId}</AdminText><AdminText style={{ fontSize: 12, color: '#64748B' }}>Đặt phòng {flag.bookingId} · {hotels.find((item) => item.id === flag.hotelId)?.name}</AdminText></View>
      <View><AdminText>{flag.time}</AdminText><AdminText style={{ color: '#B85C14' }}>Độ tin cậy AI {flag.confidence}%</AdminText></View>
    </View></AdminCard>)}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      <AdminCard title="Tín hiệu cần xác minh" style={{ flex: 1, minWidth: 260 }}><AdminText>Địa chỉ IP</AdminText><AdminText weight="semibold">Thay đổi quốc gia trong 10 phút</AdminText><AdminText>Thanh toán</AdminText><AdminText weight="semibold">3 lần thử trước khi thành công</AdminText><AdminText>Tài khoản</AdminText><AdminText weight="semibold">Mới tạo · chưa có lịch sử lưu trú</AdminText><AdminText>Giá trị giao dịch</AdminText><AdminText weight="semibold">{formatVnd(4188000)}</AdminText></AdminCard>
      <AdminCard title="Phân tích của AI" style={{ flex: 1, minWidth: 260 }}><AdminText>Mẫu truy cập và nhiều lần thử thanh toán làm tăng rủi ro. Các tín hiệu này yêu cầu chứng minh gian lận; cần đối chiếu cổng thanh toán và liên hệ khách hàng khi cần.</AdminText><AdminText weight="semibold">Bằng chứng bổ sung</AdminText><AdminText>Mã giao dịch · IP · thiết bị · thời điểm xác thực · lịch sử liên hệ</AdminText><AdminText style={{ color: '#2563EB' }}>AI chỉ gắn cờ, không tự đình chỉ tài khoản hay khách sạn.</AdminText></AdminCard>
    </View>
    <AdminCard title="Quyết định của Admin"><AdminText>Mọi thao tác điều tra hoặc hạn chế tài khoản cần lý do và được ghi audit log.</AdminText></AdminCard>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><AdminButton label="Đánh dấu đã xem" variant="outline" disabled={primary?.status === 'REVIEWED'} onPress={() => setConfirm(true)} /><AdminButton label="Điều tra chi tiết" onPress={() => openAdminDetail('fraud', primary.id)} /><AdminButton label="Xem biện pháp xử lý" variant="outline" onPress={() => openAdminDetail('fraud', primary.id)} /></View>
    <AdminDecisionDialog visible={confirm} title="Xem xét cảnh báo AI" target={`Giao dịch ${primary.transactionId} · AI flag`} evidence="Tín hiệu bất thường cần kiểm tra độc lập; AI không tự khóa tài khoản." reasonRequired confirmLabel="Đánh dấu đã xem xét" onCancel={() => setConfirm(false)} onConfirm={(reason) => { mockFraudService.update(primary.id, { status: 'REVIEWED' }); appendMockAudit('Xem xét cảnh báo AI', primary.transactionId, reason); setConfirm(false); }} />
  </AdminPage>;
}

export function FraudDetailScreen({ id }: { id: string }) {
  const flag = mockFraudService.useItems().find((item) => item.id === id);
  const payment = mockPaymentService.useItems().find((item) => item.id === flag?.transactionId);
  const [confirm, setConfirm] = useState(false);
  if (!flag) return <AdminPage title="Chi tiết cảnh báo"><AdminCard><AdminText>Không tìm thấy cảnh báo.</AdminText></AdminCard></AdminPage>;
  return <AdminPage title="Chi tiết cảnh báo"><AdminCard title="AI-generated · Cảnh báo gian lận" tone="purple"><AdminText>Giao dịch có tín hiệu bất thường. AI chỉ gắn cờ để Admin xem xét.</AdminText></AdminCard><AdminCard title="Bằng chứng cần xác minh"><AdminText>Mã giao dịch {flag.transactionId} · địa chỉ IP · lịch sử thanh toán · liên hệ khách hàng</AdminText><AdminText>Giá trị giao dịch {formatVnd(payment?.amount ?? 0)} · trạng thái {payment?.status}</AdminText></AdminCard><AdminCard title="Quyết định của Admin"><AdminText>Không tự đình chỉ người dùng hoặc khách sạn. Ghi lý do và audit.</AdminText><AdminText>Trạng thái: {flag.status === 'OPEN' ? 'Cần xem' : 'Đã xem xét'}</AdminText></AdminCard>{flag.status === 'OPEN' && <AdminButton label="Đánh dấu đã xem xét" onPress={() => setConfirm(true)} style={{ width: 340 }} />}<AdminDecisionDialog visible={confirm} title="Xem xét cảnh báo AI" target={`Giao dịch ${flag.transactionId} · AI flag`} evidence="Tín hiệu bất thường cần kiểm tra độc lập; AI không tự khóa tài khoản." reasonRequired confirmLabel="Đánh dấu đã xem xét" onCancel={() => setConfirm(false)} onConfirm={(reason) => { mockFraudService.update(flag.id, { status: 'REVIEWED' }); appendMockAudit('Xem xét cảnh báo AI', flag.transactionId, reason); setConfirm(false); }} /></AdminPage>;
}
