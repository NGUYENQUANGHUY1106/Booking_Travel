import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { FieldCard, InfoCard, OwnerButton, OwnerScaffold } from '../components';
import { ownerProfile } from '../mocks';
import { ownerScreenHref, ownerTabHref } from '../navigation';
import { ownerColors } from '../styles/tokens';

export function BecomeOwnerScreen() {
  return (
    <OwnerScaffold
      footer={<OwnerButton label="Bắt đầu xác minh" onPress={() => router.push(ownerScreenHref('verification-form'))} />}
      title="Trở thành chủ khách sạn"
    >
      <InfoCard>
        <Text style={styles.title}>Mở rộng hoạt động kinh doanh</Text>
        <Text style={styles.body}>Đăng chỗ ở, quản lý phòng, giá, booking và doanh thu ngay trong Booking Travel.</Text>
      </InfoCard>
      <View style={styles.benefit}><Text style={styles.icon}>✓</Text><View style={styles.copy}><Text style={styles.title}>Quản lý tập trung</Text><Text style={styles.body}>Lịch phòng, giá và ưu đãi ở cùng một nơi.</Text></View></View>
      <View style={styles.benefit}><Text style={styles.icon}>✓</Text><View style={styles.copy}><Text style={styles.title}>Tiếp cận nhiều du khách</Text><Text style={styles.body}>Xuất hiện trên hệ thống tìm kiếm của Booking Travel.</Text></View></View>
      <View style={styles.benefit}><Text style={styles.icon}>✓</Text><View style={styles.copy}><Text style={styles.title}>Dữ liệu thông minh</Text><Text style={styles.body}>Nhận gợi ý giá và dự báo vận hành từ AI.</Text></View></View>
    </OwnerScaffold>
  );
}

export function VerificationFormScreen({ roleSwitcher = false }: { roleSwitcher?: boolean }) {
  return (
    <OwnerScaffold
      footer={<OwnerButton label="Tiếp tục" onPress={() => router.push(ownerScreenHref('verification-status'))} />}
      title={roleSwitcher ? 'Chuyển vai trò' : 'Xác minh chủ khách sạn'}
    >
      <InfoCard><Text style={styles.title}>Trở thành chủ khách sạn</Text><Text style={styles.body}>Quản lý khách sạn của bạn sau khi xác minh hồ sơ.</Text></InfoCard>
      <FieldCard label="Tên pháp lý" value={ownerProfile.name} />
      <FieldCard label="Thông tin liên hệ" value={ownerProfile.phone} />
      <View style={styles.warning}><Text style={styles.title}>Trạng thái xác minh</Text><Text style={styles.body}>Thông tin chỉ dùng để xác minh chủ sở hữu.</Text></View>
    </OwnerScaffold>
  );
}

export function VerificationStatusScreen() {
  return (
    <OwnerScaffold footer={<OwnerButton label="Về tổng quan" onPress={() => router.replace(ownerTabHref())} />} title="Trạng thái xác minh">
      <View style={styles.warning}><Text style={styles.title}>Đang chờ xét duyệt</Text><Text style={styles.body}>Đang chờ quản trị viên xét duyệt hồ sơ.</Text></View>
      <InfoCard><Text style={styles.title}>Hồ sơ đã được gửi</Text><Text style={styles.body}>Bạn sẽ nhận được thông báo khi trạng thái xác minh thay đổi.</Text></InfoCard>
    </OwnerScaffold>
  );
}

const styles = StyleSheet.create({
  title: { color: ownerColors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body: { color: ownerColors.muted, fontSize: 14, lineHeight: 21 },
  benefit: { flexDirection: 'row', gap: 12, borderRadius: 12, backgroundColor: '#FFFFFF', padding: 14 },
  icon: { color: ownerColors.primary, fontSize: 18, fontWeight: '700' },
  copy: { flex: 1, gap: 4 },
  warning: { borderRadius: 12, backgroundColor: ownerColors.yellowSoft, padding: 14, gap: 10 },
});
