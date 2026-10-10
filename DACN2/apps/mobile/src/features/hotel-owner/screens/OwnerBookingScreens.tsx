import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { FieldCard, InfoCard, OwnerButton, OwnerScaffold, SectionTitle, StatusPanel } from '../components';
import { ownerBooking } from '../mocks';
import { ownerScreenHref } from '../navigation';
import { ownerColors } from '../styles/tokens';

function BookingSummary({ status = ownerBooking.status }: { status?: string }) {
  return (
    <InfoCard style={styles.outlined}>
      <SectionTitle>{ownerBooking.hotel}</SectionTitle>
      <Text style={styles.muted}>{ownerBooking.stay} · {ownerBooking.summary}</Text>
      <Text style={styles.status}>● {status}</Text>
      <Text style={styles.total}>Tổng cộng {ownerBooking.total}</Text>
    </InfoCard>
  );
}

export function OwnerBookingsScreen() {
  return (
    <OwnerScaffold overline="" title="Đặt phòng của khách">
      <BookingSummary />
      <InfoCard><SectionTitle>Mã đặt phòng</SectionTitle><Text style={styles.muted}>{ownerBooking.id} · {ownerBooking.guest}</Text></InfoCard>
      <InfoCard><SectionTitle>Xác minh trạng thái</SectionTitle><Text style={styles.muted}>Chỉ nhận phòng khi booking hợp lệ và trạng thái từ hệ thống cho phép.</Text></InfoCard>
      <OwnerButton label="Xem booking" onPress={() => router.push(ownerScreenHref('booking-detail'))} />
    </OwnerScaffold>
  );
}

export function BookingDetailScreen() {
  return (
    <OwnerScaffold footer={<OwnerButton label="Quét mã nhận phòng" onPress={() => router.push(ownerScreenHref('qr-checkin'))} />} title="Chi tiết đặt phòng">
      <BookingSummary />
      <InfoCard><SectionTitle>Mã đặt phòng</SectionTitle><Text style={styles.muted}>{ownerBooking.id} · {ownerBooking.guest}</Text></InfoCard>
      <InfoCard><SectionTitle>Kiểm tra nhận phòng</SectionTitle><Text style={styles.muted}>Đặt phòng đã xác nhận. Quét mã QR và đối chiếu giấy tờ trước khi nhận phòng.</Text></InfoCard>
    </OwnerScaffold>
  );
}

export function GuestsScreen() {
  return (
    <OwnerScaffold overline="" title="Khách lưu trú">
      <InfoCard><SectionTitle>Khách lưu trú</SectionTitle><Text style={styles.muted}>{ownerBooking.guest} · {ownerBooking.stay}</Text></InfoCard>
      <InfoCard><SectionTitle>Sắp nhận phòng</SectionTitle><Text style={styles.muted}>2 khách hôm nay · xác nhận theo mã đặt phòng</Text></InfoCard>
    </OwnerScaffold>
  );
}

export function QrCheckinScreen() {
  const [code, setCode] = useState(ownerBooking.id);
  return (
    <OwnerScaffold footer={<OwnerButton label="Xem booking" onPress={() => router.push(ownerScreenHref('checkin'))} />} title="Quét QR hoặc nhập mã">
      <BookingSummary />
      <InfoCard><SectionTitle>Mã đặt phòng</SectionTitle><Text style={styles.muted}>{ownerBooking.id} · {ownerBooking.guest}</Text></InfoCard>
      <FieldCard label="Quét QR / nhập mã" onChangeText={setCode} value={code} />
    </OwnerScaffold>
  );
}

export function CheckinScreen() {
  const [state, setState] = useState<'verify' | 'valid' | 'checked-in'>('verify');
  if (state === 'checked-in') {
    return (
      <OwnerScaffold footer={<OwnerButton label="Tiếp tục trả phòng" onPress={() => router.push(ownerScreenHref('checkout'))} />} title="Nhận phòng thành công">
        <StatusPanel body="Thời điểm nhận phòng 14:18 · 12/10/2026. Trạng thái tử hệ thống đã cập nhật." title="Đã nhận phòng" />
        <BookingSummary status="Đã nhận phòng" />
      </OwnerScaffold>
    );
  }
  return (
    <OwnerScaffold footer={<OwnerButton label="Xác nhận nhận phòng" onPress={() => state === 'verify' ? setState('valid') : setState('checked-in')} />} title="Xác minh nhận phòng">
      {state === 'valid'
        ? <><StatusPanel body={`Mã QR khớp ${ownerBooking.id} · 2 khách · ${ownerBooking.stay}. Kiểm tra giấy tờ trước khi nhận phòng.`} title="Booking hợp lệ" /><BookingSummary status="Booking hợp lệ" /></>
        : <InfoCard><SectionTitle>Xác minh trạng thái</SectionTitle><Text style={styles.muted}>Chỉ nhận phòng khi booking hợp lệ và trạng thái từ hệ thống cho phép.</Text></InfoCard>}
    </OwnerScaffold>
  );
}

export function CheckoutScreen() {
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <OwnerScaffold footer={<OwnerButton label="Xem doanh thu" onPress={() => router.replace(ownerScreenHref('revenue'))} />} title="Trả phòng hoàn tất">
        <StatusPanel body={`Booking ${ownerBooking.id} đã hoàn tất. Khách có thể đánh giá sau khi hệ thống xác nhận.`} title="Đã hoàn tất" />
        <BookingSummary status="Đã hoàn tất" />
      </OwnerScaffold>
    );
  }
  return (
    <OwnerScaffold footer={<OwnerButton label="Xác nhận trả phòng" onPress={() => setDone(true)} />} title="Xác nhận trả phòng">
      <BookingSummary status="Đã nhận phòng" />
      <InfoCard><SectionTitle>Mã đặt phòng</SectionTitle><Text style={styles.muted}>{ownerBooking.id} · {ownerBooking.guest}</Text></InfoCard>
      <InfoCard><SectionTitle>Xác minh trạng thái</SectionTitle><Text style={styles.muted}>Chỉ trả phòng khi booking ở trạng thái đã nhận phòng và hệ thống cho phép.</Text></InfoCard>
    </OwnerScaffold>
  );
}

const styles = StyleSheet.create({
  outlined: { borderWidth: 1, borderColor: '#D1D5DB', padding: 16 },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  status: { color: ownerColors.success, fontSize: 14, fontWeight: '700' },
  total: { color: ownerColors.text, fontSize: 19, fontWeight: '800', textDecorationLine: 'underline' },
});

