import { useState } from 'react';
import { View } from 'react-native';

import { AdminText } from '../dashboard/components';
import { appendMockAudit, mockUserService } from '../shared/mock';
import { AdminButton, AdminCard, AdminDecisionDialog, AdminInput, AdminPage, AdminRow, openAdminDetail } from '../shared/ui';

export function UsersScreen() {
  const users = mockUserService.useItems();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [page, setPage] = useState(1);
  const filtered = users.filter((user) => `${user.name} ${user.email} ${user.phone}`.toLowerCase().includes(query.toLowerCase()) && (status === 'ALL' || user.status === status));
  return <AdminPage title="Quản lý người dùng"><AdminCard title="Tìm người dùng"><AdminText style={{ fontSize: 14, color: '#475569' }}>Tìm theo tên, email, số điện thoại · trạng thái Active / Suspended</AdminText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><AdminInput value={query} onChangeText={(value) => { setQuery(value); setPage(1); }} placeholder="Tìm tên, email, số điện thoại" />{(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((item) => <AdminButton key={item} label={item === 'ALL' ? 'Tất cả' : item === 'ACTIVE' ? 'Đang hoạt động' : 'Đình chỉ'} variant={status === item ? 'primary' : 'outline'} onPress={() => { setStatus(item); setPage(1); }} />)}</View></AdminCard><AdminCard>{filtered.length ? filtered.slice((page - 1) * 2, page * 2).map((user) => <AdminRow key={user.id} title={user.name} subtitle={`${user.email} · ${user.role === 'USER' ? 'User' : 'Hotel Owner'}`} status={user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đình chỉ'} onPress={() => openAdminDetail("users", user.id)} />) : <AdminText>Không tìm thấy người dùng phù hợp.</AdminText>}</AdminCard>{filtered.length > 2 && <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><AdminButton label="‹" variant="outline" disabled={page === 1} onPress={() => setPage(page - 1)} /><AdminText>Trang {page} / {Math.ceil(filtered.length / 2)}</AdminText><AdminButton label="›" variant="outline" disabled={page * 2 >= filtered.length} onPress={() => setPage(page + 1)} /></View>}<AdminCard title="Phạm vi hành động"><AdminText style={{ fontSize: 14, color: '#475569' }}>Đình chỉ phải có lý do và bước xác nhận.</AdminText></AdminCard></AdminPage>;
}

export function UserDetailScreen({ id }: { id: string }) {
  const users = mockUserService.useItems();
  const user = users.find((item) => item.id === id);
  const [confirm, setConfirm] = useState(false);
  if (!user) return <AdminPage title="Chi tiết người dùng"><AdminCard><AdminText>Không tìm thấy người dùng.</AdminText></AdminCard></AdminPage>;
  return <AdminPage title="Chi tiết người dùng"><AdminCard title={user.name}><AdminText>{user.email} · {user.phone}</AdminText><AdminText>{user.role === 'USER' ? 'Khách hàng' : 'Chủ khách sạn'} · {user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đình chỉ'}</AdminText></AdminCard><AdminCard title="Bằng chứng cần kiểm tra"><AdminText>Kiểm tra lịch sử báo cáo và bằng chứng trước khi quyết định.</AdminText></AdminCard><AdminCard title="Lý do quyết định"><AdminText>Mọi quyết định được ghi nhận trong nhật ký minh họa.</AdminText></AdminCard><AdminButton label={user.status === 'ACTIVE' ? 'Xem quyết định đình chỉ' : 'Khôi phục tài khoản'} variant={user.status === 'ACTIVE' ? 'danger' : 'primary'} onPress={() => setConfirm(true)} style={{ width: 340 }} /><AdminDecisionDialog visible={confirm} title={user.status === 'ACTIVE' ? 'Xác nhận đình chỉ người dùng' : 'Khôi phục người dùng'} target={`${user.name} · ${user.email}`} evidence="Kiểm tra lịch sử báo cáo và bằng chứng trước khi quyết định." reasonRequired confirmLabel={user.status === 'ACTIVE' ? 'Xác nhận đình chỉ' : 'Xác nhận khôi phục'} danger={user.status === 'ACTIVE'} onCancel={() => setConfirm(false)} onConfirm={(reason) => { mockUserService.update(user.id, { status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }); appendMockAudit(user.status === 'ACTIVE' ? 'Đình chỉ người dùng' : 'Khôi phục người dùng', user.name, reason); setConfirm(false); }} /></AdminPage>;
}
