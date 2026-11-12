import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useTravelerStore } from '@/features/traveler/store';
import { InfoCard, OwnerButton, OwnerScaffold } from '../components/owner-ui';
import { ownerColors } from '../styles/tokens';
import { useOwnerHotels } from '../hotels/api';
import { useOwnerRooms } from '../hotels/room-api';
import { pricingApi, pricingKey, usePricingMonth, type PricingKind, type PricingPreview, type PricingRule } from '../hotels/pricing-api';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const KINDS: { value: PricingKind | 'BASE'; label: string }[] = [
  { value: 'DATE', label: 'Ngày cụ thể' }, { value: 'HOLIDAY', label: 'Ngày lễ' },
  { value: 'SEASON', label: 'Theo mùa' }, { value: 'WEEKDAY', label: 'Ngày thường' },
  { value: 'WEEKEND', label: 'Cuối tuần' }, { value: 'BASE', label: 'Giá chuẩn' },
];
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const addDay = (value: string) => dateOnly(new Date(Date.parse(`${value}T00:00:00Z`) + 86_400_000));
const monthShift = (value: string, delta: number) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
};
const todayVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = (value: string) => `${Number(value).toLocaleString('vi-VN')} ₫`;
const priceInput = (value: string) => value.replace(/\.00$/, '');
const shortDate = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
const errorText = (cause: unknown) => {
  if (isAxiosError(cause)) {
    if (cause.response?.status === 409) return typeof cause.response.data?.message === 'string' ? cause.response.data.message : 'Giá phòng đã thay đổi. Hãy tải lại lịch.';
    if (typeof cause.response?.data?.message === 'string') return cause.response.data.message;
  }
  return 'Không lưu được giá. Kiểm tra kết nối rồi thử lại.';
};

