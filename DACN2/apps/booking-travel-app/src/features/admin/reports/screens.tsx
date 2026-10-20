import { useState } from 'react';

import { AdminText } from '../dashboard/components';
import { appendMockAudit, mockAccommodationService, mockReportService } from '../shared/mock';
import { AdminButton, AdminCard, AdminDecisionDialog, AdminPage, AdminRow, openAdminDetail, openAdminScreen } from '../shared/ui';

export function ReportsScreen({ kind }: { kind: 'REVIEW' | 'REPORT' }) {
  const reports = mockReportService.useItems().filter((item) => item.kind === kind);
  const hotels = mockAccommodationService.useItems();
  return <AdminPage title={kind === 'REVIEW' ? 'Kiểm duyệt đánh giá' : 'Quản lý báo cáo'}><AdminCard title="Báo cáo cần xét duyệt"><AdminText>Phản ánh nội dung khách sạn / đánh giá · kèm bằng chứng</AdminText></AdminCard><AdminCard>{reports.map((report) => <AdminRow key={report.id} title={hotels.find((item) => item.id === report.hotelId)?.name ?? 'Chỗ ở'} subtitle={report.evidence} status={report.status === 'OPEN' ? 'Mở' : report.status} onPress={() => openAdminDetail("reports", report.id)} />)}</AdminCard><AdminCard title="Quyết định có lý do"><AdminText>Ghi bằng chứng, xác nhận, rồi lưu audit log minh họa.</AdminText></AdminCard>{kind === 'REVIEW' && <AdminButton label="Quản lý báo cáo" variant="outline" onPress={() => openAdminScreen('reports')} style={{ alignSelf: 'flex-start' }} />}</AdminPage>;
}

export function ReportDetailScreen({ id }: { id: string }) {
  const report = mockReportService.useItems().find((item) => item.id === id);
  const hotel = mockAccommodationService.useItems().find((item) => item.id === report?.hotelId);
  const [decision, setDecision] = useState<'resolve' | 'reject' | null>(null);
  if (!report) return <AdminPage title="Chi tiết báo cáo"><AdminCard><AdminText>Không tìm thấy báo cáo.</AdminText></AdminCard></AdminPage>;
  const openDecision = (next: 'resolve' | 'reject') => { if (report.status === 'OPEN') mockReportService.update(report.id, { status: 'IN_REVIEW' }); setDecision(next); };
  return <AdminPage title="Chi tiết báo cáo"><AdminCard title={`Báo cáo khách sạn ${hotel?.name}`}><AdminText>{report.reason}</AdminText><AdminText>Trạng thái: {report.status}</AdminText></AdminCard><AdminCard title="Bằng chứng cần kiểm tra"><AdminText>{report.evidence} · Trao đổi với chủ khách sạn là bằng chứng xét duyệt.</AdminText></AdminCard><AdminCard title="Quyết định của Admin"><AdminText>Lý do quyết định phải được ghi vào nhật ký.</AdminText></AdminCard>{(report.status === 'OPEN' || report.status === 'IN_REVIEW') && <><AdminButton label="Ra quyết định báo cáo" onPress={() => openDecision('resolve')} style={{ width: 340 }} /><AdminButton label="Bác bỏ báo cáo" variant="outline" onPress={() => openDecision('reject')} style={{ width: 340 }} /></>}<AdminDecisionDialog visible={decision !== null} title="Ra quyết định báo cáo" target={`Báo cáo khách sạn ${hotel?.name}`} evidence={report.evidence} reasonRequired confirmLabel="Xác nhận xử lý" danger={decision === 'reject'} onCancel={() => setDecision(null)} onConfirm={(reason) => { mockReportService.update(report.id, { status: decision === 'resolve' ? 'RESOLVED' : 'REJECTED' }); appendMockAudit('Xử lý báo cáo', hotel?.name ?? report.id, reason); setDecision(null); }} /></AdminPage>;
}
