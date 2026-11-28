import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isAxiosError } from 'axios';
import { ReviewSummaryCard } from '@/features/ai-review-summary/ReviewSummaryCard';
import { apiClient } from '@/services/api-client';

import { FieldCard, InfoCard, OwnerButton, OwnerScaffold, SectionTitle } from '../components';
import { ownerProfile } from '../mocks';
import { ownerScreenHref } from '../navigation';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '../../traveler/store';

export function OwnerReviewsScreen({ initialHotelId }: { initialHotelId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const ownerId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const queryClient = useQueryClient();
  const [hotelId, setHotelId] = useState<string | undefined>(initialHotelId);
  const [filter, setFilter] = useState<'all' | 'unanswered'>('all');
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  type Review = { id: string; rating: number; title: string | null; content: string; createdAt: string; isVisible: boolean; author: { fullName: string }; hotel: { name: string }; reply: { content: string; version: number; isVisible: boolean; createdAt: string } | null };
  const hotels = useQuery({ queryKey: ['owner-review-hotels', ownerId], queryFn: async () => (await apiClient.get<{ id: string; name: string }[]>('/owner/hotels')).data, enabled: !!ownerId });
  const reviews = useQuery({ queryKey: ['owner-reviews', ownerId, hotelId, page], queryFn: async () => (await apiClient.get<Review[]>('/reviews/owner', { params: { hotelId, page } })).data, enabled: !!ownerId });
  const rows = reviews.data?.filter((item) => filter === 'all' || !item.reply) ?? [];
  const summaryHotelId = hotelId ?? (hotels.data?.length === 1 ? hotels.data[0].id : undefined);
  const save = async (item: Review) => {
    if (busy) return;
    setBusy(item.id); setError('');
    try {
      const content = (drafts[item.id] ?? item.reply?.content ?? '').trim();
      if (!content || content.length > 2000) { setError('Phản hồi phải có từ 1 đến 2000 ký tự.'); return; }
      if (item.reply) await apiClient.patch(`/reviews/${item.id}/reply`, { content, version: item.reply.version });
      else await apiClient.post(`/reviews/${item.id}/reply`, { content });
      setDrafts((state) => { const next = { ...state }; delete next[item.id]; return next; });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['owner-reviews', ownerId] }), queryClient.invalidateQueries({ queryKey: ['public-hotel-reviews'] })]);
    } catch (cause) {
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      setError(status === 409 ? 'Đánh giá hoặc phản hồi đã thay đổi. Tải lại rồi thử tiếp.' : status === 403 || status === 404 ? 'Bạn không còn quyền phản hồi đánh giá này.' : 'Không lưu được phản hồi. Bản nháp vẫn được giữ.');
    } finally { setBusy(null); }
  };
  return (
    <OwnerScaffold title="Đánh giá và phản hồi" onRefresh={() => void reviews.refetch()} refreshing={reviews.isRefetching}>
      {!ownerId ? <InfoCard><Text style={styles.muted}>Đăng nhập bằng tài khoản Chủ khách sạn để xem đánh giá.</Text></InfoCard> : null}
      {hotels.data && hotels.data.length > 1 ? <View style={styles.reviewFilters}><Pressable onPress={() => { setHotelId(undefined); setPage(1); }}><Text style={styles.reviewFilter}>Tất cả chỗ ở</Text></Pressable>{hotels.data.map((hotel) => <Pressable key={hotel.id} onPress={() => { setHotelId(hotel.id); setPage(1); }}><Text style={styles.reviewFilter}>{hotel.name}</Text></Pressable>)}</View> : null}
      {ownerId && summaryHotelId ? <ReviewSummaryCard key={summaryHotelId} hotelId={summaryHotelId} /> : null}
      <View style={styles.reviewFilters}><Pressable onPress={() => setFilter('all')}><Text style={styles.reviewFilter}>Tất cả</Text></Pressable><Pressable onPress={() => setFilter('unanswered')}><Text style={styles.reviewFilter}>Chưa phản hồi</Text></Pressable></View>
      {reviews.isPending && ownerId ? <Text style={styles.muted}>Đang tải đánh giá...</Text> : null}
      {reviews.isError ? <OwnerButton label="Thử lại" onPress={() => void reviews.refetch()} /> : null}
      {!reviews.isPending && !reviews.isError && rows.length === 0 ? <InfoCard><Text style={styles.muted}>Chưa có đánh giá phù hợp.</Text></InfoCard> : null}
      {rows.map((item) => <InfoCard key={item.id} style={styles.outlined}>
        <SectionTitle>{item.title || item.hotel.name}</SectionTitle>
        <Text style={styles.muted}>{item.hotel.name} · {item.rating}/10 · {item.author.fullName} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}</Text>
        <Text style={styles.rowText}>{item.content}</Text>
        {!item.isVisible ? <Text style={{ color: ownerColors.warning }}>Đánh giá đã bị ẩn</Text> : item.reply && !item.reply.isVisible ? <Text style={{ color: ownerColors.warning }}>Phản hồi đã bị ẩn bởi quản trị viên</Text> : <>
          <Text style={styles.rowText}>Phản hồi từ khách sạn</Text>
          <TextInput accessibilityLabel="Nội dung phản hồi" multiline maxLength={2000} placeholder="Nhập phản hồi cho khách" value={drafts[item.id] ?? item.reply?.content ?? ''} onChangeText={(value) => setDrafts((state) => ({ ...state, [item.id]: value }))} style={styles.reviewInput} />
          <OwnerButton label={busy === item.id ? 'Đang gửi...' : item.reply ? 'Chỉnh sửa phản hồi' : 'Gửi phản hồi'} disabled={!!busy} onPress={() => void save(item)} />
        </>}
      </InfoCard>)}
      {error ? <Text accessibilityRole="alert" style={{ color: ownerColors.danger }}>{error}</Text> : null}
      {page > 1 ? <OwnerButton label="Trang trước" secondary onPress={() => setPage(page - 1)} /> : null}
      {reviews.data?.length === 20 ? <OwnerButton label="Trang sau" secondary onPress={() => setPage(page + 1)} /> : null}
    </OwnerScaffold>
  );
}

