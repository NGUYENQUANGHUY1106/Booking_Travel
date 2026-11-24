import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useTravelerStore } from '@/features/traveler/store';
import { InfoCard, OwnerButton, OwnerScaffold, StatusPanel } from '../components/owner-ui';
import { ownerScreenHref } from '../navigation';
import { ownerColors, OWNER_FONT } from '../styles/tokens';
import { useOwnerHotels } from '../hotels/api';
import { useOwnerRooms } from '../hotels/room-api';
import { promotionKey, promotionsApi, useOwnerPromotions, type OwnerPromotion, type OwnerPromotionInput, type PromotionPreview } from '../hotels/promotions-api';

const STATUS = [
  ['ALL', 'Tất cả'], ['DRAFT', 'Bản nháp'], ['ACTIVE', 'Đang chạy'],
  ['PAUSED', 'Tạm dừng'], ['ENDED', 'Đã kết thúc'], ['EXPIRED', 'Hết hạn'],
  ['SCHEDULED', 'Chưa tới ngày'], ['EXHAUSTED', 'Hết lượt'],
] as const;
const DATE_MS = 86_400_000;
const day = (value: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const addDay = (value: string) => new Date(Date.parse(`${value}T00:00:00Z`) + DATE_MS).toISOString().slice(0, 10);
const addDays = (value: string, count: number) => new Date(Date.parse(`${value}T00:00:00Z`) + count * DATE_MS).toISOString().slice(0, 10);
const previousDay = (value: string) => new Date(Date.parse(`${value}T00:00:00Z`) - DATE_MS).toISOString().slice(0, 10);
const shortDate = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
const localTimestamp = (value: string) => `${value}T00:00:00+07:00`;
const money = (value: string) => `${Number(value).toLocaleString('vi-VN')} ₫`;
const errorText = (error: unknown) => isAxiosError(error) ? (typeof error.response?.data?.message === 'string' ? error.response.data.message : 'Không thể lưu ưu đãi. Vui lòng thử lại.') : 'Không thể kết nối. Vui lòng thử lại.';
const editHref = (hotelId: string, promotionId?: string) => ({ pathname: '/hotel-owner/screen/[id]', params: { id: 'promotion-edit', hotelId, ...(promotionId ? { promotionId } : {}) } }) as const;

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>;
}

function DatePicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const first = new Date(`${month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const move = (delta: number) => setMonth(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1)).toISOString().slice(0, 7));
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${shortDate(value)}`} onPress={() => setOpen(true)} style={styles.dateButton}>
      <Text style={styles.fieldValue}>{shortDate(value)}</Text><Text style={styles.hint}>Chạm để chọn ngày</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.modalBackdrop}><View style={styles.calendar}>
        <Text style={styles.cardTitle}>{label}</Text>
        <View style={styles.calendarHead}>
          <Pressable accessibilityRole="button" accessibilityLabel="Tháng trước" onPress={() => move(-1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>‹</Text></Pressable>
          <Text style={styles.monthLabel}>Tháng {month.slice(5)}/{month.slice(0, 4)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Tháng sau" onPress={() => move(1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>›</Text></Pressable>
        </View>
        <View style={styles.calendarGrid}>{['T2','T3','T4','T5','T6','T7','CN'].map((item) => <Text key={item} style={styles.calendarCell}>{item}</Text>)}
          {Array.from({ length: offset }, (_, i) => <View key={`blank-${i}`} style={styles.calendarCell} />)}
          {Array.from({ length: count }, (_, i) => {
            const selected = `${month}-${String(i + 1).padStart(2, '0')}`;
            return <Pressable key={selected} accessibilityRole="button" accessibilityLabel={shortDate(selected)} onPress={() => { onChange(selected); setOpen(false); }} style={[styles.calendarCell, value === selected && styles.selectedDay]}><Text style={[styles.calendarDay, value === selected && styles.selectedDayText]}>{i + 1}</Text></Pressable>;
          })}
        </View><OwnerButton secondary label="Đóng" onPress={() => setOpen(false)} />
      </View></View>
    </Modal>
  </>;
}

function Field({ label, value, onChangeText, keyboardType = 'default', multiline = false }: { label: string; value: string; onChangeText: (text: string) => void; keyboardType?: 'default' | 'numeric'; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && { minHeight: 78 }]} placeholderTextColor={ownerColors.muted} /></View>;
}

function HotelPicker({ hotels, value, choose }: { hotels: { id: string; name: string }[]; value?: string; choose: (id: string) => void }) {
  if (hotels.length < 2) return null;
  return <View style={styles.field}><Text style={styles.label}>Khách sạn</Text><View style={styles.choices}>{hotels.map((hotel) => <Choice key={hotel.id} label={hotel.name} active={value === hotel.id} onPress={() => choose(hotel.id)} />)}</View></View>;
}

function PromotionCard({ item, roomNames, onEdit, onAction, busy }: { item: OwnerPromotion; roomNames: string; onEdit: () => void; onAction: (action: 'activate' | 'pause' | 'end') => void; busy: boolean }) {
  const status = STATUS.find(([code]) => code === item.effectiveStatus)?.[1] ?? item.effectiveStatus;
  return <InfoCard style={styles.card}>
    <View style={styles.cardTop}><Text style={styles.cardTitle}>{item.title} · {item.code}</Text><Text style={styles.badge}>{status}</Text></View>
    {item.status === 'DRAFT' ? <Text style={styles.muted}>Bản nháp chưa áp dụng cho khách. Hãy kích hoạt sau khi kiểm tra.</Text> : null}
    <Text style={styles.body}>{item.discountType === 'PERCENT' ? `Giảm ${item.discountValue}%` : `Giảm ${money(item.discountValue)}`}{item.maxDiscount ? ` · Tối đa ${money(item.maxDiscount)}` : ''} · Từ {item.minNights} đêm</Text>
    <Text style={styles.muted}>Phòng: {roomNames}</Text>
    <Text style={styles.muted}>Đặt trong: {shortDate(day(new Date(item.startsAt)))} – {shortDate(previousDay(day(new Date(item.endsAt))))}</Text>
    <Text style={styles.muted}>Lưu trú: {shortDate(item.stayStart.slice(0, 10))} – {shortDate(previousDay(item.stayEnd.slice(0, 10)))}</Text>
    <Text style={styles.muted}>Đã dùng {item.consumedCount} · Đang giữ {item.reservedCount} · Còn {item.remaining}/{item.quota}</Text>
    <View style={styles.choices}>
      {['DRAFT','PAUSED'].includes(item.status) && item.reservedCount + item.consumedCount === 0 ? <Choice label="Sửa" active={false} onPress={onEdit} /> : null}
      {['DRAFT','PAUSED'].includes(item.status) && item.effectiveStatus !== 'EXPIRED' ? <Choice label="Kích hoạt" active={false} onPress={() => onAction('activate')} /> : null}
      {item.status === 'ACTIVE' && item.effectiveStatus !== 'EXPIRED' ? <Choice label="Tạm dừng" active={false} onPress={() => onAction('pause')} /> : null}
      {item.status !== 'ENDED' ? <Choice label="Kết thúc" active={false} onPress={() => onAction('end')} /> : null}
    </View>{busy ? <ActivityIndicator color={ownerColors.primary} /> : null}
  </InfoCard>;
}

export function OwnerPromotionsScreen() {
  const params = useLocalSearchParams<{ hotelId?: string }>();
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const hotels = useOwnerHotels(userId);
  const [chosenHotel, setChosenHotel] = useState<string>();
  const hotelId = hotels.data ? [chosenHotel, params.hotelId].find((id) => hotels.data.some((hotel) => hotel.id === id)) ?? hotels.data[0]?.id : undefined;
  const rooms = useOwnerRooms(userId, hotelId);
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<{ item: OwnerPromotion; action: 'pause' | 'end' }>();
  const [actionReason, setActionReason] = useState('');
  const list = useOwnerPromotions(userId, hotelId, status, page);
  const client = useQueryClient();
  const perform = async (item: OwnerPromotion, action: 'activate' | 'pause' | 'end', reason?: string) => {
    if (!hotelId || busy) return;
    setBusy(item.id); setError('');
    try {
      await promotionsApi.action(hotelId, item.id, action, item.version, reason);
      await client.invalidateQueries({ queryKey: promotionKey(userId ?? '', hotelId) });
      setPendingAction(undefined);
      setActionReason('');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(undefined); }
  };
  const act = (item: OwnerPromotion, action: 'activate' | 'pause' | 'end') => {
    if (action === 'activate') void perform(item, action);
    else { setActionReason(''); setPendingAction({ item, action }); }
  };
  return <OwnerScaffold title="Ưu đãi" onRefresh={() => void list.refetch()} refreshing={list.isRefetching} footer={hotelId ? <OwnerButton label="Tạo ưu đãi" onPress={() => router.push(editHref(hotelId))} /> : undefined}>
    {!userId ? <StatusPanel title="Cần đăng nhập" body="Đăng nhập bằng tài khoản chủ khách sạn đã xác minh." /> : null}
    {hotels.isLoading ? <ActivityIndicator /> : hotels.isError ? <StatusPanel title="Không tải được khách sạn" body={errorText(hotels.error)} tone="red" /> : null}
    <HotelPicker hotels={hotels.data ?? []} value={hotelId} choose={(id) => { setChosenHotel(id); setPage(1); }} />
    {hotels.data?.length === 0 ? <StatusPanel title="Chưa có khách sạn" body="Tạo khách sạn trước khi thiết lập ưu đãi." /> : null}
    {hotelId ? <><View style={styles.choices}>{STATUS.filter(([value]) => value !== 'SCHEDULED' && value !== 'EXHAUSTED').map(([value,label]) => <Choice key={value} label={label} active={status === value} onPress={() => { setStatus(value); setPage(1); }} />)}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {list.isLoading ? <ActivityIndicator /> : list.isError ? <StatusPanel title="Không tải được ưu đãi" body={errorText(list.error)} tone="red" /> : null}
      {list.data && !list.data.total ? <StatusPanel title="Chưa có ưu đãi" body="Tạo chương trình để khách nhìn thấy giá giảm khi chọn ngày và phòng phù hợp." /> : null}
      {list.data?.items.map((item) => <PromotionCard key={item.id} item={item} roomNames={item.roomIds.length ? item.roomIds.map((id) => rooms.data?.find((room) => room.id === id)?.name ?? id).join(', ') : 'Tất cả hạng phòng'} onEdit={() => router.push(editHref(hotelId, item.id))} onAction={(action) => act(item, action)} busy={busy === item.id} />)}
      {list.data && list.data.total > 20 ? <View style={styles.choices}><Choice label="‹ Trước" active={false} onPress={() => setPage(Math.max(1, page - 1))} /><Text style={styles.muted}>Trang {page}/{Math.ceil(list.data.total / 20)}</Text><Choice label="Sau ›" active={false} onPress={() => setPage(Math.min(Math.ceil(list.data.total / 20), page + 1))} /></View> : null}
    </> : null}
    <Modal visible={Boolean(pendingAction)} transparent animationType="fade" onRequestClose={() => setPendingAction(undefined)}>
      <View style={styles.modalBackdrop}><View style={styles.calendar}>
        <Text style={styles.cardTitle}>{pendingAction?.action === 'pause' ? 'Tạm dừng ưu đãi?' : 'Kết thúc ưu đãi?'}</Text>
        <Text style={styles.body}>Báo giá mới sẽ không dùng ưu đãi này. Đặt phòng đã xác nhận vẫn giữ giá.</Text>
        <Field label="Lý do" value={actionReason} onChangeText={setActionReason} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OwnerButton label={busy ? 'Đang xử lý...' : 'Xác nhận'} disabled={Boolean(busy) || actionReason.trim().length < 5} onPress={() => pendingAction && void perform(pendingAction.item, pendingAction.action, actionReason.trim())} />
        <OwnerButton secondary label="Hủy" onPress={() => setPendingAction(undefined)} />
      </View></View>
    </Modal>
  </OwnerScaffold>;
}

export function OwnerPromotionEditScreen() {
  const params = useLocalSearchParams<{ hotelId?: string; promotionId?: string }>();
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const existing = useQuery({ queryKey: ['owner-promotion', userId, params.hotelId, params.promotionId], queryFn: () => promotionsApi.get(params.hotelId!, params.promotionId!), enabled: Boolean(userId && params.hotelId && params.promotionId) });
  if (params.promotionId && !existing.data) return <OwnerScaffold title="Chỉnh sửa ưu đãi">{existing.isError ? <StatusPanel title="Không tải được ưu đãi" body={errorText(existing.error)} tone="red" /> : <ActivityIndicator />}</OwnerScaffold>;
  if (existing.data && (!['DRAFT', 'PAUSED'].includes(existing.data.status) || existing.data.reservedCount + existing.data.consumedCount > 0))
    return <OwnerScaffold title="Chỉnh sửa ưu đãi"><StatusPanel title="Không thể sửa ưu đãi" body="Chương trình đang hoạt động, đã kết thúc hoặc đã có lượt sử dụng." /><OwnerButton secondary label="Quay lại" onPress={() => router.replace(ownerScreenHref('promotions', params.hotelId))} /></OwnerScaffold>;
  return <PromotionForm key={existing.data?.id ?? 'new'} initial={existing.data} />;
}

function PromotionForm({ initial }: { initial?: OwnerPromotion }) {
  const params = useLocalSearchParams<{ hotelId?: string; promotionId?: string }>();
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const hotels = useOwnerHotels(userId);
  const [chosenHotel, setChosenHotel] = useState<string>();
  const hotelId = hotels.data ? [chosenHotel, params.hotelId].find((id) => hotels.data.some((hotel) => hotel.id === id)) ?? hotels.data[0]?.id : undefined;
  const rooms = useOwnerRooms(userId, hotelId);
  const [title, setTitle] = useState(initial?.title ?? ''); const [description, setDescription] = useState(initial?.description ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [type, setType] = useState<'PERCENT' | 'FIXED'>(initial?.discountType ?? 'PERCENT'); const [value, setValue] = useState(initial?.discountValue.replace(/\.00$/, '') ?? ''); const [cap, setCap] = useState(initial?.maxDiscount?.replace(/\.00$/, '') ?? '');
  const [start, setStart] = useState(initial ? day(new Date(initial.startsAt)) : day(new Date())); const [end, setEnd] = useState(initial ? previousDay(day(new Date(initial.endsAt))) : addDay(day(new Date())));
  const [stayStart, setStayStart] = useState(initial?.stayStart.slice(0, 10) ?? day(new Date())); const [stayEnd, setStayEnd] = useState(initial ? previousDay(initial.stayEnd.slice(0, 10)) : addDay(day(new Date())));
  const [roomIds, setRoomIds] = useState<string[]>(initial?.roomIds ?? []); const [nights, setNights] = useState(String(initial?.minNights ?? 1)); const [quota, setQuota] = useState(String(initial?.quota ?? 100));
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [preview, setPreview] = useState<PromotionPreview>();
  const [previewRoom, setPreviewRoom] = useState<string>();
  const [previewStart, setPreviewStart] = useState(initial?.stayStart.slice(0, 10) ?? day(new Date()));
  const [previewEnd, setPreviewEnd] = useState(addDays(initial?.stayStart.slice(0, 10) ?? day(new Date()), initial?.minNights ?? 2));
  const client = useQueryClient();
  const validation = !title.trim() ? 'Nhập tên chương trình.' : !/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(code.trim()) ? 'Mã cần 3–64 ký tự chữ, số, gạch ngang hoặc gạch dưới.' : !/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0 ? 'Mức giảm phải lớn hơn 0.'
    : type === 'PERCENT' && (Number(value) > 100 || !/^[1-9]\d*$/.test(cap)) ? 'Giảm theo phần trăm cần giới hạn tiền giảm hợp lệ.'
    : type === 'FIXED' && !Number.isInteger(Number(value)) ? 'Số tiền giảm phải là VND nguyên.'
    : start > end || stayStart > stayEnd ? 'Ngày kết thúc phải sau ngày bắt đầu.'
    : !/^[1-9]\d*$/.test(nights) || !/^[1-9]\d*$/.test(quota) ? 'Số đêm và số lượt phải là số nguyên dương.' : '';
  const inputValue = (): OwnerPromotionInput => ({ code: code.trim().toUpperCase(), title: title.trim(), description: description.trim(), discountType: type, discountValue: value,
    maxDiscount: cap || undefined, currency: 'VND', startsAt: localTimestamp(start), endsAt: localTimestamp(addDay(end)),
    stayStart, stayEnd: addDay(stayEnd), roomIds, minNights: Number(nights), quota: Number(quota) });
  const save = async () => {
    if (!hotelId || busy || validation) { setError(validation || 'Chọn khách sạn trước khi lưu.'); return; }
    const input = inputValue();
    setBusy(true); setError('');
    try {
      if (initial) await promotionsApi.update(hotelId, initial.id, { ...input, version: initial.version });
      else await promotionsApi.create(hotelId, input);
      await client.invalidateQueries({ queryKey: promotionKey(userId ?? '', hotelId) });
      router.replace(ownerScreenHref('promotions', hotelId));
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  };
  const showPreview = async () => {
    const roomId = previewRoom ?? rooms.data?.[0]?.id;
    if (!hotelId || !roomId || busy || validation || previewEnd <= previewStart) { setError(validation || (previewEnd <= previewStart ? 'Ngày trả phòng phải sau ngày nhận phòng.' : 'Chọn một hạng phòng để xem giá.')); return; }
    setBusy(true); setError(''); setPreview(undefined);
    try { setPreview(await promotionsApi.preview(hotelId, { ...inputValue(), roomId, checkIn: previewStart, checkOut: previewEnd, roomCount: 1 })); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  };
  return <OwnerScaffold title={params.promotionId ? 'Chỉnh sửa ưu đãi' : 'Tạo ưu đãi'} footer={<View style={styles.footerButtons}><OwnerButton secondary label="Quay lại" onPress={() => router.replace(ownerScreenHref('promotions', hotelId))} /><OwnerButton label={busy ? 'Đang lưu...' : 'Lưu ưu đãi'} disabled={busy || Boolean(validation) || !hotelId || (Boolean(params.promotionId) && !initial)} onPress={() => void save()} /></View>}>
    <InfoCard style={styles.card}><Text style={styles.cardTitle}>Ưu đãi khách sạn</Text><Text style={styles.body}>Khách chọn ngày và phòng phù hợp sẽ thấy giá giảm trong báo giá. Lưu bản nháp trước khi kích hoạt.</Text></InfoCard>
    {params.promotionId ? null : <HotelPicker hotels={hotels.data ?? []} value={hotelId} choose={(id) => { setChosenHotel(id); setRoomIds([]); }} />}
    <Field label="Tên chương trình" value={title} onChangeText={setTitle} />
    {initial ? <Text style={styles.body}>Mã ưu đãi: {initial.code}</Text> : <Field label="Mã ưu đãi cho khách nhập" value={code} onChangeText={setCode} />}
    <Field label="Mô tả" value={description} onChangeText={setDescription} multiline />
    <View style={styles.field}><Text style={styles.label}>Hình thức giảm</Text><View style={styles.choices}><Choice label="Phần trăm" active={type === 'PERCENT'} onPress={() => setType('PERCENT')} /><Choice label="Số tiền" active={type === 'FIXED'} onPress={() => setType('FIXED')} /></View></View>
    <Field label={type === 'PERCENT' ? 'Mức giảm (%)' : 'Số tiền giảm (VND)'} value={value} onChangeText={setValue} keyboardType="numeric" />
    <Field label={type === 'PERCENT' ? 'Giảm tối đa (VND)' : 'Giảm tối đa (VND, tùy chọn)'} value={cap} onChangeText={setCap} keyboardType="numeric" />
    <Text style={styles.label}>Thời gian đặt được ưu đãi</Text><View style={styles.dateRow}><View style={styles.dateHalf}><DatePicker label="Bắt đầu đặt" value={start} onChange={setStart} /></View><View style={styles.dateHalf}><DatePicker label="Kết thúc đặt" value={end} onChange={setEnd} /></View></View>
    <Text style={styles.label}>Đêm lưu trú được giảm</Text><View style={styles.dateRow}><View style={styles.dateHalf}><DatePicker label="Đêm đầu" value={stayStart} onChange={setStayStart} /></View><View style={styles.dateHalf}><DatePicker label="Đêm cuối" value={stayEnd} onChange={setStayEnd} /></View></View>
    <View style={styles.field}><Text style={styles.label}>Hạng phòng áp dụng</Text><View style={styles.choices}><Choice label="Tất cả phòng" active={!roomIds.length} onPress={() => setRoomIds([])} />{rooms.data?.map((room) => <Choice key={room.id} label={room.name} active={roomIds.includes(room.id)} onPress={() => setRoomIds((current) => current.includes(room.id) ? current.filter((id) => id !== room.id) : [...current, room.id])} />)}</View></View>
    <Field label="Số đêm tối thiểu" value={nights} onChangeText={setNights} keyboardType="numeric" /><Field label="Tổng số lượt" value={quota} onChangeText={setQuota} keyboardType="numeric" />
    <InfoCard style={styles.card}><Text style={styles.cardTitle}>Điều kiện áp dụng</Text><Text style={styles.body}>{title || 'Ưu đãi mới'} · {type === 'PERCENT' ? `${value || '0'}%` : money(value || '0')} · Từ {nights || '1'} đêm</Text><Text style={styles.muted}>Chỉ giảm các đêm trong kỳ lưu trú đã chọn. Tối đa một ưu đãi khách sạn cho mỗi đơn; mã ưu đãi nền tảng không cộng dồn.</Text></InfoCard>
    <Text style={styles.label}>Kỳ ở minh họa</Text><View style={styles.dateRow}><View style={styles.dateHalf}><DatePicker label="Ngày nhận phòng" value={previewStart} onChange={(next) => { setPreviewStart(next); setPreview(undefined); }} /></View><View style={styles.dateHalf}><DatePicker label="Ngày trả phòng" value={previewEnd} onChange={(next) => { setPreviewEnd(next); setPreview(undefined); }} /></View></View>
    <Text style={styles.label}>Xem giá minh họa cho một phòng</Text><View style={styles.choices}>{rooms.data?.map((room) => <Choice key={room.id} label={room.name} active={(previewRoom ?? rooms.data?.[0]?.id) === room.id} onPress={() => { setPreviewRoom(room.id); setPreview(undefined); }} />)}</View>
    <OwnerButton secondary label={busy ? 'Đang tính...' : 'Xem giá minh họa'} disabled={busy || Boolean(validation) || !rooms.data?.length} onPress={() => void showPreview()} />
    {preview ? <InfoCard style={styles.card}><Text style={styles.cardTitle}>Giá tham khảo từ lịch giá phòng</Text><Text style={styles.muted}>Giá phòng: {money(preview.roomSubtotal)}</Text><Text style={styles.muted}>Ưu đãi: − {money(preview.discount)}</Text><Text style={styles.cardTitle}>Sau giảm: {money(preview.finalAmount)}</Text><Text style={styles.muted}>{preview.reasonCode ? 'Kỳ ở này chưa đủ điều kiện ưu đãi.' : `${preview.eligibleDates.length} đêm được giảm.`} Giá này chỉ minh họa, báo giá khách được tính lại khi đặt.</Text></InfoCard> : null}
    {validation ? <Text style={styles.error}>{validation}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}
  </OwnerScaffold>;
}

const styles = StyleSheet.create({
  card: { gap: 10 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  cardTitle: { color: ownerColors.text, fontFamily: OWNER_FONT.semibold, fontSize: 16, lineHeight: 24, flexShrink: 1 },
  body: { color: ownerColors.muted, fontFamily: OWNER_FONT.regular, fontSize: 14, lineHeight: 20 },
  muted: { color: ownerColors.muted, fontSize: 13, lineHeight: 19 }, badge: { color: ownerColors.primaryDark, fontSize: 12, fontFamily: OWNER_FONT.semibold },
  field: { gap: 8 }, label: { color: '#374151', fontSize: 14, fontFamily: OWNER_FONT.semibold },
  fieldValue: { color: ownerColors.text, fontSize: 16, fontFamily: OWNER_FONT.semibold }, hint: { color: ownerColors.muted, fontSize: 12 },
  input: { minHeight: 52, borderRadius: 12, backgroundColor: ownerColors.surface, paddingHorizontal: 14, paddingVertical: 12, color: ownerColors.text, fontSize: 16 },
  dateButton: { minHeight: 58, borderRadius: 12, padding: 12, backgroundColor: ownerColors.surface, gap: 4 },
  dateRow: { flexDirection: 'row', gap: 8 }, dateHalf: { flex: 1 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderRadius: 12, borderWidth: 1, borderColor: ownerColors.border, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: ownerColors.surface },
  choiceActive: { backgroundColor: ownerColors.primary, borderColor: ownerColors.primary }, choiceText: { color: ownerColors.text, fontSize: 13, fontFamily: OWNER_FONT.medium }, choiceTextActive: { color: '#FFFFFF' },
  error: { color: ownerColors.danger, fontSize: 14, lineHeight: 20 }, footerButtons: { gap: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#11182799' }, calendar: { backgroundColor: ownerColors.surface, borderRadius: 16, padding: 16, gap: 16 },
  calendarHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthArrow: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  monthArrowText: { color: ownerColors.primaryDark, fontSize: 28, fontFamily: OWNER_FONT.semibold },
  monthLabel: { flex: 1, textAlign: 'center', color: ownerColors.text, fontSize: 16, fontFamily: OWNER_FONT.semibold },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.28%', height: 42, alignItems: 'center', justifyContent: 'center' }, calendarDay: { color: ownerColors.text, fontSize: 14 },
  selectedDay: { backgroundColor: ownerColors.primary, borderRadius: 12 }, selectedDayText: { color: '#FFFFFF', fontFamily: OWNER_FONT.semibold },
});
