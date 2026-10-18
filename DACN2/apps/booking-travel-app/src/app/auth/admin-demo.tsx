import { Redirect, router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ADMIN_DEMO_EMAIL, isAdminDemoEnabled, mockAdminAuthService } from '@/features/admin/session';
import { AdminSidebar } from '@/features/admin/dashboard/components';
import { ADMIN_COLORS, ADMIN_FONT } from '@/features/admin/theme';
import { useTravelerStore } from '@/features/traveler/store';

export default function AdminDemoLogin() {
  const [email, setEmail] = useState(ADMIN_DEMO_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useTravelerStore((state) => state.login);

  if (!isAdminDemoEnabled(process.env.EXPO_PUBLIC_ENABLE_ADMIN_DEMO)) return <Redirect href="/auth/login" />;

  const submit = async () => {
    if (!email.trim() || !password) { setError('Vui lòng nhập email và mật khẩu.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Email không hợp lệ.'); return; }
    setLoading(true);
    const demoSession = await mockAdminAuthService.signIn(email, password);
    if (!demoSession) {
      setError('Thông tin đăng nhập demo Admin không đúng.');
      setLoading(false);
      return;
    }
    setError('');
    login(demoSession.email, demoSession.role);
    router.replace('/admin' as Href);
  };

  return <View style={styles.screen}>
    <AdminSidebar compact={false} onUnavailable={() => {}} />
    <View style={styles.main}>
      <Text style={styles.eyebrow}>QUẢN TRỊ HỆ THỐNG</Text>
      <Text style={styles.title}>Đăng nhập quản trị</Text>
      <Text style={styles.description}>Dữ liệu minh họa · quyết định được ghi nhận và truy vết</Text>
      <View style={styles.card}>
      <Text style={styles.cardTitle}>Đăng nhập quản trị</Text>
      <Text style={styles.label}>Email</Text>
      <TextInput accessibilityLabel="Email Admin demo" autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} style={styles.input} value={email} />
      <Text style={styles.label}>Mật khẩu</Text>
      <TextInput accessibilityLabel="Mật khẩu Admin demo" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
      <Text style={styles.hint}>Tài khoản demo: {ADMIN_DEMO_EMAIL} / mật khẩu demo trong README</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading }} disabled={loading} onPress={() => void submit()} style={styles.button}><Text style={styles.buttonLabel}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', backgroundColor: ADMIN_COLORS.background },
  main: { flex: 1, padding: 24 },
  eyebrow: { fontFamily: ADMIN_FONT.semibold, fontSize: 10, letterSpacing: 0.6, color: '#175ED6', marginBottom: 16 },
  card: { width: '100%', padding: 16, borderRadius: 12, backgroundColor: ADMIN_COLORS.surface, gap: 10, marginTop: 16 },
  cardTitle: { fontFamily: ADMIN_FONT.semibold, fontSize: 16, color: ADMIN_COLORS.heading },
  title: { fontFamily: ADMIN_FONT.bold, fontSize: 24, color: ADMIN_COLORS.heading },
  description: { fontFamily: ADMIN_FONT.regular, fontSize: 12, lineHeight: 18, color: ADMIN_COLORS.secondaryText, marginTop: 8 },
  label: { fontFamily: ADMIN_FONT.medium, fontSize: 13, color: ADMIN_COLORS.heading },
  input: { height: 42, borderRadius: 8, borderWidth: 1, borderColor: ADMIN_COLORS.border, paddingHorizontal: 12, fontFamily: ADMIN_FONT.regular },
  hint: { fontFamily: ADMIN_FONT.regular, fontSize: 12, color: ADMIN_COLORS.secondaryText },
  error: { fontFamily: ADMIN_FONT.medium, fontSize: 12, color: '#B91C1C' },
  button: { marginTop: 16, height: 40, width: 340, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontFamily: ADMIN_FONT.semibold, fontSize: 14, color: '#FFFFFF' },
});