export function SparseDesignScreen({ title }: { title: string }) {
  return <OwnerScaffold overline="" title={title} />;
}

export function AiSupportScreen() {
  return (
    <OwnerScaffold footer={<OwnerButton label="Lưu thiết lập" />} title="Thiết lập hỗ trợ AI">
      <InfoCard><SectionTitle>Trả lời hỗ trợ bằng AI</SectionTitle><Text style={styles.muted}>Câu trả lời đề xuất cần chủ khách sạn kiểm tra trước khi gửi.</Text></InfoCard>
      <FieldCard label="Giờ nhận phòng" value="14:00" />
      <FieldCard label="Liên hệ hỗ trợ" value={ownerProfile.phone} />
    </OwnerScaffold>
  );
}

export function OwnerProfileScreen() {
  const session = useTravelerStore((state) => state.session);
  const profile = useTravelerStore((state) => state.profile);
  const logout = useTravelerStore((state) => state.logout);
  const handleLogout = () => {
    logout();
    router.replace('/auth/login');
  };

  return (
    <OwnerScaffold overline="" title="Tài khoản chủ khách sạn">
      <InfoCard><SectionTitle>{session?.mode === 'api' ? profile.name : ownerProfile.name}</SectionTitle><Text style={styles.muted}>{session?.mode === 'api' ? profile.email : `Chủ sở hữu ${ownerProfile.hotel}`}</Text></InfoCard>
      <View style={styles.metric}><Text style={styles.muted}>Hồ sơ xác minh</Text><Text style={styles.metricValue}>{session?.mode === 'api' ? 'Xem trạng thái' : 'Đã duyệt'}</Text></View>
      <InfoCard><Text style={styles.rowText}>Tài khoản & bảo mật　›</Text></InfoCard>
      <OwnerButton label="Chuyển về tài khoản du khách" onPress={() => router.replace('/user/profile')} secondary />
      <OwnerButton label={session?.mode === 'api' ? 'Chuyển vai trò' : 'Xem luồng xác minh'} onPress={() => router.push((session?.mode === 'api' ? '/owner-application/role-switcher' : ownerScreenHref('role-switcher')) as Href)} secondary />
      <OwnerButton danger label="Đăng xuất" onPress={handleLogout} />
    </OwnerScaffold>
  );
}

const styles = StyleSheet.create({
  outlined: { borderWidth: 1, borderColor: '#D1D5DB' },
  reviewFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reviewFilter: { color: ownerColors.primary, padding: 10, backgroundColor: ownerColors.primarySoft, borderRadius: 10 },
  reviewInput: { minHeight: 90, padding: 14, borderRadius: 12, backgroundColor: ownerColors.surface, color: ownerColors.text, textAlignVertical: 'top' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  metric: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, backgroundColor: '#FFFFFF', padding: 12 },
  metricValue: { color: ownerColors.text, fontSize: 14, fontWeight: '800' },
  aiCard: { borderRadius: 12, backgroundColor: ownerColors.aiSoft, padding: 14, gap: 8 },
  rowText: { color: ownerColors.muted, fontSize: 14 },
});