export function OwnerPricingScreen() {
  const params = useLocalSearchParams<{ hotelId?: string; roomId?: string; date?: string }>();
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const hotels = useOwnerHotels(userId);
  const [chosenHotel, setChosenHotel] = useState<string>();
  const hotelId = hotels.data ? [chosenHotel, params.hotelId].find((id) => hotels.data.some((hotel) => hotel.id === id)) ?? hotels.data[0]?.id : undefined;
  const rooms = useOwnerRooms(userId, hotelId);
  const [chosenRoom, setChosenRoom] = useState<string>();
  const roomId = rooms.data ? [chosenRoom, hotelId === params.hotelId ? params.roomId : undefined].find((id) => rooms.data.some((room) => room.id === id)) ?? rooms.data[0]?.id : undefined;
  const [month, setMonth] = useState(() => params.date?.slice(0, 7) ?? todayVietnam().slice(0, 7));
  const [start, setStart] = useState<string | undefined>(params.date);
  const [end, setEnd] = useState<string | undefined>();
  const [kind, setKind] = useState<PricingKind | 'BASE'>('DATE');
  const [price, setPrice] = useState('');
  const [label, setLabel] = useState('');
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState<PricingPreview | null>(null);
  const [deleteRule, setDeleteRule] = useState<PricingRule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hotelChoices, setHotelChoices] = useState(false);
  const [roomChoices, setRoomChoices] = useState(false);
  const client = useQueryClient();
  const pricing = usePricingMonth(userId, hotelId, roomId, month);
  const refetchPricing = pricing.refetch;
  useFocusEffect(useCallback(() => { if (roomId) void refetchPricing(); }, [roomId, refetchPricing]));

  const rangeStart = start && end && end < start ? end : start;
  const rangeEnd = start && end && end < start ? start : end ?? start;
  const selected = useMemo(() => pricing.data?.days.filter((day) => rangeStart && rangeEnd && day.date >= rangeStart && day.date <= rangeEnd) ?? [], [pricing.data, rangeStart, rangeEnd]);
  const monthStart = `${month}-01`;
  const offset = (new Date(`${monthStart}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days = pricing.data?.days ?? [];
  const calendarCells: (typeof days[number] | null)[] = [...Array(offset).fill(null), ...days];

  const chooseDay = (date: string) => {
    setNotice(''); setError('');
    if (!start || end) { setStart(date); setEnd(undefined); }
    else setEnd(date);
  };
  const openNew = (nextKind: PricingKind | 'BASE' = 'DATE') => {
    setKind(nextKind); setEditing(null); setPrice(priceInput(nextKind === 'BASE' ? String(pricing.data?.basePrice ?? '') : selected[0]?.price ?? ''));
    setLabel(''); setPreview(null); setError(''); setEditorOpen(true);
  };
  const openExisting = (rule: PricingRule) => {
    setEditing(rule); setKind(rule.kind); setPrice(priceInput(String(rule.price))); setLabel(rule.label ?? '');
    setStart(rule.startDate.slice(0, 10));
    setEnd(dateOnly(new Date(Date.parse(rule.endDateExclusive.slice(0, 10) + 'T00:00:00Z') - 86_400_000)));
    setPreview(null); setError(''); setEditorOpen(true);
  };
  const input = () => ({ kind: kind as PricingKind, label, startDate: rangeStart!, endDateExclusive: addDay(rangeEnd!), price, expectedVersion: pricing.data!.version, ...(editing ? { ruleId: editing.id } : {}) });
  const refresh = async () => {
    if (!userId || !hotelId || !roomId) return;
    await client.invalidateQueries({ queryKey: pricingKey(userId, hotelId, roomId) });
    await client.invalidateQueries({ queryKey: ['owner-rooms', userId, hotelId] });
  };
  const previewChange = async () => {
    if (!pricing.data || !hotelId || !roomId || busy) return;
    if (!/^[1-9]\d{0,11}$/.test(price)) { setError('Giá phải là số nguyên VND lớn hơn 0.'); return; }
    if (kind !== 'BASE' && (!rangeStart || !rangeEnd)) { setError('Chọn ngày hoặc khoảng ngày trên lịch trước khi thiết lập giá.'); return; }
    if (kind === 'HOLIDAY' && !label.trim()) { setError('Nhập tên ngày lễ.'); return; }
    setError('');
    if (kind === 'BASE') { setPreview({ roomId, version: pricing.data.version, currency: 'VND', days: [] }); return; }
    setBusy(true);
    try { setPreview(await pricingApi.preview(hotelId, roomId, input())); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!pricing.data || !hotelId || !roomId || !preview || busy) return;
    setBusy(true); setError('');
    try {
      if (kind === 'BASE') await pricingApi.base(hotelId, roomId, price, pricing.data.version);
      else if (editing) await pricingApi.update(hotelId, roomId, editing.id, input());
      else await pricingApi.create(hotelId, roomId, input());
      setEditorOpen(false); setPreview(null); setEditing(null); setNotice('Đã cập nhật giá phòng.');
      await refresh();
    } catch (cause) { setPreview(null); setError(errorText(cause)); await refresh(); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleteRule || !hotelId || !roomId || !pricing.data || busy) return;
    setBusy(true); setError('');
    try { await pricingApi.remove(hotelId, roomId, deleteRule.id, pricing.data.version); setDeleteRule(null); setNotice('Đã xóa quy tắc giá.'); await refresh(); }
    catch (cause) { setDeleteRule(null); setError(errorText(cause)); await refresh(); }
    finally { setBusy(false); }
  };

  return <OwnerScaffold title="Lịch giá phòng" testID="OWN-UI-17" onRefresh={() => void pricing.refetch()} refreshing={pricing.isRefetching}>
    <View style={styles.monthRow}>
      <Pressable accessibilityLabel="Tháng trước" onPress={() => setMonth(monthShift(month, -1))} style={styles.arrowButton}><Text style={styles.arrow}>‹</Text></Pressable>
      <Text style={styles.month}>Tháng {Number(month.slice(5))}, {month.slice(0, 4)}</Text>
      <Pressable accessibilityLabel="Tháng sau" onPress={() => setMonth(monthShift(month, 1))} style={styles.arrowButton}><Text style={styles.arrow}>›</Text></Pressable>
    </View>
    {hotels.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
    {hotels.isError ? <InfoCard><Text style={styles.error}>Không tải được khách sạn. Kéo xuống để thử lại.</Text></InfoCard> : null}
    {hotels.data?.length === 0 ? <InfoCard><Text style={styles.muted}>Bạn chưa có khách sạn. Tạo khách sạn trước khi thiết lập giá.</Text><OwnerButton label="Khách sạn của tôi" onPress={() => router.push('/hotel-owner/hotels')} /></InfoCard> : null}
    {hotels.data && hotels.data.length > 1 ? <><Pressable style={styles.selector} onPress={() => setHotelChoices(!hotelChoices)}><Text style={styles.selectorText}>{hotels.data.find((item) => item.id === hotelId)?.name ?? 'Chọn khách sạn'}⌄</Text></Pressable>{hotelChoices ? hotels.data.map((hotel) => <Pressable key={hotel.id} onPress={() => { setChosenHotel(hotel.id); setChosenRoom(undefined); setHotelChoices(false); setStart(undefined); setEnd(undefined); }} style={styles.choice}><Text>{hotel.name}</Text></Pressable>) : null}</> : null}
    {rooms.data && rooms.data.length > 0 ? <><Pressable style={styles.selector} onPress={() => setRoomChoices(!roomChoices)}><Text style={styles.selectorText}>{rooms.data.find((room) => room.id === roomId)?.name ?? 'Chọn hạng phòng'} · {rooms.data.find((room) => room.id === roomId)?.quantity ?? 0} phòng　⌄</Text></Pressable>{roomChoices ? rooms.data.map((room) => <Pressable key={room.id} onPress={() => { setChosenRoom(room.id); setRoomChoices(false); setStart(undefined); setEnd(undefined); }} style={styles.choice}><Text>{room.name}</Text></Pressable>) : null}</> : null}
    {rooms.data?.length === 0 ? <InfoCard><Text style={styles.muted}>Khách sạn chưa có hạng phòng. Thêm hạng phòng để thiết lập giá.</Text><OwnerButton label="Thêm hạng phòng" onPress={() => router.push({ pathname: '/hotel-owner/screen/[id]', params: { id: 'rooms', hotelId } } as never)} /></InfoCard> : null}
    {pricing.isPending && roomId ? <ActivityIndicator color={ownerColors.primary} /> : null}
    {pricing.isError ? <InfoCard><Text style={styles.error}>Không tải được lịch giá. Kiểm tra mạng hoặc quyền truy cập.</Text><OwnerButton label="Thử lại" secondary onPress={() => void pricing.refetch()} /></InfoCard> : null}
    {pricing.data ? <>
      <Text style={styles.helper}>Chạm một ngày, rồi chạm ngày cuối để chọn khoảng. Ngày trả phòng không tính giá.</Text>
      <View style={styles.weekRow}>{WEEKDAYS.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
      <View style={styles.grid}>{calendarCells.map((day, index) => {
        const active = day && rangeStart && rangeEnd && day.date >= rangeStart && day.date <= rangeEnd;
        const overridden = day && day.source !== 'BASE';
        return <Pressable key={day?.date ?? `empty-${index}`} disabled={!day} onPress={() => day && chooseDay(day.date)} accessibilityLabel={day ? `${shortDate(day.date)}, ${money(day.price)}${day.closedForSale ? ', khóa bán' : ''}` : undefined} style={[styles.dayCell, !day && styles.blank, day?.closedForSale && styles.closedCell, active && styles.activeCell]}>
          {day ? <><Text style={[styles.dayNumber, active && styles.activeText]}>{Number(day.date.slice(8))}</Text><Text style={[styles.dayPrice, active && styles.activeText]}>{Math.round(Number(day.price) / 1000)}k</Text><View style={[styles.dayMark, overridden && styles.ruleMark, day.closedForSale && styles.closedMark]} /></> : null}
        </Pressable>;
      })}</View>
      <View style={styles.legend}><Legend color="#147A4F" label="Giá chuẩn" /><Legend color="#175ED6" label="Giá theo quy tắc" /><Legend color="#64748B" label="Khóa bán" /></View>
      <InfoCard><Text style={styles.cardTitle}>{rangeStart ? `${shortDate(rangeStart)}${rangeEnd && rangeEnd !== rangeStart ? ` – ${shortDate(rangeEnd)}` : ''} · ${pricing.data.roomName}` : pricing.data.roomName}</Text>
        <Text style={styles.muted}>{selected.length === 1 ? `Giá hiệu lực ${money(selected[0].price)} / đêm` : selected.length > 1 ? `${selected.length} ngày đã chọn · giá từng ngày hiển thị trên lịch` : `Giá chuẩn ${money(pricing.data.basePrice)} / đêm`}</Text>
        <OwnerButton label="Cập nhật giá" onPress={() => openNew()} />
        <OwnerButton label="Đổi giá chuẩn" secondary onPress={() => openNew('BASE')} />
      </InfoCard>
      <Text style={styles.sectionTitle}>Quy tắc giá đang áp dụng</Text>
      {pricing.data.rules.length === 0 ? <InfoCard><Text style={styles.muted}>Chưa có quy tắc. Mỗi đêm đang dùng giá chuẩn.</Text></InfoCard> : pricing.data.rules.map((rule) => <InfoCard key={rule.id}>
        <Text style={styles.cardTitle}>{KINDS.find((item) => item.value === rule.kind)?.label}{rule.label ? ` · ${rule.label}` : ''}</Text>
        <Text style={styles.muted}>{shortDate(rule.startDate.slice(0, 10))} – {shortDate(dateOnly(new Date(Date.parse(rule.endDateExclusive.slice(0, 10) + 'T00:00:00Z') - 86_400_000)))} · {money(rule.price)} / đêm</Text>
        <View style={styles.actions}><View style={styles.action}><OwnerButton label="Sửa" secondary onPress={() => openExisting(rule)} /></View><View style={styles.action}><OwnerButton label="Xóa" danger onPress={() => { setDeleteRule(rule); setError(''); }} /></View></View>
      </InfoCard>)}
    </> : null}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    {error && !editorOpen && !deleteRule ? <Text style={styles.error}>{error}</Text> : null}

    <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.modalTitle}>{editing ? 'Sửa quy tắc giá' : 'Thiết lập giá'}</Text>
      <Text style={styles.muted}>Hạng phòng: {pricing.data?.roomName}</Text>
      <Text style={styles.fieldLabel}>Loại giá</Text><View style={styles.kindGrid}>{KINDS.map((item) => <Pressable key={item.value} onPress={() => { setKind(item.value); setPreview(null); }} style={[styles.kind, kind === item.value && styles.kindActive]}><Text style={[styles.kindText, kind === item.value && styles.kindActiveText]}>{item.label}</Text></Pressable>)}</View>
      {kind !== 'BASE' ? <><Text style={styles.fieldLabel}>Ngày áp dụng</Text><Text style={styles.muted}>{rangeStart && rangeEnd ? `${shortDate(rangeStart)} – ${shortDate(rangeEnd)}` : 'Chưa chọn ngày trên lịch'}</Text><OwnerButton label="Chọn lại ngày trên lịch" secondary onPress={() => { setEditorOpen(false); setStart(undefined); setEnd(undefined); }} /></> : null}
      {kind === 'HOLIDAY' ? <><Text style={styles.fieldLabel}>Tên ngày lễ</Text><TextInput style={styles.input} value={label} onChangeText={(value) => { setLabel(value); setPreview(null); }} placeholder="Ví dụ: Tết Nguyên đán" /></> : null}
      {kind === 'SEASON' ? <><Text style={styles.fieldLabel}>Tên mùa (tùy chọn)</Text><TextInput style={styles.input} value={label} onChangeText={(value) => { setLabel(value); setPreview(null); }} placeholder="Ví dụ: Mùa cao điểm" /></> : null}
      <Text style={styles.fieldLabel}>Giá mỗi đêm (VND)</Text><TextInput style={styles.input} keyboardType="number-pad" value={price} onChangeText={(value) => { setPrice(value.replace(/\D/g, '').slice(0, 12)); setPreview(null); }} placeholder="Ví dụ: 1200000" />
      <Text style={styles.muted}>Thứ tự ưu tiên: ngày cụ thể → ngày lễ → mùa → ngày thường/cuối tuần → giá chuẩn. Quy tắc cùng cấp trùng ngày sẽ bị từ chối.</Text>
      <OwnerButton label={busy ? 'Đang xử lý...' : 'Xem trước thay đổi'} disabled={busy} onPress={() => void previewChange()} />
      {preview ? <InfoCard><Text style={styles.cardTitle}>{kind === 'BASE' ? `Giá chuẩn mới: ${money(price)}` : `${preview.days.filter((day) => day.changed).length}/${preview.days.length} ngày đổi giá hiệu lực`}</Text>{preview.days.slice(0, 8).map((day) => <Text key={day.date} style={styles.muted}>{shortDate(day.date)}: {money(day.before)} → {money(day.after)}</Text>)}{preview.days.length > 8 ? <Text style={styles.muted}>Và {preview.days.length - 8} ngày khác.</Text> : null}<OwnerButton label={preview.days.length > 1 ? `Xác nhận lưu ${preview.days.length} ngày` : 'Xác nhận lưu giá'} disabled={busy} onPress={() => void save()} /></InfoCard> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <OwnerButton label="Đóng" secondary onPress={() => { setEditorOpen(false); setPreview(null); setError(''); }} />
    </ScrollView></View></View></Modal>

    <Modal visible={Boolean(deleteRule)} transparent animationType="fade" onRequestClose={() => setDeleteRule(null)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Xóa quy tắc giá?</Text><Text style={styles.muted}>Những đêm bị ảnh hưởng sẽ trở về mức giá ưu tiên tiếp theo.</Text><OwnerButton label={busy ? 'Đang xóa...' : 'Xác nhận xóa'} danger disabled={busy} onPress={() => void remove()} /><OwnerButton label="Hủy" secondary onPress={() => setDeleteRule(null)} /></View></View></Modal>
  </OwnerScaffold>;
}

function Legend({ color, label }: { color: string; label: string }) { return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>; }

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrowButton: { paddingHorizontal: 14, paddingVertical: 4 }, arrow: { color: ownerColors.modernPrimary, fontSize: 34 },
  month: { color: ownerColors.textModern, fontSize: 20, fontWeight: '700' },
  selector: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: '#D5E1EF', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12 },
  selectorText: { color: ownerColors.textModern, fontSize: 15, fontWeight: '600' },
  choice: { padding: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  helper: { color: ownerColors.mutedModern, fontSize: 13, lineHeight: 19 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' }, weekday: { width: '13.2%', color: ownerColors.mutedModern, fontSize: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dayCell: { width: '13.2%', aspectRatio: 0.9, justifyContent: 'space-between', borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 8, backgroundColor: '#FFFFFF', padding: 5 },
  blank: { borderColor: 'transparent', backgroundColor: 'transparent' }, closedCell: { backgroundColor: '#E2E8F0' }, activeCell: { backgroundColor: '#175ED6', borderColor: '#175ED6' },
  dayNumber: { color: ownerColors.textModern, fontWeight: '700', fontSize: 13 }, dayPrice: { color: ownerColors.mutedModern, fontSize: 10 }, activeText: { color: '#FFFFFF' },
  dayMark: { width: 16, height: 3, borderRadius: 2, backgroundColor: '#147A4F' }, ruleMark: { backgroundColor: '#175ED6' }, closedMark: { backgroundColor: '#64748B' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendText: { color: ownerColors.mutedModern, fontSize: 12 },
  cardTitle: { color: ownerColors.textModern, fontSize: 17, fontWeight: '700', marginBottom: 8 }, muted: { color: ownerColors.mutedModern, fontSize: 14, lineHeight: 21, marginBottom: 10 }, sectionTitle: { color: ownerColors.textModern, fontSize: 18, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1 }, notice: { color: '#147A4F', fontSize: 14 }, error: { color: '#B91C1C', fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0F172A88' }, modalCard: { backgroundColor: '#F9FAFB', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }, modalTitle: { color: ownerColors.textModern, fontSize: 21, fontWeight: '700', marginBottom: 12 },
  fieldLabel: { color: ownerColors.textModern, fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 6 }, input: { backgroundColor: '#FFFFFF', borderColor: '#D5E1EF', borderWidth: 1, borderRadius: 10, padding: 13, fontSize: 16, color: ownerColors.textModern },
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, kind: { borderWidth: 1, borderColor: '#D5E1EF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF' }, kindActive: { backgroundColor: '#175ED6', borderColor: '#175ED6' }, kindText: { color: ownerColors.textModern, fontSize: 13 }, kindActiveText: { color: '#FFFFFF' },
});
