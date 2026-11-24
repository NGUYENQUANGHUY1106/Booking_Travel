import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { apiClient } from '@/services/api-client';
import { bookingApiError } from '@/features/traveler/booking-quote-api';
import { useTravelerStore } from '@/features/traveler/store';
import { AdminText } from '../dashboard/components';
import { AdminButton, AdminCard, AdminInput, AdminPage, AdminRow, openAdminDetail, openAdminScreen } from '../shared/ui';

type Voucher = {
  id: string; code: string; title: string; description: string | null; source: 'PLATFORM';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';
  discountType: 'PERCENT' | 'FIXED'; discountValue: string; maxDiscount: string | null;
  minSpend: string; minNights: number; currency: string; startsAt: string; endsAt: string;
  hotelIds: string[]; eligibleUserIds: string[]; globalLimit: number; perUserLimit: number;
  budget: string; reservedCount: number; consumedCount: number; reservedAmount: string;
  consumedAmount: string; version: number; createdById: string; updatedAt: string;
  audits?: { id: string; actorId: string; action: string; reason: string; createdAt: string }[];
  _count?: { redemptions: number };
};
type OwnerDeal = {
  id: string; code: string; title: string; source: 'OWNER'; status: string; effectiveStatus: string;
  discountType: 'PERCENT' | 'FIXED'; discountValue: string; maxDiscount: string | null;
  startsAt: string; endsAt: string; stayStart: string; stayEnd: string; roomIds: string[];
  minNights: number; quota: number; reservedCount: number; consumedCount: number; remaining: number;
  hotel: { id: string; name: string; owner: { id: string; fullName: string | null } };
  audits?: { id: string; action: string; reason: string | null; createdAt: string }[];
};
type Page<T> = { items: T[]; total: number; page: number; limit: number };
type Redemption = { id: string; bookingId: string; amount: string; currency: string; status: string; createdAt: string };
type Form = {
  code: string; title: string; description: string; discountType: 'PERCENT' | 'FIXED';
  discountValue: string; maxDiscount: string; minSpend: string; minNights: string;
  currency: string; startsAt: string; endsAt: string; hotelIds: string;
  eligibleUserIds: string; globalLimit: string; perUserLimit: string; budget: string;
};
const INITIAL: Form = {
  code: '', title: '', description: '', discountType: 'PERCENT',
  discountValue: '', maxDiscount: '', minSpend: '0', minNights: '1', currency: 'VND',
  startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  hotelIds: '', eligibleUserIds: '', globalLimit: '100', perUserLimit: '1', budget: '',
};
const STATUS: Record<string, string> = {
  DRAFT: 'Bản nháp', ACTIVE: 'Đang áp dụng', PAUSED: 'Tạm dừng', ENDED: 'Đã kết thúc',
  SCHEDULED: 'Chưa đến hạn', EXPIRED: 'Hết hạn', EXHAUSTED: 'Hết lượt hoặc ngân sách',
  RESERVED: 'Đang giữ', CONSUMED: 'Đã sử dụng', RELEASED: 'Đã giải phóng',
};
const KEY = ['admin-platform-vouchers'];
const money = (value: string, currency = 'VND') => new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(Number(value));
const date = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const dayInVietnam = (value: string) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const finalStayNight = (exclusiveEnd: string) => new Date(Date.parse(`${exclusiveEnd.slice(0, 10)}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10).split('-').reverse().join('/');
const ids = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const effective = (v: Voucher) => {
  if (v.status !== 'ACTIVE') return v.status;
  if (Date.now() < Date.parse(v.startsAt)) return 'SCHEDULED';
  if (Date.now() >= Date.parse(v.endsAt)) return 'EXPIRED';
  if (v.reservedCount + v.consumedCount >= v.globalLimit ||
      Number(v.reservedAmount) + Number(v.consumedAmount) >= Number(v.budget)) return 'EXHAUSTED';
  return 'ACTIVE';
};

export function PromotionsScreen() {
  const userId = useTravelerStore((state) => state.session?.mode === 'api' ? state.session.userId : '');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [discountType, setDiscountType] = useState('');
  const [scope, setScope] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<'ALL' | 'PLATFORM' | 'OWNER'>('ALL');
  const result = useQuery({
    queryKey: [...KEY, userId, search, filter, discountType, scope, sort, page],
    queryFn: async () => (await apiClient.get<Page<Voucher>>('/admin/campaigns', {
      params: { search: search.trim() || undefined, status: filter || undefined,
        discountType: discountType || undefined, scope: scope || undefined, sort, page, limit: 20 },
    })).data,
    enabled: Boolean(userId) && source !== 'OWNER', retry: false,
  });
  const ownerResult = useQuery({
    queryKey: ['admin-owner-promotions', userId, search, filter, page],
    queryFn: async () => (await apiClient.get<Page<OwnerDeal>>('/admin/owner-promotions', {
      params: { search: search.trim() || undefined, status: filter || undefined, discountType: discountType || undefined, page, limit: 20 },
    })).data,
    enabled: Boolean(userId) && source !== 'PLATFORM', retry: false,
  });
  return <AdminPage title="Ưu đãi và mã giảm giá" subtitle="Ưu đãi nền tảng và khách sạn · dữ liệu từ hệ thống">
    <AdminCard title="Ưu đãi nền tảng"><AdminText>Booking Travel tài trợ; giá và điều kiện được kiểm tra lại khi khách đặt phòng.</AdminText><AdminButton label="Tạo mã ưu đãi" onPress={() => openAdminScreen('voucher')} /></AdminCard>
    <AdminCard title="Tìm kiếm và lọc"><AdminInput label="Mã hoặc tên chương trình" value={search} onChangeText={(value) => { setPage(1); setSearch(value); }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{([['ALL', 'Tất cả'], ['PLATFORM', 'Toàn nền tảng'], ['OWNER', 'Của khách sạn']] as const).map(([value, label]) => <AdminButton key={value} label={label} variant={source === value ? 'primary' : 'outline'} onPress={() => { setSource(value); setFilter(''); setScope(''); setPage(1); }} />)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(source === 'PLATFORM' ? ['', 'DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'EXHAUSTED', 'ENDED'] : ['', 'DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ENDED']).map((value) =>
        <AdminButton key={value || 'all'} label={STATUS[value] ?? 'Tất cả'} variant={filter === value ? 'primary' : 'outline'} onPress={() => { setPage(1); setFilter(value); }} />)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[
        ['', 'Mọi loại giảm'], ['PERCENT', 'Theo %'], ['FIXED', 'Số tiền'],
      ].map(([value, label]) => <AdminButton key={label} label={label}
        variant={discountType === value ? 'primary' : 'outline'}
        onPress={() => { setPage(1); setDiscountType(value); }} />)}</View>
      {source === 'PLATFORM' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[
        ['', 'Mọi phạm vi'], ['ALL', 'Toàn nền tảng'], ['HOTEL', 'Khách sạn chọn'],
      ].map(([value, label]) => <AdminButton key={label} label={label}
        variant={scope === value ? 'primary' : 'outline'}
        onPress={() => { setPage(1); setScope(value); }} />)}</View> : null}
      <AdminButton label={sort === 'newest' ? 'Mới cập nhật trước' : 'Cũ cập nhật trước'}
        variant="outline" onPress={() => { setPage(1); setSort(sort === 'newest' ? 'oldest' : 'newest'); }} />
    </AdminCard>
    {source !== 'OWNER' ? <AdminCard title={`Voucher nền tảng · ${result.data?.total ?? 0} mã`}>
      {result.isLoading ? <AdminText>Đang tải ưu đãi...</AdminText> : null}
      {result.error ? <><AdminText style={{ color: '#B91C1C' }}>{bookingApiError(result.error)}</AdminText><AdminButton label="Thử lại" onPress={() => void result.refetch()} /></> : null}
      {result.data?.items.length === 0 ? <AdminText>Chưa có mã phù hợp.</AdminText> : null}
      {result.data?.items.map((v) => <AdminRow key={v.id} title={`${v.code} · ${v.title}`}
        subtitle={`${v.discountType === 'PERCENT' ? `${v.discountValue}% · tối đa ${v.maxDiscount ? money(v.maxDiscount) : '—'}` : money(v.discountValue)} · ${date(v.startsAt)} – ${date(v.endsAt)} · ${v.hotelIds.length ? `${v.hotelIds.length} khách sạn` : 'Mọi khách sạn'} · Dùng ${v.consumedCount}/${v.globalLimit}, giữ ${v.reservedCount} · Ngân sách ${money(v.budget)}, còn ${money(String(Number(v.budget) - Number(v.consumedAmount) - Number(v.reservedAmount)))} · Tạo bởi ${v.createdById} · Cập nhật ${date(v.updatedAt)}`}
        status={STATUS[effective(v)]} onPress={() => openAdminScreen('voucher', v.id)} />)}
    </AdminCard> : null}
    {source !== 'PLATFORM' ? <AdminCard title={`Ưu đãi khách sạn · ${ownerResult.data?.total ?? 0} mã`}>
      {ownerResult.isLoading ? <AdminText>Đang tải ưu đãi khách sạn...</AdminText> : null}
      {ownerResult.error ? <><AdminText style={{ color: '#B91C1C' }}>{bookingApiError(ownerResult.error)}</AdminText><AdminButton label="Thử lại" onPress={() => void ownerResult.refetch()} /></> : null}
      {ownerResult.data?.items.length === 0 ? <AdminText>Chưa có ưu đãi khách sạn phù hợp.</AdminText> : null}
      {ownerResult.data?.items.map((deal) => <AdminRow key={deal.id} title={`${deal.code} · ${deal.title}`}
        subtitle={`${deal.hotel.name} · Chủ: ${deal.hotel.owner.fullName ?? deal.hotel.owner.id} · ${deal.discountType === 'PERCENT' ? `${deal.discountValue}%` : money(deal.discountValue)} · ${date(deal.startsAt)} – ${date(deal.endsAt)} · Phòng: ${deal.roomIds.length ? deal.roomIds.length : 'Tất cả'} · Dùng ${deal.consumedCount}/${deal.quota}, giữ ${deal.reservedCount}`}
        status={STATUS[deal.effectiveStatus] ?? deal.effectiveStatus} onPress={() => openAdminScreen('voucher', `owner:${deal.id}`)} />)}
    </AdminCard> : null}
    <AdminCard><View style={{ flexDirection: 'row', gap: 8 }}><AdminButton label="Trước" variant="outline" disabled={page <= 1} onPress={() => setPage(page - 1)} /><AdminButton label="Sau" variant="outline" disabled={!(source === 'ALL' ? (page * 20 < (result.data?.total ?? 0) || page * 20 < (ownerResult.data?.total ?? 0)) : source === 'PLATFORM' ? page * 20 < (result.data?.total ?? 0) : page * 20 < (ownerResult.data?.total ?? 0))} onPress={() => setPage(page + 1)} /></View></AdminCard>
  </AdminPage>;
}

export function VoucherScreen({ id }: { id?: string }) {
  return id?.startsWith('owner:') ? <OwnerDealDetail id={id.slice(6)} /> : <PlatformVoucherScreen id={id} />;
}

function OwnerDealDetail({ id }: { id: string }) {
  const deal = useQuery({ queryKey: ['admin-owner-promotion', id], queryFn: async () => (await apiClient.get<OwnerDeal>(`/admin/owner-promotions/${id}`)).data, retry: false });
  return <AdminPage title="Chi tiết ưu đãi khách sạn" subtitle="Chỉ xem · Chủ khách sạn quản lý điều kiện và trạng thái">
    {deal.isLoading ? <AdminText>Đang tải...</AdminText> : null}
    {deal.error ? <AdminCard><AdminText style={{ color: '#B91C1C' }}>{bookingApiError(deal.error)}</AdminText><AdminButton label="Thử lại" onPress={() => void deal.refetch()} /></AdminCard> : null}
    {deal.data ? <><AdminCard title={`${deal.data.code} · ${deal.data.title}`}>
      <AdminText>Khách sạn: {deal.data.hotel.name} · Chủ: {deal.data.hotel.owner.fullName ?? deal.data.hotel.owner.id}</AdminText>
      <AdminText>Trạng thái: {STATUS[deal.data.effectiveStatus] ?? deal.data.effectiveStatus}</AdminText>
      <AdminText>Mức giảm: {deal.data.discountType === 'PERCENT' ? `${deal.data.discountValue}%` : money(deal.data.discountValue)}</AdminText>
      <AdminText>Số tiền giảm tối đa cho mỗi đơn đặt phòng: {deal.data.maxDiscount ? money(deal.data.maxDiscount) : 'Không giới hạn riêng'}</AdminText>
      <AdminText>Đặt từ ngày {dayInVietnam(deal.data.startsAt)} đến hết ngày {dayInVietnam(new Date(Date.parse(deal.data.endsAt) - 1).toISOString())}</AdminText>
      <AdminText>Đêm lưu trú từ {dayInVietnam(deal.data.stayStart)} đến hết {finalStayNight(deal.data.stayEnd)} · Tối thiểu {deal.data.minNights} đêm</AdminText>
      <AdminText>Phòng: {deal.data.roomIds.length ? deal.data.roomIds.join(', ') : 'Tất cả hạng phòng'}</AdminText>
      <AdminText>Đã dùng {deal.data.consumedCount} · Đang giữ {deal.data.reservedCount} · Còn {deal.data.remaining}/{deal.data.quota}</AdminText>
    </AdminCard><AdminCard title="Lịch sử thay đổi">{deal.data.audits?.map((audit) => <AdminText key={audit.id}>{date(audit.createdAt)} · {audit.action}{audit.reason ? ` · ${audit.reason}` : ''}</AdminText>)}</AdminCard></> : null}
    <AdminButton label="Về danh sách" variant="outline" onPress={() => router.push({ pathname: '/admin/[section]', params: { section: 'promotions' } } as Href)} />
  </AdminPage>;
}

function PlatformVoucherScreen({ id }: { id?: string }) {
  const userId = useTravelerStore((state) => state.session?.mode === 'api' ? state.session.userId : '');
  const client = useQueryClient();
  const [overrides, setOverrides] = useState<Partial<Form>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [previewRoomId, setPreviewRoomId] = useState('');
  const [previewUserId, setPreviewUserId] = useState('');
  const [previewCheckIn, setPreviewCheckIn] = useState('');
  const [previewCheckOut, setPreviewCheckOut] = useState('');
  const [pendingAction, setPendingAction] = useState<'activate' | 'pause' | 'end' | null>(null);
  const detail = useQuery({
    queryKey: [...KEY, 'detail', userId, id],
    queryFn: async () => (await apiClient.get<Voucher>(`/admin/campaigns/${id}`)).data,
    enabled: Boolean(userId && id), retry: false,
  });
  const redemptions = useQuery({
    queryKey: [...KEY, 'redemptions', userId, id, page],
    queryFn: async () => (await apiClient.get<Page<Redemption>>(`/admin/campaigns/${id}/redemptions`, { params: { page } })).data,
    enabled: Boolean(userId && id), retry: false,
  });
  const form: Form = {
    ...INITIAL,
    ...(detail.data ? {
      code: detail.data.code, title: detail.data.title,
      description: detail.data.description ?? '', discountType: detail.data.discountType,
      discountValue: detail.data.discountValue, maxDiscount: detail.data.maxDiscount ?? '',
      minSpend: detail.data.minSpend, minNights: String(detail.data.minNights),
      currency: detail.data.currency, startsAt: detail.data.startsAt, endsAt: detail.data.endsAt,
      hotelIds: detail.data.hotelIds.join(', '), eligibleUserIds: detail.data.eligibleUserIds.join(', '),
      globalLimit: String(detail.data.globalLimit), perUserLimit: String(detail.data.perUserLimit),
      budget: detail.data.budget,
    } : {}),
    ...overrides,
  };
  const mutation = useMutation({
    mutationFn: async (action: 'save' | 'activate' | 'pause' | 'end') => {
      if (id && !detail.data) throw new Error('Chưa tải được mã ưu đãi.');
      if (id && reason.trim().length < 5) throw new Error('Nhập lý do ít nhất 5 ký tự.');
      if (action !== 'save') return (await apiClient.post<Voucher>(`/admin/campaigns/${id}/${action}`, { version: detail.data!.version, reason: reason.trim() })).data;
      if (!form.code.trim() || !form.title.trim() || !form.discountValue || !form.budget ||
          !Number.isFinite(Date.parse(form.startsAt)) || !Number.isFinite(Date.parse(form.endsAt)))
        throw new Error('Nhập đủ mã, tên, mức giảm, ngân sách và thời gian ISO hợp lệ.');
      const payload = {
        ...form, code: form.code.trim().toUpperCase(), maxDiscount: form.maxDiscount || undefined,
        minNights: Number(form.minNights), globalLimit: Number(form.globalLimit),
        perUserLimit: Number(form.perUserLimit), hotelIds: ids(form.hotelIds),
        eligibleUserIds: ids(form.eligibleUserIds),
      };
      return id
        ? (await apiClient.patch<Voucher>(`/admin/campaigns/${id}`, { ...payload, version: detail.data!.version, reason: reason.trim() })).data
        : (await apiClient.post<Voucher>('/admin/campaigns', payload)).data;
    },
    onSuccess: (v) => {
      setError('');
      setPendingAction(null);
      void client.invalidateQueries({ queryKey: KEY });
      if (!id) router.replace({ pathname: '/admin/[section]', params: { section: 'voucher', id: v.id } } as unknown as Href);
    },
    onError: (caught) => setError(caught instanceof Error && !('response' in caught) ? caught.message : bookingApiError(caught)),
  });
  const preview = useMutation({
    mutationFn: async () => (await apiClient.post<{
      subtotal: string; discount: string; finalAmount: string; note: string;
    }>(`/admin/campaigns/${id}/preview`, {
      roomId: previewRoomId.trim(), userId: previewUserId.trim(),
      checkIn: previewCheckIn.trim(), checkOut: previewCheckOut.trim(), roomCount: 1,
    })).data,
  });
  const set = (key: keyof Form) => (value: string) => setOverrides((current) => ({ ...current, [key]: value }));
  const readonly = Boolean(id && (detail.data?.status === 'ACTIVE' || detail.data?.status === 'ENDED' ||
    detail.data?.reservedCount || detail.data?.consumedCount || (detail.data?._count?.redemptions ?? 0) > 0));
  const fields: { key: keyof Form; label: string; numeric?: boolean }[] = [
    { key: 'code', label: 'Mã ưu đãi *' }, { key: 'title', label: 'Tên chương trình *' },
    { key: 'description', label: 'Mô tả nội bộ' },
    { key: 'discountValue', label: form.discountType === 'PERCENT' ? 'Mức giảm (%) *' : 'Số tiền giảm (₫) *', numeric: true },
    { key: 'maxDiscount', label: 'Giảm tối đa (₫; bắt buộc với %)', numeric: true },
    { key: 'minSpend', label: 'Giá trị đặt phòng tối thiểu (₫)', numeric: true },
    { key: 'minNights', label: 'Số đêm tối thiểu', numeric: true },
    { key: 'startsAt', label: 'Bắt đầu (ISO 8601 có múi giờ) *' },
    { key: 'endsAt', label: 'Kết thúc (ISO 8601 có múi giờ) *' },
    { key: 'hotelIds', label: 'ID khách sạn, cách nhau bằng dấu phẩy; trống = tất cả' },
    { key: 'eligibleUserIds', label: 'ID khách được áp dụng; trống = tất cả' },
    { key: 'globalLimit', label: 'Tổng lượt dùng *', numeric: true },
    { key: 'perUserLimit', label: 'Lượt tối đa mỗi khách *', numeric: true },
    { key: 'budget', label: 'Ngân sách nền tảng (₫) *', numeric: true },
  ];
  return <AdminPage title={id ? 'Chi tiết mã ưu đãi' : 'Tạo mã ưu đãi'} subtitle="Voucher nền tảng · quyết định được ghi nhận">
    <AdminCard title="Ưu đãi nền tảng">
      <AdminText>Giá được chốt ở booking. Mã đang hoạt động hoặc đã dùng không thể đổi điều kiện.</AdminText>
      {detail.isLoading ? <AdminText>Đang tải...</AdminText> : null}
      {detail.error ? <><AdminText style={{ color: '#B91C1C' }}>{bookingApiError(detail.error)}</AdminText><AdminButton label="Thử lại" onPress={() => void detail.refetch()} /></> : null}
      {detail.data ? <AdminText weight="semibold">{STATUS[effective(detail.data)]} · Phiên bản {detail.data.version}</AdminText> : null}
    </AdminCard>
    {(!id || detail.data) ? <AdminCard title="Thông tin và điều kiện">
      {!readonly ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <AdminButton label="Phần trăm" variant={form.discountType === 'PERCENT' ? 'primary' : 'outline'} onPress={() => setOverrides((v) => ({ ...v, discountType: 'PERCENT' }))} />
        <AdminButton label="Số tiền" variant={form.discountType === 'FIXED' ? 'primary' : 'outline'} onPress={() => setOverrides((v) => ({ ...v, discountType: 'FIXED' }))} />
      </View> : null}
      {readonly ? <AdminText>Điều kiện đã khóa: {form.discountType === 'PERCENT' ? `${form.discountValue}%` : money(form.discountValue)}; tối đa {form.maxDiscount ? money(form.maxDiscount) : 'không đặt'}; tối thiểu {money(form.minSpend)}; {form.minNights} đêm; phạm vi {form.hotelIds || 'mọi khách sạn'}; hiệu lực {date(form.startsAt)} – {date(form.endsAt)}.</AdminText>
        : fields.map((field) => <AdminInput key={field.key} label={field.label} value={form[field.key]} onChangeText={set(field.key)} keyboardType={field.numeric ? 'numeric' : 'default'} />)}
      {id ? <AdminInput label="Lý do quyết định (bắt buộc)" value={reason} onChangeText={setReason} /> : null}
      {error ? <AdminText style={{ color: '#B91C1C' }}>{error}</AdminText> : null}
      {!readonly ? <AdminButton label={id ? 'Lưu thay đổi' : 'Tạo bản nháp'} disabled={mutation.isPending} onPress={() => mutation.mutate('save')} /> : null}
      <AdminButton label="Về danh sách" variant="outline" onPress={() => router.push({ pathname: '/admin/[section]', params: { section: 'promotions' } } as unknown as Href)} />
    </AdminCard> : null}
    {detail.data ? <>
      <AdminCard title="Xem trước giá với dữ liệu thật">
        <AdminText>Nhập ID phòng, ID khách và ngày lưu trú để tính thử. Xem trước không giữ lượt sử dụng.</AdminText>
        <AdminInput label="ID hạng phòng" value={previewRoomId} onChangeText={setPreviewRoomId} />
        <AdminInput label="ID khách hàng" value={previewUserId} onChangeText={setPreviewUserId} />
        <AdminInput label="Nhận phòng (YYYY-MM-DD)" value={previewCheckIn} onChangeText={setPreviewCheckIn} />
        <AdminInput label="Trả phòng (YYYY-MM-DD)" value={previewCheckOut} onChangeText={setPreviewCheckOut} />
        <AdminButton label="Tính thử" disabled={preview.isPending || !previewRoomId || !previewUserId || !previewCheckIn || !previewCheckOut}
          onPress={() => preview.mutate()} />
        {preview.error ? <AdminText style={{ color: '#B91C1C' }}>{bookingApiError(preview.error)}</AdminText> : null}
        {preview.data ? <>
          <AdminText>Giá phòng: {money(preview.data.subtotal)}</AdminText>
          <AdminText>Voucher giảm: {money(preview.data.discount)}</AdminText>
          <AdminText weight="semibold">Khách trả: {money(preview.data.finalAmount)}</AdminText>
          <AdminText>{preview.data.note}</AdminText>
        </> : null}
      </AdminCard>
      <AdminCard title="Ngân sách và trạng thái">
        <AdminText>Đã dùng: {detail.data.consumedCount}/{detail.data.globalLimit} lượt · {money(detail.data.consumedAmount)}</AdminText>
        <AdminText>Đang giữ: {detail.data.reservedCount} lượt · {money(detail.data.reservedAmount)}</AdminText>
        <AdminText>Còn lại: {money(String(Number(detail.data.budget) - Number(detail.data.reservedAmount) - Number(detail.data.consumedAmount)))}</AdminText>
        <AdminText>Thao tác chỉ ảnh hưởng booking mới; booking đã chốt không đổi giá.</AdminText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['activate', 'pause', 'end'] as const).map((action) =>
            <AdminButton key={action} label={{ activate: 'Kích hoạt', pause: 'Tạm dừng', end: 'Kết thúc' }[action]}
              variant={action === 'end' ? 'danger' : 'outline'}
              disabled={mutation.isPending || reason.trim().length < 5 ||
                (action === 'activate' ? !['DRAFT', 'PAUSED'].includes(detail.data!.status)
                  : action === 'pause' ? detail.data!.status !== 'ACTIVE' : detail.data!.status === 'ENDED')}
              onPress={() => setPendingAction(action)} />)}
        </View>
        {pendingAction ? <View style={{ gap: 8 }}>
          <AdminText weight="semibold">Xác nhận {({ activate: 'kích hoạt', pause: 'tạm dừng', end: 'kết thúc' } as const)[pendingAction]} mã {detail.data.code}?</AdminText>
          <AdminText>Quyết định này chỉ ảnh hưởng lượt đặt phòng mới. Lý do đã nhập sẽ được lưu vào nhật ký.</AdminText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AdminButton label="Hủy" variant="outline" onPress={() => setPendingAction(null)} />
            <AdminButton label="Xác nhận" variant={pendingAction === 'end' ? 'danger' : 'primary'}
              disabled={mutation.isPending} onPress={() => mutation.mutate(pendingAction)} />
          </View>
        </View> : null}
      </AdminCard>
      <AdminCard title={`Lượt sử dụng · ${redemptions.data?.total ?? 0}`}>
        {redemptions.isLoading ? <AdminText>Đang tải...</AdminText> : null}
        {redemptions.error ? <AdminText style={{ color: '#B91C1C' }}>{bookingApiError(redemptions.error)}</AdminText> : null}
        {redemptions.data?.items.length === 0 ? <AdminText>Chưa có lượt dùng.</AdminText> : null}
        {redemptions.data?.items.map((r) => <AdminRow key={r.id} title={`Booking ${r.bookingId}`}
          subtitle={`${money(r.amount, r.currency)} · ${date(r.createdAt)}`} status={STATUS[r.status]}
          onPress={() => openAdminDetail('bookings', r.bookingId)} />)}
        <View style={{ flexDirection: 'row', gap: 8 }}><AdminButton label="Trước" variant="outline" disabled={page <= 1} onPress={() => setPage(page - 1)} /><AdminButton label="Sau" variant="outline" disabled={!redemptions.data || page * 20 >= redemptions.data.total} onPress={() => setPage(page + 1)} /></View>
      </AdminCard>
      <AdminCard title="Nhật ký quyết định">
        {detail.data.audits?.map((a) => <AdminRow key={a.id} title={`${a.action} · ${date(a.createdAt)}`} subtitle={`Admin ${a.actorId} · ${a.reason}`} />)}
      </AdminCard>
    </> : null}
  </AdminPage>;
}
