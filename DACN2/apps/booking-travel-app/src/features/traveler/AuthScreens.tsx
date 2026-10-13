import { router, type Href } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { HOTELS } from './data';
import { type MockSessionRole, useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, Chip, Field, HotelCard, T, TravelerScaffold } from './ui';

export type AuthScreenId = 'splash' | 'onboarding' | 'role-entry' | 'welcome' | 'login' | 'register' | 'otp' | 'forgot' | 'reset' | 'profile-setup' | 'preferences-setup' | 'location-permission';

export function authRoute(id: AuthScreenId) {
  router.push({ pathname: '/auth/[id]', params: { id } } as Href);
}

const TITLES: Record<AuthScreenId, string> = {
  splash: 'Chào mừng đến Booking Travel', onboarding: 'Khám phá dễ dàng', 'role-entry': 'Tiếp tục hành trình', welcome: 'Chào mừng bạn', login: 'Đăng nhập', register: 'Tạo tài khoản', otp: 'Xác thực email', forgot: 'Quên mật khẩu', reset: 'Đặt lại mật khẩu', 'profile-setup': 'Thiết lập hồ sơ', 'preferences-setup': 'Sở thích du lịch', 'location-permission': 'Cho phép truy cập vị trí',
};

const TRAVELER_DEMO_PASSWORD = 'demo123';
const HOTEL_OWNER_DEMO_EMAIL = 'owner@bookingtravel.vn';
const HOTEL_OWNER_DEMO_PASSWORD = 'owner123';

function IntroCard({ title = 'Khám phá hành trình của bạn' }: { title?: string }) {
  return <View style={{ width: '100%', gap: 16 }}><Card><T weight="semibold" style={{ fontSize: 16 }}>{title}</T><T style={{ color: colors.gray, lineHeight: 20 }}>Đặt khách sạn tin cậy, tìm nơi ở phù hợp và lên kế hoạch thông minh cho chuyến đi.</T></Card><HotelCard hotel={HOTELS[0]} /></View>;
}

