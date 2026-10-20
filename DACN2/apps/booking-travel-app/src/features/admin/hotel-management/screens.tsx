import { useState } from 'react';

import { AdminText } from '../dashboard/components';
import { appendMockAudit, mockAccommodationService, mockUserService, typeLabel } from '../shared/mock';
import { AdminButton, AdminCard, AdminDecisionDialog, AdminInput, AdminPage, AdminRow, openAdminDetail } from '../shared/ui';

export function HotelsScreen() {
  const hotels = mockAccommodationService.useItems();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'APPROVED' | 'SUSPENDED'>('ALL');
  const filtered = hotels.filter((hotel) => hotel.name.toLowerCase().includes(search.toLowerCase()) && (status === 'ALL' || hotel.status === status));
  return <AdminPage title="Quản lý khách sạn"><AdminCard title="Tìm chỗ ở"><AdminInput value={search} onChangeText={setSearch} placeholder="Tìm tên chỗ ở" />{(['ALL', 'APPROVED', 'SUSPENDED'] as const).map((item) => <AdminButton key={item} label={item === 'ALL' ? 'Tất cả' : item === 'APPROVED' ? 'Đã duyệt' : 'Đình chỉ'} variant={status === item ? 'primary' : 'outline'} onPress={() => setStatus(item)} />)}</AdminCard><AdminCard>{filtered.slice(0, 12).map((hotel) => <AdminRow key={hotel.id} title={hotel.name} subtitle={`${typeLabel(hotel.type)} · ${hotel.address}`} status={hotel.status} onPress={() => openAdminDetail("hotels", hotel.id)} />)}</AdminCard></AdminPage>;
}

export function HotelDetailScreen({ id }: { id: string }) {
  const hotel = mockAccommodationService.useItems().find((item) => item.id === id);
  const owner = mockUserService.useItems().find((item) => item.id === hotel?.ownerId);
  const [decision, setDecision] = useState<'suspend' | 'restore' | null>(null);
  if (!hotel) return <AdminPage title="Chi tiết khách sạn"><AdminCard><AdminText>Không tìm thấy chỗ ở.</AdminText></AdminCard></AdminPage>;
  return <AdminPage title="Chi tiết khách sạn"><AdminCard title={hotel.name}><AdminText>{typeLabel(hotel.type)} · {hotel.address} · {hotel.rooms} phòng</AdminText><AdminText>Chủ sở hữu: {owner?.name} · {owner?.email}</AdminText><AdminText>Trạng thái: {hotel.status}</AdminText></AdminCard><AdminCard title="Bằng chứng cần kiểm tra"><AdminText>Đánh giá báo cáo, liên hệ chủ khách sạn và lịch sử kiểm duyệt.</AdminText></AdminCard><AdminCard title="Lý do quyết định"><AdminText>Bắt buộc khi đình chỉ. Mọi thay đổi ghi vào audit log minh họa.</AdminText></AdminCard>{hotel.status === 'APPROVED' && <AdminButton label="Xem đình chỉ khách sạn" variant="danger" style={{ width: 340 }} onPress={() => setDecision('suspend')} />}{hotel.status === 'SUSPENDED' && <AdminButton label="Khôi phục khách sạn" style={{ width: 340 }} onPress={() => setDecision('restore')} />}<AdminDecisionDialog visible={decision !== null} title={decision === 'suspend' ? 'Đình chỉ khách sạn' : 'Khôi phục khách sạn'} target={`${hotel.name} · ${hotel.rooms} phòng`} evidence={decision === 'suspend' ? 'Đánh giá báo cáo, liên hệ chủ khách sạn và lịch sử kiểm duyệt.' : 'Chủ sở hữu đã cung cấp ảnh và chính sách được cập nhật.'} reasonRequired confirmLabel={decision === 'suspend' ? 'Xác nhận đình chỉ' : 'Xác nhận khôi phục'} danger={decision === 'suspend'} onCancel={() => setDecision(null)} onConfirm={(reason) => { const suspend = decision === 'suspend'; mockAccommodationService.update(hotel.id, { status: suspend ? 'SUSPENDED' : 'APPROVED' }); appendMockAudit(suspend ? 'Đình chỉ chỗ ở' : 'Khôi phục chỗ ở', hotel.name, reason); setDecision(null); }} /></AdminPage>;
}
