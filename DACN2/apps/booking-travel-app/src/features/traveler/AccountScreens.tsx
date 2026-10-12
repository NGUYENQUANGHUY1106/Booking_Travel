import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, Chip, Field, Row, T, TravelerScaffold, go } from './ui';

export type AccountScreenId = 'profile' | 'edit-profile' | 'travel-preferences' | 'language-currency' | 'loyalty' | 'settings' | 'logout-confirm';

function ProfileScreen() {
  const profile = useTravelerStore((state) => state.profile);
  const logout = useTravelerStore((state) => state.logout);
  const [showLogout, setShowLogout] = useState(false);
  const confirmLogout = () => { logout(); setShowLogout(false); router.replace('/auth/login' as Href); };
  return <TravelerScaffold title="Tài khoản">
    <Card style={{ minHeight: 132, flexDirection: 'row', alignItems: 'center', gap: 16 }}><View style={{ width: 64, height: 64, backgroundColor: '#DCEAFF', borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}><T weight="semibold" style={{ color: colors.primaryDark, fontSize: 20 }}>NQ</T></View><View style={{ flex: 1, gap: 4 }}><T weight="semibold" style={{ fontSize: 16 }}>{profile.name}</T><T style={{ color: colors.muted, fontSize: 12 }}>{profile.email}</T><T style={{ color: colors.primary, fontSize: 12 }}>Thành viên từ 2026</T></View></Card>
    <Card style={{ padding: 0 }}><T weight="semibold" style={{ color: colors.gray, margin: 14, marginBottom: 0 }}>Tài khoản</T><Row label="Thông tin cá nhân" onPress={() => go('edit-profile')} /><Row label="Sở thích du lịch" onPress={() => go('travel-preferences')} /><Row label="Phương thức thanh toán" onPress={() => go('payment-method')} /><Row label="Bảo mật" onPress={() => go('settings')} /></Card>
    <Card style={{ padding: 0 }}><T weight="semibold" style={{ color: colors.gray, margin: 14, marginBottom: 0 }}>Hoạt động</T><Row label="Đặt phòng của tôi" onPress={() => go('my-bookings')} /><Row label="Khách sạn yêu thích" onPress={() => go('favorites')} /><Row label="Wishlist" onPress={() => go('wishlist')} /><Row label="Đánh giá của tôi" onPress={() => go('my-reviews')} /><Row label="Lịch sử tìm kiếm" onPress={() => go('results')} /></Card>
    <Card style={{ padding: 0 }}><T weight="semibold" style={{ color: colors.gray, margin: 14, marginBottom: 0 }}>Cài đặt</T><Row label="Thông báo" onPress={() => go('notification-preferences')} /><Row label="Ngôn ngữ" onPress={() => go('language-currency')} /><Row label="Tiền tệ" onPress={() => go('language-currency')} /><Row label="Quyền riêng tư" onPress={() => go('settings')} /><Row label="Trợ giúp & hỗ trợ" onPress={() => go('chat-list')} /></Card>
    <Card onPress={() => router.push('/hotel-owner' as Href)} style={{ backgroundColor: colors.primaryLight }}><T weight="semibold">Chuyển sang Chủ khách sạn</T><T style={{ color: colors.muted }}>Mở module Chủ khách sạn đã có trong ứng dụng.</T></Card>
    <Button label="Đăng xuất" secondary onPress={() => setShowLogout(true)} />
    <Modal animationType="slide" onRequestClose={() => setShowLogout(false)} transparent visible={showLogout}><View style={{ flex: 1, backgroundColor: '#11182780', justifyContent: 'flex-end' }}><Pressable onPress={() => setShowLogout(false)} style={{ flex: 1 }} /><View style={{ backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 32, gap: 14 }}><View style={{ width: 34, height: 4, backgroundColor: '#D1D5DB', borderRadius: 4, alignSelf: 'center' }} /><T style={{ color: colors.error, fontSize: 26 }}>↪</T><T weight="semibold" style={{ fontSize: 20 }}>Đăng xuất khỏi Booking Travel?</T><T style={{ color: colors.muted, lineHeight: 20 }}>Bạn sẽ cần đăng nhập lại để quản lý đặt phòng và sử dụng các tính năng cá nhân.</T><Pressable onPress={confirmLogout} style={{ minHeight: 50, backgroundColor: '#B91C1C', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><T weight="semibold" style={{ color: colors.white }}>Đăng xuất</T></Pressable><Button label="Hủy" secondary onPress={() => setShowLogout(false)} /></View></View></Modal>
  </TravelerScaffold>;
}

function EditProfileScreen() {
  const profile = useTravelerStore((state) => state.profile);
  const update = useTravelerStore((state) => state.updateProfile);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [error, setError] = useState('');
  return <TravelerScaffold title="Chỉnh sửa hồ sơ" back><Card><T weight="semibold">{profile.name}</T><T style={{ color: colors.muted }}>{profile.email} · Thành viên từ 2026</T></Card><Field label="Họ và tên" onChangeText={setName} value={name} /><Field keyboardType="email-address" label="Email" onChangeText={setEmail} value={email} /><Field keyboardType="phone-pad" label="Số điện thoại" onChangeText={setPhone} value={phone} />{error ? <T style={{ color: colors.error }}>{error}</T> : null}<Button label="Lưu thay đổi" onPress={() => { if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return setError('Họ tên hoặc email không hợp lệ.'); update({ name, email, phone }); go('profile'); }} /></TravelerScaffold>;
}

function TravelPreferencesScreen() {
  const profile = useTravelerStore((state) => state.profile);
  const update = useTravelerStore((state) => state.updateProfile);
  const [preferences, setPreferences] = useState(profile.preferences);
  return <TravelerScaffold title="Sở thích du lịch" back><Card><T weight="semibold">{profile.name}</T><T style={{ color: colors.muted }}>{profile.email} · Thành viên từ 2026</T></Card><T style={{ color: colors.gray }}>Chọn sở thích của bạn</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['Biển', 'Ẩm thực', 'Văn hóa', 'Nghỉ dưỡng', 'Gia đình', 'Tiết kiệm'].map((item) => <Chip key={item} label={item} selected={preferences.includes(item)} onPress={() => setPreferences(preferences.includes(item) ? preferences.filter((value) => value !== item) : [...preferences, item])} />)}</View><Button label="Lưu thay đổi" onPress={() => { update({ preferences }); go('profile'); }} /></TravelerScaffold>;
}

function LanguageCurrencyScreen() {
  const profile = useTravelerStore((state) => state.profile);
  const update = useTravelerStore((state) => state.updateProfile);
  const [language, setLanguage] = useState(profile.language);
  const [currency, setCurrency] = useState(profile.currency);
  return <TravelerScaffold title="Ngôn ngữ và tiền tệ" back><Card><T weight="semibold">{profile.name}</T><T style={{ color: colors.muted }}>{profile.email} · Thành viên từ 2026</T></Card><T weight="semibold">Ngôn ngữ ưu tiên</T><View style={{ flexDirection: 'row', gap: 8 }}><Chip label="Tiếng Việt" selected={language === 'Tiếng Việt'} onPress={() => setLanguage('Tiếng Việt')} /><Chip label="English" selected={language === 'English'} onPress={() => setLanguage('English')} /></View><T style={{ color: colors.muted, fontSize: 12 }}>Bản demo hiện hiển thị nội dung bằng tiếng Việt.</T><T weight="semibold">Tiền tệ hiển thị</T><View style={{ flexDirection: 'row', gap: 8 }}><Chip label="VND" selected={currency === 'VND'} onPress={() => setCurrency('VND')} /><Chip label="USD" selected={currency === 'USD'} onPress={() => setCurrency('USD')} /></View><T style={{ color: colors.muted, fontSize: 12 }}>USD là giá quy đổi tham khảo theo tỷ giá demo 1 USD = 25.000 ₫. Giá đặt phòng gốc tính bằng VND.</T><Button label="Lưu thay đổi" onPress={() => { update({ language, currency }); go('profile'); }} /></TravelerScaffold>;
}

function SettingsScreen({ loyalty = false }: { loyalty?: boolean }) {
  const profile = useTravelerStore((state) => state.profile);
  return <TravelerScaffold title={loyalty ? 'Ưu đãi thành viên' : 'Cài đặt và phiên đăng nhập'} back><Card><T weight="semibold">{profile.name}</T><T style={{ color: colors.muted }}>{profile.email} · Thành viên từ 2026</T></Card>{loyalty ? <Card><T weight="semibold">Thành viên Booking Travel</T><T style={{ color: colors.muted }}>Ưu đãi demo sẽ hiển thị khi áp dụng mã tại bước đặt phòng.</T></Card> : <><Row label="Thông tin cá nhân" onPress={() => go('edit-profile')} /><Row label="Sở thích du lịch" onPress={() => go('travel-preferences')} /><Row label="Ngôn ngữ & tiền tệ" onPress={() => go('language-currency')} /><Card><T weight="semibold">Phiên đăng nhập hiện tại</T><T style={{ color: colors.muted }}>Chế độ mock · Lưu trên thiết bị</T></Card></>}<Button label="Lưu thay đổi" onPress={() => go('profile')} /></TravelerScaffold>;
}

export function AccountScreen({ id }: { id: AccountScreenId }) {
  if (id === 'profile' || id === 'logout-confirm') return <ProfileScreen />;
  if (id === 'edit-profile') return <EditProfileScreen />;
  if (id === 'travel-preferences') return <TravelPreferencesScreen />;
  if (id === 'language-currency') return <LanguageCurrencyScreen />;
  return <SettingsScreen loyalty={id === 'loyalty'} />;
}

export { ProfileScreen };
