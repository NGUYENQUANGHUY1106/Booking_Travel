import { router, useLocalSearchParams, type Href } from 'expo-router';
import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { absoluteMediaUrl } from '@/services/media-url';
import { useTravelerStore } from '@/features/traveler/store';
import { AdminText } from '../dashboard/components';
import { AdminButton, AdminCard, AdminInput, AdminPage } from '../shared/ui';
import { ADMIN_COLORS } from '../theme';
import { ACCOMMODATION_LABELS, type AccommodationType } from './api';
import { useHotelReviewQueue } from './queries';

const TYPES = Object.keys(ACCOMMODATION_LABELS) as AccommodationType[];
const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function TypeChip({ type, selected, onPress }: { type: AccommodationType; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
    <AdminText weight="semibold" style={[styles.chipText, selected && styles.chipTextSelected]}>{ACCOMMODATION_LABELS[type]}</AdminText>
  </Pressable>;
}

export function HotelModerationScreen() {
  const session = useTravelerStore((state) => state.session);
  const { decision, search: initialSearch, types: initialTypes, sort: initialSort, page: initialPage } = useLocalSearchParams<{ decision?: string; search?: string; types?: string; sort?: string; page?: string }>();
  const [searchInput, setSearchInput] = useState(initialSearch ?? '');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [types, setTypes] = useState<AccommodationType[]>(() => initialTypes?.split(',').filter((type): type is AccommodationType => type in ACCOMMODATION_LABELS) ?? []);
  const [sort, setSort] = useState<'newest' | 'oldest'>(initialSort === 'oldest' ? 'oldest' : 'newest');
  const [page, setPage] = useState(Math.max(1, Number(initialPage) || 1));
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch !== search) { setSearch(nextSearch); setPage(1); }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, search]);
  const queue = useHotelReviewQueue({ search, types, sort, page, limit: 10 });
  const totalPages = Math.max(1, Math.ceil((queue.data?.total ?? 0) / 10));
  const toggle = (type: AccommodationType) => {
    setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
    setPage(1);
  };
  const openDetail = (id: string) => router.push({ pathname: '/admin/detail/[kind]', params: { kind: 'hotel-moderation', id, search, types: types.join(','), sort, page: String(page) } } as unknown as Href);

  return <AdminPage title="Chỗ ở chờ duyệt" eyebrow="CHỖ Ở / HÀNG CHỜ DUYỆT" subtitle="Kiểm tra hồ sơ và đưa ra quyết định có ghi lý do." trailing={<AdminText style={styles.count}>{queue.data ? `${queue.data.total} hồ sơ` : 'Đang tải...'}</AdminText>}>
    {session?.mode !== 'api' ? <AdminCard><AdminText>Đăng nhập bằng tài khoản Admin để xem hàng chờ thật.</AdminText></AdminCard> : <>
      {decision === 'APPROVE' || decision === 'REJECT' ? <AdminCard tone="blue"><AdminText>{decision === 'APPROVE' ? 'Đã duyệt chỗ ở.' : 'Đã từ chối hồ sơ và gửi lý do cho Chủ khách sạn.'}</AdminText></AdminCard> : null}
      <AdminCard>
        <View style={styles.searchRow}><AdminInput value={searchInput} onChangeText={setSearchInput} placeholder="Tìm tên chỗ ở, chủ sở hữu, email hoặc mã hồ sơ" /><AdminButton label="Làm mới" variant="outline" onPress={() => void queue.refetch()} /></View>
        <AdminText weight="semibold" style={styles.label}>Loại chỗ ở · chọn nhiều loại</AdminText>
        <View style={styles.chips}>{TYPES.map((type) => <TypeChip key={type} type={type} selected={types.includes(type)} onPress={() => toggle(type)} />)}</View>
        <View style={styles.chips}>
          <Pressable accessibilityRole="button" onPress={() => { setTypes([]); setPage(1); }} style={[styles.chip, !types.length && styles.chipSelected]}><AdminText weight="semibold" style={!types.length ? styles.chipTextSelected : undefined}>Tất cả</AdminText></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setSort((current) => current === 'newest' ? 'oldest' : 'newest'); setPage(1); }} style={styles.chip}><AdminText weight="semibold">{sort === 'newest' ? 'Mới gửi nhất ↓' : 'Cũ nhất ↑'}</AdminText></Pressable>
          {queue.isFetching && !queue.isPending ? <ActivityIndicator color={ADMIN_COLORS.primary} /> : null}
        </View>
      </AdminCard>
      {queue.isPending ? <ActivityIndicator color={ADMIN_COLORS.primary} /> : queue.isError ? <AdminCard><AdminText style={styles.error}>{isAxiosError(queue.error) && queue.error.response?.status === 403 ? 'Bạn không có quyền xem hồ sơ khách sạn.' : 'Không tải được hàng chờ. Kiểm tra kết nối rồi thử lại.'}</AdminText><AdminButton label="Thử lại" onPress={() => void queue.refetch()} /></AdminCard> : queue.data?.items.length === 0 ? <AdminCard><AdminText weight="semibold">{search || types.length ? 'Không có hồ sơ phù hợp với bộ lọc.' : 'Không có khách sạn chờ duyệt.'}</AdminText><AdminButton label="Làm mới" variant="outline" onPress={() => void queue.refetch()} /></AdminCard> : <>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}><AdminText style={styles.hotelCell}>CƠ SỞ LƯU TRÚ</AdminText><AdminText style={styles.typeCell}>LOẠI CHỖ Ở</AdminText><AdminText style={styles.ownerCell}>CHỦ SỞ HỮU</AdminText><AdminText style={styles.dateCell}>GỬI LÚC</AdminText><AdminText style={styles.statusCell}>TRẠNG THÁI</AdminText></View>
            {queue.data?.items.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Xem hồ sơ ${item.name}, phiên bản ${item.version}`} onPress={() => openDetail(item.id)} style={({ pressed }) => [styles.tableRow, styles.dataRow, pressed && styles.pressed]}>
              <View style={styles.hotelCell}><View style={styles.hotelInline}>{item.coverImageUrl ? <Image source={{ uri: absoluteMediaUrl(item.coverImageUrl) }} style={styles.thumb} /> : <View style={styles.thumbEmpty}><AdminText style={styles.thumbText}>Ảnh</AdminText></View>}<View style={styles.hotelText}><AdminText weight="semibold" numberOfLines={2}>{item.name}</AdminText><AdminText style={styles.subtle} numberOfLines={2}>{item.address || 'Chưa có địa chỉ'} · {item.roomTypeCount} hạng phòng</AdminText></View></View></View>
              <View style={styles.typeCell}><AdminText weight="semibold" style={styles.typeBadge}>{ACCOMMODATION_LABELS[item.accommodationType] ?? item.accommodationType}</AdminText></View>
              <AdminText style={styles.ownerCell} numberOfLines={2}>{item.owner.fullName}</AdminText>
              <AdminText style={[styles.dateCell, styles.subtle]}>{dateTime(item.submittedAt)}</AdminText>
              <AdminText weight="semibold" style={[styles.statusCell, styles.pending]}>Chờ duyệt</AdminText>
            </Pressable>)}
          </View>
        </ScrollView>
        <View style={styles.pagination}><AdminText style={styles.subtle}>Trang {page}/{totalPages} · {queue.data?.total ?? 0} hồ sơ</AdminText><View style={styles.actions}><AdminButton label="‹ Trước" variant="outline" disabled={page <= 1} onPress={() => setPage(page - 1)} /><AdminButton label="Sau ›" variant="outline" disabled={page >= totalPages} onPress={() => setPage(page + 1)} /></View></View>
      </>}
    </>}
  </AdminPage>;
}

const styles = StyleSheet.create({
  count: { color: '#B85C14', fontSize: 13 }, searchRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  label: { color: '#475569', fontSize: 12 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  chip: { minHeight: 34, paddingHorizontal: 12, borderWidth: 1, borderColor: ADMIN_COLORS.border, borderRadius: 18, justifyContent: 'center', backgroundColor: '#FFFFFF' },
  chipSelected: { borderColor: ADMIN_COLORS.primary, backgroundColor: '#EFF6FF' }, chipText: { fontSize: 12 }, chipTextSelected: { color: ADMIN_COLORS.primary },
  tableScroll: { flexGrow: 1 }, table: { minWidth: 760, width: '100%', borderWidth: 1, borderColor: ADMIN_COLORS.border, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  tableRow: { flexDirection: 'row', minHeight: 68, alignItems: 'center', paddingHorizontal: 14, gap: 8 }, tableHeader: { minHeight: 44, backgroundColor: '#F1F6FD' }, dataRow: { borderTopWidth: 1, borderTopColor: ADMIN_COLORS.border }, pressed: { backgroundColor: '#EFF6FF' },
  hotelCell: { width: 235, fontSize: 10, color: ADMIN_COLORS.secondaryText }, typeCell: { width: 102, fontSize: 10, color: ADMIN_COLORS.secondaryText }, ownerCell: { width: 130, fontSize: 11, color: ADMIN_COLORS.secondaryText }, dateCell: { width: 125, fontSize: 11 }, statusCell: { width: 90, fontSize: 11 },
  hotelInline: { flexDirection: 'row', alignItems: 'center', gap: 9 }, hotelText: { flex: 1, minWidth: 0, gap: 3 }, thumb: { width: 48, height: 48, borderRadius: 7 }, thumbEmpty: { width: 48, height: 48, borderRadius: 7, backgroundColor: '#E9EEF5', alignItems: 'center', justifyContent: 'center' }, thumbText: { color: ADMIN_COLORS.secondaryText, fontSize: 11 },
  subtle: { color: ADMIN_COLORS.secondaryText, fontSize: 11 }, pending: { color: '#B85C14' }, typeBadge: { color: ADMIN_COLORS.primary, backgroundColor: '#EFF6FF', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 12, alignSelf: 'flex-start' },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, error: { color: '#B91C1C', fontSize: 13 },
});
