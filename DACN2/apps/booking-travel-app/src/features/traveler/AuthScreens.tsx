import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { isAdminDemoEnabled } from '@/features/admin/session';
import { authApi, getAuthErrorMessage, type UserRole } from '@/features/auth';

import { HOTELS } from './data';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, Chip, Field, HotelCard, T, TravelerScaffold } from './ui';

export type AuthScreenId = 'splash' | 'onboarding' | 'role-entry' | 'welcome' | 'login' | 'register' | 'otp' | 'forgot' | 'reset' | 'profile-setup' | 'preferences-setup' | 'location-permission';

export function authRoute(id: AuthScreenId, params: Record<string, string> = {}) {
  router.push({ pathname: '/auth/[id]', params: { id, ...params } } as Href);
}

const TITLES: Record<AuthScreenId, string> = {
  splash: 'Chào mừng đến Booking Travel',
  onboarding: 'Khám phá dễ dàng',
  'role-entry': 'Tiếp tục hành trình',
  welcome: 'Chào mừng bạn',
  login: 'Đăng nhập',
  register: 'Tạo tài khoản',
  otp: 'Xác thực email',
  forgot: 'Quên mật khẩu',
  reset: 'Đặt lại mật khẩu',
  'profile-setup': 'Thiết lập hồ sơ',
  'preferences-setup': 'Sở thích du lịch',
  'location-permission': 'Cho phép truy cập vị trí',
};

function IntroCard({ title = 'Khám phá hành trình của bạn' }: { title?: string }) {
  return (
    <View style={{ width: '100%', gap: 16 }}>
      <Card>
        <T weight="semibold" style={{ fontSize: 16 }}>
          {title}
        </T>
        <T style={{ color: colors.gray, lineHeight: 20 }}>Đặt khách sạn tin cậy, tìm nơi ở phù hợp và lên kế hoạch thông minh cho chuyến đi.</T>
      </Card>
      <HotelCard hotel={HOTELS[0]} />
    </View>
  );
}

interface AuthScreenProps {
  id: AuthScreenId;
  verificationEmail?: string;
  verificationSessionId?: string;
}

