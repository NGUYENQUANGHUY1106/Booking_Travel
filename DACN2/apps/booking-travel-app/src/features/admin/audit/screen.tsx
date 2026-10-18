import { useState } from 'react';

import { AdminText } from '../dashboard/components';
import { mockAuditService } from '../shared/mock';
import { AdminCard, AdminInput, AdminPage, AdminRow } from '../shared/ui';

export function AuditScreen() {
  const events = mockAuditService.useItems();
  const [query, setQuery] = useState('');
  const filtered = events.filter((event) => `${event.at} ${event.actor} ${event.action} ${event.target} ${event.reason}`.toLowerCase().includes(query.toLowerCase()));
  return <AdminPage title="Nhật ký hệ thống">{filtered.map((event) => <AdminCard key={event.id}><AdminRow title={`${event.at} · ${event.action} ${event.target}`} subtitle={`${event.actor} · Lý do: ${event.reason}`} status="Đã ghi log (demo)" /></AdminCard>)}{filtered.length === 0 && <AdminCard><AdminText>Không có sự kiện phù hợp.</AdminText></AdminCard>}<AdminCard title="Bộ lọc nhật ký"><AdminText>Tác nhân · đối tượng · hành động · khoảng thời gian</AdminText><AdminInput value={query} onChangeText={setQuery} placeholder="Tìm tác nhân, đối tượng, hành động hoặc thời gian" /></AdminCard></AdminPage>;
}
