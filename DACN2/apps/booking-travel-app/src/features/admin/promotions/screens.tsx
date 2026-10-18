import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AdminText } from '../dashboard/components';
import { appendMockAudit, formatVnd, mockVoucherService, type Voucher } from '../shared/mock';
import { AdminButton, AdminCard, AdminInput, AdminPage, AdminRow, openAdminScreen } from '../shared/ui';

export function PromotionsScreen() {
  const vouchers = mockVoucherService.useItems();
  return <AdminPage title="Ưu đãi và mã giảm giá"><AdminCard title="Ưu đãi nền tảng">{vouchers.map((voucher) => <AdminRow key={voucher.id} title={voucher.code} subtitle={`Giảm ${voucher.discountValue}${voucher.discountType === 'PERCENT' ? '%' : ' ₫'} tối đa ${formatVnd(voucher.maximumDiscount)}`} status={voucher.status === 'ACTIVE' ? 'Đang áp dụng' : 'Ngừng áp dụng'} onPress={() => openAdminScreen("voucher", voucher.id)} />)}</AdminCard><AdminCard title="Điều kiện"><AdminText>Giá trị tối thiểu, số lượt dùng và phạm vi khách sạn.</AdminText></AdminCard><AdminButton label="Tạo mã ưu đãi" onPress={() => openAdminScreen('voucher')} style={{ width: 340 }} /></AdminPage>;
}

export function VoucherScreen({ id }: { id?: string }) {
  const vouchers = mockVoucherService.useItems();
  const existing = vouchers.find((item) => item.id === id);
  const [code, setCode] = useState(existing?.code ?? '');
  const [discountType, setDiscountType] = useState<Voucher['discountType']>(existing?.discountType ?? 'PERCENT');
  const [value, setValue] = useState(String(existing?.discountValue ?? ''));
  const [max, setMax] = useState(String(existing?.maximumDiscount ?? ''));
  const [start, setStart] = useState(existing?.start ?? '2026-10-12');
  const [end, setEnd] = useState(existing?.end ?? '2026-10-31');
  const [min, setMin] = useState(String(existing?.minimumBooking ?? '0'));
  const [limit, setLimit] = useState(String(existing?.usageLimit ?? ''));
  const [scope, setScope] = useState(existing?.scope ?? 'Toàn nền tảng');
  const [status, setStatus] = useState<Voucher['status']>(existing?.status ?? 'ACTIVE');
  const [error, setError] = useState('');
  const save = () => {
    if (!code.trim() || !value || !max || !start || !end || !limit) { setError('Vui lòng điền đủ các trường bắt buộc.'); return; }
    if (vouchers.some((item) => item.id !== existing?.id && item.code === code.trim().toUpperCase())) { setError('Mã ưu đãi đã tồn tại.'); return; }
    if (Number(value) <= 0 || (discountType === 'PERCENT' && Number(value) > 100) || Number(max) < 0 || Number(min) < 0 || Number(limit) < 1) { setError('Giảm giá và giới hạn sử dụng không hợp lệ.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) { setError('Khoảng ngày hiệu lực không hợp lệ.'); return; }
    const record: Voucher = { id: existing?.id ?? `voucher-${Date.now()}`, code: code.trim().toUpperCase(), discountType, discountValue: Number(value), maximumDiscount: Number(max), start, end, minimumBooking: Number(min), usageLimit: Number(limit), scope: scope.trim(), status };
    if (existing) mockVoucherService.update(existing.id, record); else mockVoucherService.add(record);
    appendMockAudit(existing ? 'Cập nhật mã ưu đãi' : 'Tạo mã ưu đãi', record.code, 'Lưu dữ liệu demo');
    router.replace({ pathname: '/admin/[section]', params: { section: 'promotions' } });
  };
  return <AdminPage title={existing ? 'Chỉnh sửa mã ưu đãi' : 'Tạo mã ưu đãi'}><AdminCard title="Ưu đãi nền tảng"><AdminText>TRAVEL12 · giảm 12% tối đa 522.000 ₫</AdminText></AdminCard><AdminCard title="Thông tin mã ưu đãi"><View style={{ gap: 12 }}><AdminInput label="Mã ưu đãi *" value={code} onChangeText={setCode} /><View style={{ flexDirection: 'row', gap: 8 }}><AdminButton label="Phần trăm" variant={discountType === 'PERCENT' ? 'primary' : 'outline'} onPress={() => setDiscountType('PERCENT')} /><AdminButton label="Số tiền" variant={discountType === 'AMOUNT' ? 'primary' : 'outline'} onPress={() => setDiscountType('AMOUNT')} /></View><AdminInput label="Giá trị giảm *" value={value} onChangeText={setValue} keyboardType="numeric" /><AdminInput label="Giảm tối đa *" value={max} onChangeText={setMax} keyboardType="numeric" /><AdminInput label="Bắt đầu (YYYY-MM-DD) *" value={start} onChangeText={setStart} /><AdminInput label="Kết thúc (YYYY-MM-DD) *" value={end} onChangeText={setEnd} /><AdminInput label="Giá trị đặt phòng tối thiểu" value={min} onChangeText={setMin} keyboardType="numeric" /><AdminInput label="Giới hạn sử dụng *" value={limit} onChangeText={setLimit} keyboardType="numeric" /><AdminInput label="Phạm vi áp dụng" value={scope} onChangeText={setScope} /><AdminText weight="medium">Trạng thái</AdminText><View style={{ flexDirection: 'row', gap: 8 }}><AdminButton label="Đang áp dụng" variant={status === 'ACTIVE' ? 'primary' : 'outline'} onPress={() => setStatus('ACTIVE')} /><AdminButton label="Ngừng áp dụng" variant={status === 'INACTIVE' ? 'primary' : 'outline'} onPress={() => setStatus('INACTIVE')} /></View>{error ? <AdminText style={{ color: '#B91C1C' }}>{error}</AdminText> : null}<AdminButton label="Lưu mã ưu đãi" onPress={save} style={{ width: 340 }} /></View></AdminCard></AdminPage>;
}
