import { useState } from 'react';

import { AdminText } from '../dashboard/components';
import { appendMockAudit, mockAccommodationService, mockOwnerVerificationService, mockUserService } from '../shared/mock';
import { AdminButton, AdminCard, AdminDecisionDialog, AdminEmpty, AdminPage, AdminRow, openAdminDetail } from '../shared/ui';

export function OwnerQueueScreen() {
  const records = mockOwnerVerificationService.useItems().filter((item) => item.status === 'PENDING');
  const [refreshed, setRefreshed] = useState(false);
  const owners = mockUserService.useItems();
  const hotels = mockAccommodationService.useItems();
  return <AdminPage title="Hồ sơ chủ khách sạn">{records.length ? <><AdminCard title="Hồ sơ xác minh chủ sở hữu">{records.map((record) => { const owner = owners.find((item) => item.id === record.userId); const hotel = hotels.find((item) => item.id === record.accommodationId); return <AdminRow key={record.id} title={hotel?.name ?? 'Chỗ ở'} subtitle={`${owner?.name ?? 'Chủ sở hữu'} · ${record.documents}`} status="Chờ duyệt" onPress={() => openAdminDetail("owner-verification", record.id)} />; })}</AdminCard><AdminCard title="Bằng chứng & quyết định"><AdminText>Kiểm tra tài liệu, ghi lý do rồi phê duyệt hoặc từ chối.</AdminText></AdminCard></> : <><AdminEmpty onRefresh={() => { void mockOwnerVerificationService.listAsync('loading').then(() => setRefreshed(true)); }} />{refreshed && <AdminText style={{ textAlign: 'center' }}>Đã cập nhật hàng chờ.</AdminText>}</>}</AdminPage>;
}

export function OwnerDetailScreen({ id }: { id: string }) {
  const records = mockOwnerVerificationService.useItems();
  const record = records.find((item) => item.id === id);
  const owner = mockUserService.useItems().find((item) => item.id === record?.userId);
  const hotel = mockAccommodationService.useItems().find((item) => item.id === record?.accommodationId);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  if (!record) return <AdminPage title="Chi tiết hồ sơ xác minh"><AdminCard><AdminText>Không tìm thấy hồ sơ.</AdminText></AdminCard></AdminPage>;
  return <AdminPage title="Chi tiết hồ sơ xác minh"><AdminCard title={`${owner?.name ?? 'Chủ sở hữu'} · ${hotel?.name ?? 'Chỗ ở'}`}><AdminText>{owner?.email} · {owner?.phone}</AdminText><AdminText>Trạng thái: {record.status}</AdminText></AdminCard><AdminCard title="Bằng chứng cần xác minh"><AdminText>{record.documents}</AdminText><AdminText>Giấy tờ sở hữu và thông tin pháp lý đã được gửi ngày {record.submittedAt}.</AdminText></AdminCard><AdminCard title="Quyết định của Admin"><AdminText>Kiểm tra tài liệu, ghi lý do rồi phê duyệt hoặc từ chối.</AdminText></AdminCard>{record.status === 'PENDING' && <><AdminButton label="Phê duyệt hồ sơ" onPress={() => setDecision('approve')} style={{ width: 340 }} /><AdminButton label="Từ chối hồ sơ" variant="danger" onPress={() => setDecision('reject')} style={{ width: 340 }} /></>}<AdminDecisionDialog visible={decision !== null} title={decision === 'approve' ? 'Duyệt chủ khách sạn' : 'Từ chối xác minh chủ khách sạn'} target={`${owner?.name} · ${hotel?.name}`} evidence={record.documents} reasonRequired={decision === 'reject'} confirmLabel={decision === 'approve' ? 'Phê duyệt hồ sơ' : 'Xác nhận từ chối'} danger={decision === 'reject'} onCancel={() => setDecision(null)} onConfirm={(reason) => { const approved = decision === 'approve'; mockOwnerVerificationService.update(record.id, { status: approved ? 'VERIFIED' : 'REJECTED' }); appendMockAudit(approved ? 'Xác minh chủ khách sạn' : 'Từ chối xác minh chủ khách sạn', owner?.name ?? record.id, reason); setDecision(null); }} /></AdminPage>;
}
