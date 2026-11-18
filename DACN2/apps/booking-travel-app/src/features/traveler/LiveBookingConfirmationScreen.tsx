import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getBookingConfirmation } from './booking-confirmation-api';
import { bookingApiError } from './booking-quote-api';
import { dateLabel } from './data';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, T, TravelerScaffold, go } from './ui';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <T style={{ color: colors.muted, flex: 1 }}>{label}</T>
      <T weight="medium" style={{ flex: 1.4, textAlign: 'right' }}>
        {value}
      </T>
    </View>
  );
}

export function LiveBookingConfirmationScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const latest = useTravelerStore((state) => state.serverBooking);
  const bookingId = params.bookingId ?? latest?.id ?? '';
  const confirmation = useQuery({
    queryKey: ['booking-confirmation', bookingId],
    queryFn: () => getBookingConfirmation(bookingId),
    enabled: Boolean(bookingId),
    retry: false,
  });

  return (
    <TravelerScaffold title="Xác nhận đặt phòng" back>
      {!bookingId ? (
        <Card>
          <T accessibilityRole="alert">
            Thiếu mã booking. Vui lòng mở lại từ danh sách đặt phòng.
          </T>
          <Button label="Đặt phòng của tôi" onPress={() => go('my-bookings')} />
        </Card>
      ) : null}
      {confirmation.isLoading ? (
        <Card>
          <T>Đang lấy xác nhận và mã QR từ máy chủ...</T>
        </Card>
      ) : null}
      {confirmation.error ? (
        <Card>
          <T accessibilityRole="alert" style={{ color: colors.error }}>
            {bookingApiError(confirmation.error)}
          </T>
          <Button
            label="Thử lại"
            onPress={() => void confirmation.refetch()}
          />
        </Card>
      ) : null}
      {confirmation.data ? (
        <>
          <Card style={{ alignItems: 'center', padding: 24 }}>
            <T weight="bold" style={{ color: colors.primaryDark, fontSize: 20 }}>
              Đặt phòng đã xác nhận
            </T>
            <T style={{ color: colors.muted }}>
              Mã đặt phòng: {confirmation.data.booking.code}
            </T>
            <View
              accessible
              accessibilityLabel={`Mã QR nhận phòng ${confirmation.data.booking.code}`}
              style={{
                backgroundColor: colors.white,
                borderRadius: 16,
                padding: 12,
                marginVertical: 8,
              }}
            >
              <QRCode
                value={confirmation.data.qr.value}
                size={210}
                quietZone={8}
              />
            </View>
            <T style={{ color: colors.muted, textAlign: 'center' }}>
              Trình mã này tại quầy khách sạn khi nhận phòng. Không chia sẻ mã
              công khai.
            </T>
          </Card>
          <Card>
            <T weight="semibold" style={{ fontSize: 17 }}>
              {confirmation.data.hotel.name}
            </T>
            {confirmation.data.hotel.address ? (
              <T style={{ color: colors.muted }}>
                {confirmation.data.hotel.address}
              </T>
            ) : null}
            <DetailRow
              label="Khách lưu trú"
              value={confirmation.data.guest.name}
            />
            <DetailRow
              label="Hạng phòng"
              value={`${confirmation.data.booking.roomName} · ${confirmation.data.booking.roomCount} phòng`}
            />
            <DetailRow
              label="Nhận phòng"
              value={`${dateLabel(confirmation.data.booking.checkIn)}${confirmation.data.hotel.checkInTime ? ` · từ ${confirmation.data.hotel.checkInTime}` : ''}`}
            />
            <DetailRow
              label="Trả phòng"
              value={`${dateLabel(confirmation.data.booking.checkOut)}${confirmation.data.hotel.checkOutTime ? ` · trước ${confirmation.data.hotel.checkOutTime}` : ''}`}
            />
            <DetailRow
              label="Trạng thái"
              value={
                confirmation.data.booking.status === 'CHECKED_IN'
                  ? 'Đã nhận phòng'
                  : 'Đã xác nhận'
              }
            />
          </Card>
          <Button
            label="Xem chi tiết booking"
            secondary
            onPress={() =>
              go('booking-detail', { bookingId: confirmation.data.booking.id })
            }
          />
        </>
      ) : null}
    </TravelerScaffold>
  );
}
