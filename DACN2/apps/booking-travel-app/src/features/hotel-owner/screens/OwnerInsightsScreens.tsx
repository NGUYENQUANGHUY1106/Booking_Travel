import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { FieldCard, InfoCard, OwnerButton, OwnerScaffold, SectionTitle } from '../components';
import { ownerProfile } from '../mocks';
import { ownerScreenHref } from '../navigation';
import { ownerColors } from '../styles/tokens';

export function OwnerReviewsScreen() {
  return (
    <OwnerScaffold overline="" title="Đánh giá và phản hồi">
      <InfoCard style={styles.outlined}><SectionTitle>Vị trí rất tiện</SectionTitle><Text style={styles.muted}>9/10 · Ngọc Anh · 12/10/2026</Text></InfoCard>
      <FieldCard label="Phản hồi từ khách sạn" value="Cảm ơn bạn đã lưu trú cùng chúng tôi." />
      <OwnerButton label="Gửi phản hồi" />
    </OwnerScaffold>
  );
}

function PeriodCard() {
  return <InfoCard><SectionTitle>Kỳ thống kê</SectionTitle><Text style={styles.muted}>Ngày · Tuần · Tháng · Năm</Text></InfoCard>;
}

function RevenueMetrics() {
  return (
    <>
      <InfoCard style={styles.outlined}><SectionTitle>Doanh thu tháng này</SectionTitle><Text style={styles.muted}>48.250.000 ₫　↑ 12% so với tháng trước</Text></InfoCard>
      <Metric label="Tỷ lệ lấp đầy" value="69%" />
      <Metric label="Giá phòng bình quân" value="1.320.000 ₫" />
      <Metric label="Điểm đánh giá" value="9.1 / 10" />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

export function RevenueScreen({ forecast = false }: { forecast?: boolean }) {
  return (
    <OwnerScaffold title={forecast ? 'Dự báo công suất và doanh thu' : 'Doanh thu'}>
      <PeriodCard />
      <RevenueMetrics />
      {forecast ? <View style={styles.aiCard}><SectionTitle>AI-generated · Dự báo</SectionTitle><Text style={styles.muted}>Xu hướng đặt phòng tăng vào cuối tuần. Đây là thông tin tham khảo.</Text></View> : null}
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
  return (
    <OwnerScaffold overline="" title="Tài khoản chủ khách sạn">
      <InfoCard><SectionTitle>{ownerProfile.name}</SectionTitle><Text style={styles.muted}>Chủ sở hữu {ownerProfile.hotel}</Text></InfoCard>
      <View style={styles.metric}><Text style={styles.muted}>Hồ sơ xác minh</Text><Text style={styles.metricValue}>Đã duyệt</Text></View>
      <InfoCard><Text style={styles.rowText}>Tài khoản & bảo mật　›</Text></InfoCard>
      <InfoCard><Text style={styles.rowText}>Chuyển về tài khoản du khách　›</Text></InfoCard>
      <OwnerButton label="Xem luồng xác minh" onPress={() => router.push(ownerScreenHref('role-switcher'))} secondary />
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
