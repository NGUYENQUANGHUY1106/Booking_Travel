import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { FieldCard, InfoCard, OwnerButton, OwnerScaffold, SectionTitle } from '../components';
import { ownerProfile } from '../mocks';
import { ownerScreenHref } from '../navigation';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '../../traveler/store';

export function OwnerReviewsScreen() {
  return (
    <OwnerScaffold overline="" title="Đánh giá và phản hồi">
      <InfoCard style={styles.outlined}><SectionTitle>Chưa có dữ liệu đánh giá</SectionTitle><Text style={styles.muted}>Hệ thống đánh giá khách sạn chưa được kết nối. Điểm đánh giá sẽ xuất hiện khi có nguồn dữ liệu thật.</Text></InfoCard>
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
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  metric: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, backgroundColor: '#FFFFFF', padding: 12 },
  metricValue: { color: ownerColors.text, fontSize: 14, fontWeight: '800' },
  aiCard: { borderRadius: 12, backgroundColor: ownerColors.aiSoft, padding: 14, gap: 8 },
  rowText: { color: ownerColors.muted, fontSize: 14 },
});