export function AuthScreen({ id, verificationEmail, verificationSessionId }: AuthScreenProps) {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const adminDemoEnabled = isAdminDemoEnabled(process.env.EXPO_PUBLIC_ENABLE_ADMIN_DEMO);
  const login = useTravelerStore((state) => state.login);
  const loginWithApiSession = useTravelerStore((state) => state.loginWithApiSession);
  const profile = useTravelerStore((state) => state.profile);
  const updateProfile = useTravelerStore((state) => state.updateProfile);
  const [email, setEmail] = useState(id === 'login' ? (verificationEmail ?? '') : profile.email);
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
  const [registerBusy, setRegisterBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [activeVerificationSessionId, setActiveVerificationSessionId] = useState('');
  const [notice, setNotice] = useState('');
  const currentVerificationSessionId = activeVerificationSessionId || verificationSessionId || '';

  const complete = (role: UserRole = 'USER') => router.replace(role === 'ADMIN' ? ('/admin' as Href) : role === 'HOTEL_OWNER' ? ('/hotel-owner' as Href) : (returnTo === '/owner-application' ? '/owner-application' : '/user') as Href);
  const submitLogin = async () => {
    const identifier = email.trim();
    const loginPassword = password;
    if (identifier.length < 3) return setError('Vui lòng nhập email hoặc số điện thoại.');
    if (!loginPassword) return setError('Vui lòng nhập mật khẩu.');

    setError('');
    setLoginBusy(true);
    try {
      const response = await authApi.login({ identifier, password: loginPassword });
      const sessionEmail = response.user.email ?? identifier;
      loginWithApiSession({
        userId: response.user.id,
        email: sessionEmail,
        fullName: response.user.fullName,
        role: response.user.role,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        sessionId: response.sessionId,
      });
      complete(response.user.role);
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Không thể đăng nhập lúc này.'));
    } finally {
      setLoginBusy(false);
    }
  };
  const submitRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return setError('Vui lòng nhập email hợp lệ.');
    if (normalizedName.length < 2) return setError('Họ và tên cần ít nhất 2 ký tự.');
    if (password.length < 8) return setError('Mật khẩu cần ít nhất 8 ký tự.');
    if (password !== confirmPassword) return setError('Mật khẩu xác nhận không khớp.');
    if (!accepted) return setError('Bạn cần đồng ý điều khoản để đăng ký.');

    setError('');
    setRegisterBusy(true);
    try {
      const response = await authApi.register({
        fullName: normalizedName,
        email: normalizedEmail,
        password,
        confirmPassword,
        acceptedTerms: accepted,
      });
      updateProfile({ name: normalizedName, email: normalizedEmail });
      authRoute('otp', {
        email: normalizedEmail,
        verificationSessionId: response.verification.verificationSessionId,
        ...(returnTo === '/owner-application' ? { returnTo } : {}),
      });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Không thể tạo tài khoản lúc này.'));
    } finally {
      setRegisterBusy(false);
    }
  };

  const submitOtp = async () => {
    if (!currentVerificationSessionId) {
      return setError('Không tìm thấy phiên xác thực. Vui lòng đăng ký lại.');
    }
    if (!/^\d{6}$/.test(code)) return setError('Vui lòng nhập đúng 6 chữ số OTP.');

    setError('');
    setNotice('');
    setVerifyBusy(true);
    try {
      await authApi.verify({
        verificationSessionId: currentVerificationSessionId,
        otp: code,
      });
      authRoute('login', { email: verificationEmail ?? profile.email, ...(returnTo === '/owner-application' ? { returnTo } : {}) });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Không thể xác thực OTP lúc này.'));
    } finally {
      setVerifyBusy(false);
    }
  };

  const resendOtp = async () => {
    if (!currentVerificationSessionId) {
      return setError('Không tìm thấy phiên xác thực. Vui lòng đăng ký lại.');
    }

    setError('');
    setNotice('');
    setResendBusy(true);
    try {
      const response = await authApi.resendVerification(currentVerificationSessionId);
      setActiveVerificationSessionId(response.verification.verificationSessionId);
      setCode('');
      setNotice('Đã tạo mã OTP mới. Hãy xem terminal backend trong môi trường local.');
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Không thể gửi lại OTP lúc này.'));
    } finally {
      setResendBusy(false);
    }
  };

  if (id === 'splash' || id === 'onboarding' || id === 'role-entry' || id === 'welcome') {
    const introTitle = id === 'onboarding' ? ['Khám phá hành trình của bạn', 'Tìm chỗ nghỉ phù hợp', 'Đặt phòng thật dễ dàng'][slide] : undefined;
    return (
      <TravelerScaffold title={TITLES[id]}>
        <IntroCard title={introTitle} />
        {id === 'onboarding' ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {[0, 1, 2].map((value) => (
              <Pressable
                accessibilityLabel={`Trang ${value + 1}`}
                key={value}
                onPress={() => setSlide(value)}
                style={{
                  height: 8,
                  width: value === slide ? 24 : 8,
                  borderRadius: 4,
                  backgroundColor: value === slide ? colors.primary : colors.line,
                }}
              />
            ))}
          </View>
        ) : null}
        <View style={{ width: '100%' }}>
          <Button compact label={id === 'splash' ? 'Bắt đầu khám phá' : id === 'onboarding' ? (slide < 2 ? 'Tiếp tục' : 'Bắt đầu') : id === 'role-entry' ? 'Tiếp tục là khách du lịch' : 'Đăng nhập'} onPress={() => (id === 'splash' ? authRoute('onboarding') : id === 'onboarding' ? (slide < 2 ? setSlide(slide + 1) : authRoute('role-entry')) : id === 'role-entry' ? authRoute('welcome') : authRoute('login'))} />
        </View>
        {id === 'onboarding' ? <Button label="Bỏ qua" secondary onPress={() => authRoute('role-entry')} /> : null}
        {id === 'role-entry' ? <Button label="Đăng nhập Chủ khách sạn" secondary onPress={() => authRoute('login')} /> : null}
        {adminDemoEnabled && (id === 'splash' || id === 'role-entry') ? <Button label="Đăng nhập Admin (demo)" secondary onPress={() => router.push('/auth/admin-demo' as Href)} /> : null}
        {id === 'welcome' ? <Button label="Tạo tài khoản" secondary onPress={() => authRoute('register')} /> : null}
        {id === 'welcome' ? (
          <Pressable
            onPress={() => {
              login('demo@bookingtravel.vn');
              complete();
            }}
          >
            <T style={{ textAlign: 'center', color: colors.primary }}>Khám phá bằng tài khoản demo</T>
          </Pressable>
        ) : null}
      </TravelerScaffold>
    );
  }

  if (id === 'login' || id === 'register' || id === 'forgot' || id === 'reset') {
    return (
      <TravelerScaffold title={TITLES[id]} background={colors.background}>
        {id !== 'reset' ? <Field error={error && !email.trim() ? error : undefined} keyboardType={id === 'login' ? 'default' : 'email-address'} label={id === 'login' ? 'Email hoặc số điện thoại' : 'Email'} onChangeText={setEmail} placeholder={id === 'login' ? 'traveler@bookingtravel.vn' : 'quang@example.com'} value={email} /> : null}
        {id === 'login' || id === 'register' || id === 'reset' ? (
          <>
            <Field label={id === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'} onChangeText={setPassword} placeholder="••••••••" secureTextEntry={!showPassword} value={password} />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <T style={{ color: colors.primary, textAlign: 'right' }}>{showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</T>
            </Pressable>
          </>
        ) : null}
        {id === 'register' ? (
          <>
            <Field label="Xác nhận mật khẩu" onChangeText={setConfirmPassword} secureTextEntry={!showPassword} value={confirmPassword} />
            <Field label="Họ và tên" onChangeText={setName} placeholder="Nguyễn Minh Quang" value={name} />
            <Chip label={accepted ? '✓ Đồng ý điều khoản' : 'Đồng ý điều khoản'} selected={accepted} onPress={() => setAccepted(!accepted)} />
          </>
        ) : null}
        {id === 'reset' ? <Field label="Xác nhận mật khẩu mới" onChangeText={setConfirmPassword} secureTextEntry={!showPassword} value={confirmPassword} /> : null}
        <Card>
          <T weight="semibold" style={{ fontSize: 16 }}>
            Bảo mật tài khoản
          </T>
          <T style={{ color: colors.gray, lineHeight: 20 }}>Thông tin cá nhân được lưu an toàn. Bạn có thể cập nhật bất cứ lúc nào.</T>
        </Card>
        {error ? <T style={{ color: colors.error }}>{error}</T> : null}
        <Button
          compact
          disabled={loginBusy || registerBusy}
          label={registerBusy ? 'Đang tạo tài khoản...' : loginBusy ? 'Đang đăng nhập...' : id === 'login' ? 'Đăng nhập' : id === 'register' ? 'Tạo tài khoản' : 'Tiếp tục'}
          onPress={() => {
            if (id === 'login') return submitLogin();
            if (id === 'register') return submitRegister();
            if (id === 'forgot') return /^\S+@\S+\.\S+$/.test(email) ? authRoute('reset') : setError('Vui lòng nhập email hợp lệ.');
            if (password.length < 6 || password !== confirmPassword) return setError('Mật khẩu mới chưa hợp lệ hoặc không khớp.');
            setError('');
            authRoute('login', returnTo === '/owner-application' ? { returnTo } : {});
          }}
        />
        {id === 'login' ? (
          <>
            <Button compact label="Tạo tài khoản mới" onPress={() => authRoute('register', returnTo === '/owner-application' ? { returnTo } : {})} secondary />
            {adminDemoEnabled ? <Button compact label="Đăng nhập Admin (demo)" onPress={() => router.push('/auth/admin-demo' as Href)} secondary /> : null}
            <Pressable onPress={() => authRoute('forgot')}>
              <T style={{ color: colors.primary, textAlign: 'center' }}>Quên mật khẩu?</T>
            </Pressable>
          </>
        ) : null}
      </TravelerScaffold>
    );
  }

  if (id === 'otp')
    return (
      <TravelerScaffold title={TITLES[id]}>
        <Field error={error} keyboardType="number-pad" label="Mã xác thực" maxLength={6} onChangeText={setCode} placeholder="Nhập 6 chữ số" value={code} />
        <Card>
          <T weight="semibold">Xác thực tài khoản</T>
          <T style={{ color: colors.gray }}>Mã OTP đã được tạo cho {verificationEmail ?? 'email của bạn'}. Trong môi trường local, mã được in tại terminal đang chạy backend.</T>
        </Card>
        {notice ? <T style={{ color: colors.primary }}>{notice}</T> : null}
        {!currentVerificationSessionId ? <Button label="Quay lại đăng ký" onPress={() => authRoute('register', returnTo === '/owner-application' ? { returnTo } : {})} secondary /> : null}
        <Button disabled={verifyBusy || resendBusy || !currentVerificationSessionId} label={verifyBusy ? 'Đang xác thực...' : 'Xác thực'} onPress={submitOtp} />
        <Pressable
          disabled={verifyBusy || resendBusy || !currentVerificationSessionId}
          onPress={resendOtp}
          style={{
            opacity: verifyBusy || resendBusy || !currentVerificationSessionId ? 0.5 : 1,
          }}
        >
          <T style={{ color: colors.primary, textAlign: 'center' }}>{resendBusy ? 'Đang gửi lại...' : 'Gửi lại mã'}</T>
        </Pressable>
      </TravelerScaffold>
    );

  if (id === 'profile-setup')
    return (
      <TravelerScaffold title={TITLES[id]}>
        <Field label="Tên hiển thị" onChangeText={setName} value={name} />
        <Card>
          <T weight="semibold">Điểm đến yêu thích</T>
          <T style={{ color: colors.gray }}>Đà Nẵng · Hội An</T>
        </Card>
        <Button
          label="Tiếp tục"
          onPress={() => {
            updateProfile({ name });
            authRoute('preferences-setup');
          }}
        />
      </TravelerScaffold>
    );

  if (id === 'preferences-setup')
    return (
      <TravelerScaffold title={TITLES[id]}>
        <Card>
          <T weight="semibold">Bạn thích chuyến đi như thế nào?</T>
          <T style={{ color: colors.gray }}>Chọn sở thích để nhận gợi ý phù hợp.</T>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['Biển', 'Ẩm thực', 'Văn hóa', 'Nghỉ dưỡng', 'Gia đình', 'Tiết kiệm'].map((item) => (
            <Chip key={item} label={item} selected={preferences.includes(item)} onPress={() => setPreferences(preferences.includes(item) ? preferences.filter((value) => value !== item) : [...preferences, item])} />
          ))}
        </View>
        <Button
          label="Tiếp tục"
          onPress={() => {
            updateProfile({ preferences });
            authRoute('location-permission');
          }}
        />
      </TravelerScaffold>
    );

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

  return (
    <TravelerScaffold title={TITLES[id]} footer={<Button disabled={permissionBusy} label={permissionBusy ? 'Đang yêu cầu quyền...' : 'Cho phép vị trí'} onPress={requestLocation} />}>
      <Card style={{ backgroundColor: '#DCEAFF', paddingVertical: 24 }}>
        <T style={{ color: colors.primary, fontSize: 30 }}>⌖</T>
        <T weight="semibold" style={{ fontSize: 18 }}>
          Quyền vị trí
        </T>
        <T style={{ lineHeight: 20, color: colors.gray }}>Tìm khách sạn gần bạn tại Đà Nẵng. Bạn có thể nhập điểm đến thủ công nếu không cấp quyền.</T>
      </Card>
      <Card
        onPress={() => {
          login(profile.email);
          complete();
        }}
      >
        <T weight="semibold">Tìm thủ công</T>
        <T style={{ color: colors.gray }}>Đà Nẵng · Hội An · Nha Trang · Phú Quốc</T>
      </Card>
      {permissionError ? (
        <T accessibilityRole="alert" style={{ color: colors.error }}>
          {permissionError}
        </T>
      ) : null}
    </TravelerScaffold>
  );
}