export function AuthScreen({ id }: { id: AuthScreenId }) {
  const login = useTravelerStore((state) => state.login);
  const profile = useTravelerStore((state) => state.profile);
  const updateProfile = useTravelerStore((state) => state.updateProfile);
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState(profile.name);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [slide, setSlide] = useState(0);
  const [preferences, setPreferences] = useState(profile.preferences);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [otpSentAt, setOtpSentAt] = useState(() => Date.now());

  const complete = (role: MockSessionRole = 'USER') => router.replace(role === 'HOTEL_OWNER' ? '/hotel-owner' as Href : '/user' as Href);
  const submitLogin = (role: MockSessionRole = 'USER') => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Vui lòng nhập email hợp lệ.');
    if (password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    setLoginBusy(true);
    setTimeout(() => {
      setLoginBusy(false);
      if (role === 'HOTEL_OWNER') {
        if (email.trim().toLowerCase() !== HOTEL_OWNER_DEMO_EMAIL || password !== HOTEL_OWNER_DEMO_PASSWORD) {
          return setError('Tài khoản Chủ khách sạn không đúng. Hãy dùng thông tin demo bên dưới.');
        }
      } else if (password !== TRAVELER_DEMO_PASSWORD) {
        return setError(`Sai mật khẩu demo. Hãy dùng ${TRAVELER_DEMO_PASSWORD}.`);
      }

      setError('');
      login(email.trim().toLowerCase(), role);
      complete(role);
    }, 350);
  };
  const submitRegister = () => {
    if (!/^\S+@\S+\.\S+$/.test(email) || name.trim().length < 2 || password.length < 6 || password !== confirmPassword || !accepted) return setError('Kiểm tra họ tên, email, mật khẩu và điều khoản.');
    setError(''); updateProfile({ name, email }); authRoute('otp');
  };

  if (id === 'splash' || id === 'onboarding' || id === 'role-entry' || id === 'welcome') {
    const introTitle = id === 'onboarding' ? ['Khám phá hành trình của bạn', 'Tìm chỗ nghỉ phù hợp', 'Đặt phòng thật dễ dàng'][slide] : undefined;
    return <TravelerScaffold title={TITLES[id]}>
      <IntroCard title={introTitle} />
      {id === 'onboarding' ? <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>{[0, 1, 2].map((value) => <Pressable accessibilityLabel={`Trang ${value + 1}`} key={value} onPress={() => setSlide(value)} style={{ height: 8, width: value === slide ? 24 : 8, borderRadius: 4, backgroundColor: value === slide ? colors.primary : colors.line }} />)}</View> : null}
      <View style={{ width: '100%' }}><Button compact label={id === 'splash' ? 'Bắt đầu khám phá' : id === 'onboarding' ? slide < 2 ? 'Tiếp tục' : 'Bắt đầu' : id === 'role-entry' ? 'Tiếp tục là khách du lịch' : 'Đăng nhập'} onPress={() => id === 'splash' ? authRoute('onboarding') : id === 'onboarding' ? slide < 2 ? setSlide(slide + 1) : authRoute('role-entry') : id === 'role-entry' ? authRoute('welcome') : authRoute('login')} /></View>
      {id === 'onboarding' ? <Button label="Bỏ qua" secondary onPress={() => authRoute('role-entry')} /> : null}
      {id === 'role-entry' ? <Button label="Đăng nhập Chủ khách sạn" secondary onPress={() => authRoute('login')} /> : null}
      {id === 'welcome' ? <Button label="Tạo tài khoản" secondary onPress={() => authRoute('register')} /> : null}
      {id === 'welcome' ? <Pressable onPress={() => { login('demo@bookingtravel.vn'); complete(); }}><T style={{ textAlign: 'center', color: colors.primary }}>Khám phá bằng tài khoản demo</T></Pressable> : null}
    </TravelerScaffold>;
  }

  if (id === 'login' || id === 'register' || id === 'forgot' || id === 'reset') {
    return <TravelerScaffold title={TITLES[id]} background={colors.background}>
      {id !== 'reset' ? <Field error={error && !/^\S+@\S+\.\S+$/.test(email) ? error : undefined} keyboardType="email-address" label="Email" onChangeText={setEmail} placeholder="quang@example.com" value={email} /> : null}
      {id === 'login' || id === 'register' || id === 'reset' ? <><Field label={id === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'} onChangeText={setPassword} placeholder="••••••••" secureTextEntry={!showPassword} value={password} /><Pressable onPress={() => setShowPassword(!showPassword)}><T style={{ color: colors.primary, textAlign: 'right' }}>{showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</T></Pressable></> : null}
      {id === 'register' ? <><Field label="Xác nhận mật khẩu" onChangeText={setConfirmPassword} secureTextEntry={!showPassword} value={confirmPassword} /><Field label="Họ và tên" onChangeText={setName} placeholder="Nguyễn Minh Quang" value={name} /><Chip label={accepted ? '✓ Đồng ý điều khoản' : 'Đồng ý điều khoản'} selected={accepted} onPress={() => setAccepted(!accepted)} /></> : null}
      {id === 'reset' ? <Field label="Xác nhận mật khẩu mới" onChangeText={setConfirmPassword} secureTextEntry={!showPassword} value={confirmPassword} /> : null}
      <Card><T weight="semibold" style={{ fontSize: 16 }}>Bảo mật tài khoản</T><T style={{ color: colors.gray, lineHeight: 20 }}>Thông tin cá nhân được lưu an toàn. Bạn có thể cập nhật bất cứ lúc nào.</T></Card>
      {id === 'login' ? <Card style={{ backgroundColor: colors.primaryLight }}>
        <T weight="semibold">Tài khoản đăng nhập thử</T>
        <T style={{ color: colors.muted, fontSize: 12 }}>Khách du lịch: dùng email bất kỳ và mật khẩu {TRAVELER_DEMO_PASSWORD}.</T>
        <T style={{ color: colors.muted, fontSize: 12 }}>Chủ khách sạn: {HOTEL_OWNER_DEMO_EMAIL} / {HOTEL_OWNER_DEMO_PASSWORD}.</T>
      </Card> : null}
      {error ? <T style={{ color: colors.error }}>{error}</T> : null}
      <Button compact disabled={loginBusy} label={loginBusy ? 'Đang đăng nhập...' : id === 'login' ? 'Đăng nhập' : id === 'register' ? 'Tạo tài khoản' : 'Tiếp tục'} onPress={() => {
        if (id === 'login') return submitLogin('USER');
        if (id === 'register') return submitRegister();
        if (id === 'forgot') return /^\S+@\S+\.\S+$/.test(email) ? authRoute('reset') : setError('Vui lòng nhập email hợp lệ.');
        if (password.length < 6 || password !== confirmPassword) return setError('Mật khẩu mới chưa hợp lệ hoặc không khớp.');
        setError(''); authRoute('login');
      }} />
      {id === 'login' ? <Button compact disabled={loginBusy} label="Đăng nhập với vai trò Chủ khách sạn" onPress={() => submitLogin('HOTEL_OWNER')} secondary /> : null}
      {id === 'login' ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Pressable onPress={() => authRoute('forgot')}><T style={{ color: colors.primary }}>Quên mật khẩu?</T></Pressable><Pressable onPress={() => authRoute('register')}><T style={{ color: colors.primary }}>Tạo tài khoản</T></Pressable></View> : null}
    </TravelerScaffold>;
  }

  if (id === 'otp') return <TravelerScaffold title={TITLES[id]}>
    <Field error={error} keyboardType="number-pad" label="Mã xác thực" maxLength={6} onChangeText={setCode} placeholder="Nhập 6 chữ số" value={code} />
    <Card><T weight="semibold">Bảo mật tài khoản</T><T style={{ color: colors.gray }}>Mã demo: 182460. Chỉ dùng để xem luồng giao diện.</T></Card>
    <Button label="Xác thực" onPress={() => Date.now() - otpSentAt > 300000 ? setError('Mã đã hết hạn. Hãy gửi lại mã demo.') : code === '182460' ? authRoute('profile-setup') : setError('Mã không hợp lệ. Hãy nhập 182460.')} />
    <Pressable onPress={() => { setCode(''); setOtpSentAt(Date.now()); setError('Đã gửi lại mã demo.'); }}><T style={{ color: colors.primary, textAlign: 'center' }}>Gửi lại mã</T></Pressable>
  </TravelerScaffold>;

  if (id === 'profile-setup') return <TravelerScaffold title={TITLES[id]}>
    <Field label="Tên hiển thị" onChangeText={setName} value={name} />
    <Card><T weight="semibold">Điểm đến yêu thích</T><T style={{ color: colors.gray }}>Đà Nẵng · Hội An</T></Card>
    <Button label="Tiếp tục" onPress={() => { updateProfile({ name }); authRoute('preferences-setup'); }} />
  </TravelerScaffold>;

  if (id === 'preferences-setup') return <TravelerScaffold title={TITLES[id]}>
    <Card><T weight="semibold">Bạn thích chuyến đi như thế nào?</T><T style={{ color: colors.gray }}>Chọn sở thích để nhận gợi ý phù hợp.</T></Card>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['Biển', 'Ẩm thực', 'Văn hóa', 'Nghỉ dưỡng', 'Gia đình', 'Tiết kiệm'].map((item) => <Chip key={item} label={item} selected={preferences.includes(item)} onPress={() => setPreferences(preferences.includes(item) ? preferences.filter((value) => value !== item) : [...preferences, item])} />)}</View>
    <Button label="Tiếp tục" onPress={() => { updateProfile({ preferences }); authRoute('location-permission'); }} />
  </TravelerScaffold>;

  const requestLocation = async () => {
    setPermissionBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setPermissionError('Bạn chưa cấp quyền vị trí. Hãy chọn điểm đến thủ công để tiếp tục.');
        return;
      }
      login(profile.email);
      complete();
    } catch {
      setPermissionError('Không thể yêu cầu vị trí lúc này. Hãy chọn điểm đến thủ công.');
    } finally {
      setPermissionBusy(false);
    }
  };

  return <TravelerScaffold title={TITLES[id]} footer={<Button disabled={permissionBusy} label={permissionBusy ? 'Đang yêu cầu quyền...' : 'Cho phép vị trí'} onPress={requestLocation} />}>
    <Card style={{ backgroundColor: '#DCEAFF', paddingVertical: 24 }}><T style={{ color: colors.primary, fontSize: 30 }}>⌖</T><T weight="semibold" style={{ fontSize: 18 }}>Quyền vị trí</T><T style={{ lineHeight: 20, color: colors.gray }}>Tìm khách sạn gần bạn tại Đà Nẵng. Bạn có thể nhập điểm đến thủ công nếu không cấp quyền.</T></Card>
    <Card onPress={() => { login(profile.email); complete(); }}><T weight="semibold">Tìm thủ công</T><T style={{ color: colors.gray }}>Đà Nẵng · Hội An · Nha Trang · Phú Quốc</T></Card>
    {permissionError ? <T accessibilityRole="alert" style={{ color: colors.error }}>{permissionError}</T> : null}
  </TravelerScaffold>;
}
