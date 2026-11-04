import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OwnerButton } from '../components';
import {
  calendarDate,
  HOTEL_STATUS_LABEL,
  validDateRange,
  type DashboardFilter,
  type DashboardHotel,
} from './model';
import { dashboardStyles as s } from './styles';

export function DashboardSheet({
  title,
  close,
  children,
}: PropsWithChildren<{ title: string; close: () => void }>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.overlay}
      >
        <View
          accessibilityViewIsModal
          style={[s.modal, { paddingBottom: Math.max(20, insets.bottom + 12) }]}
        >
          <View style={s.row}>
            <Text accessibilityRole="header" style={s.heading}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={close}
              style={s.linkTouch}
            >
              <Text style={s.link}>Đóng</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={s.modalScroll}
            contentContainerStyle={s.modalContent}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function HotelPicker({
  items,
  selected,
  loading,
  error,
  more,
  choose,
  retry,
  loadMore,
  close,
}: {
  items: DashboardHotel[];
  selected?: string;
  loading: boolean;
  error: boolean;
  more: boolean;
  choose: (id?: string) => void;
  retry: () => void;
  loadMore: () => void;
  close: () => void;
}) {
  return (
    <DashboardSheet title="Chọn khách sạn" close={close}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: !selected }}
        onPress={() => choose()}
        style={[s.option, !selected && s.selected]}
      >
        <Text style={s.body}>Tất cả khách sạn</Text>
      </Pressable>
      {error ? (
        <View style={s.notice}>
          <Text style={s.body}>Không thể cập nhật danh sách khách sạn.</Text>
          <OwnerButton secondary label="Thử lại" onPress={retry} />
        </View>
      ) : null}
      {items.map((hotel) => (
        <Pressable
          key={hotel.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === hotel.id }}
          onPress={() => choose(hotel.id)}
          style={[s.option, selected === hotel.id && s.selected]}
        >
          <Text style={s.body}>{hotel.name}</Text>
          <Text style={s.caption}>{HOTEL_STATUS_LABEL[hotel.status]}</Text>
        </Pressable>
      ))}
      {loading ? <Text style={s.body}>Đang tải khách sạn…</Text> : null}
      {more ? (
        <OwnerButton
          secondary
          label="Xem thêm"
          disabled={loading}
          onPress={loadMore}
        />
      ) : null}
    </DashboardSheet>
  );
}

export function DashboardDatePicker({
  value,
  apply,
  close,
}: {
  value: DashboardFilter;
  apply: (from: string, to: string) => void;
  close: () => void;
}) {
  const [from, setFrom] = useState(value.dateFrom);
  const [to, setTo] = useState(value.dateTo);
  const [error, setError] = useState('');
  const submit = () => {
    if (!validDateRange(from, to)) {
      setError(
        'Nhập ngày hợp lệ theo YYYY-MM-DD; ngày kết thúc phải từ ngày bắt đầu trở đi.',
      );
      return;
    }
    apply(from, to);
  };
  return (
    <DashboardSheet title="Chọn khoảng ngày" close={close}>
      <Text style={s.body}>
        Giờ Việt Nam (UTC+7). Bộ lọc áp dụng cho số đặt phòng tạo mới. Các việc
        nhận/trả phòng vẫn tính cho hôm nay.
      </Text>
      <Text style={s.body}>Từ ngày (YYYY-MM-DD)</Text>
      <TextInput
        accessibilityLabel="Từ ngày"
        autoCapitalize="none"
        placeholder="2026-11-01"
        value={from}
        onChangeText={setFrom}
        style={s.input}
      />
      <Text style={s.body}>Đến ngày (YYYY-MM-DD)</Text>
      <TextInput
        accessibilityLabel="Đến ngày"
        autoCapitalize="none"
        placeholder="2026-11-07"
        value={to}
        onChangeText={setTo}
        style={s.input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
      <OwnerButton label="Áp dụng" onPress={submit} />
      <OwnerButton
        secondary
        label="Hôm nay"
        onPress={() => {
          const today = calendarDate(new Date());
          apply(today, today);
        }}
      />
    </DashboardSheet>
  );
}
