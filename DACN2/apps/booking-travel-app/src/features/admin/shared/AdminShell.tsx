import { Asset } from 'expo-asset';
import { router, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgUri } from 'react-native-svg';

import { ADMIN_NAVIGATION, AdminSidebar, adminSectionFromPath, adminTitleFromPath } from '../dashboard/components';
import { ADMIN_COLORS, ADMIN_FONT } from '../theme';
import { useTravelerStore } from '@/features/traveler/store';

const DESKTOP_MIN_WIDTH = 1024;

export function AdminShell({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const email = useTravelerStore((state) => state.session?.email);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProgress] = useState(() => new Animated.Value(0));
  const desktop = width >= DESKTOP_MIN_WIDTH;
  const drawerWidth = Math.min(304, width - 32);

  useEffect(() => {
    Animated.timing(drawerProgress, { toValue: drawerOpen ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [drawerOpen, drawerProgress]);

  useEffect(() => {
    if (!drawerOpen || desktop) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setDrawerOpen(false); return true; });
    return () => listener.remove();
  }, [desktop, drawerOpen]);

  const activeSection = adminSectionFromPath(pathname);

  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safe}>
    <View onLayout={() => { if (desktop && drawerOpen) setDrawerOpen(false); }} style={styles.screen}>
      {desktop ? <AdminSidebar compact={false} onUnavailable={() => {}} /> : null}
      <View style={styles.main}>
        {!desktop ? <View style={styles.header}>
          <Pressable accessibilityLabel="Mở menu Admin" accessibilityRole="button" accessibilityState={{ expanded: drawerOpen }} onPress={() => setDrawerOpen(true)} style={styles.menuButton}>
            <View style={styles.menuLines}><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></View>
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>{adminTitleFromPath(pathname)}</Text>
        </View> : null}
        <View style={styles.content}>{children}</View>
      </View>
      {!desktop ? <View accessibilityElementsHidden={!drawerOpen} importantForAccessibility={drawerOpen ? 'yes' : 'no-hide-descendants'} pointerEvents={drawerOpen ? 'auto' : 'none'} style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: drawerProgress }]}><Pressable accessibilityLabel="Đóng menu Admin" accessibilityRole="button" onPress={() => setDrawerOpen(false)} style={styles.backdropButton} /></Animated.View>
        <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX: drawerProgress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] }) }] }]}>
          <View style={styles.brand}><Text style={styles.brandTitle}>BOOKING TRAVEL</Text><Text style={styles.brandSubtitle}>ADMIN CONSOLE</Text></View>
          <ScrollView contentContainerStyle={styles.navigation} showsVerticalScrollIndicator={false}>
            {ADMIN_NAVIGATION.map((item) => {
              const active = item.id === activeSection;
              return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.mobileLabel ?? item.label} accessibilityState={{ selected: active }} onPress={() => { setDrawerOpen(false); router.push(item.href); }} style={({ pressed }) => [styles.navItem, active && styles.navActive, pressed && styles.pressed]}>
                <SvgUri height={20} uri={Asset.fromModule(item.icon).uri} width={20} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.mobileLabel ?? item.label}</Text>
              </Pressable>;
            })}
          </ScrollView>
          <View style={styles.footer}><Text style={styles.footerLabel}>THÔNG TIN ADMIN</Text><Text numberOfLines={2} style={styles.footerEmail}>{email}</Text></View>
        </Animated.View>
      </View> : null}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ADMIN_COLORS.surface },
  screen: { flex: 1, flexDirection: 'row', backgroundColor: ADMIN_COLORS.background },
  main: { flex: 1, minWidth: 0 },
  content: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: ADMIN_COLORS.surface, borderBottomWidth: 1, borderBottomColor: ADMIN_COLORS.border },
  menuButton: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  menuLines: { gap: 4 },
  menuLine: { width: 20, height: 2, borderRadius: 1, backgroundColor: ADMIN_COLORS.heading },
  headerTitle: { marginLeft: 12, flex: 1, color: ADMIN_COLORS.heading, fontFamily: ADMIN_FONT.semibold, fontSize: 18 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#071629' },
  backdropButton: { flex: 1 },
  drawer: { flex: 1, backgroundColor: ADMIN_COLORS.sidebar },
  brand: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', gap: 3 },
  brandTitle: { color: '#FFFFFF', fontFamily: ADMIN_FONT.bold, fontSize: 17, lineHeight: 24 },
  brandSubtitle: { color: 'rgba(255,255,255,0.7)', fontFamily: ADMIN_FONT.semibold, fontSize: 10, lineHeight: 14 },
  navigation: { padding: 16, gap: 3 },
  navItem: { minHeight: 48, paddingHorizontal: 16, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
  navActive: { backgroundColor: ADMIN_COLORS.sidebarActive },
  navLabel: { flex: 1, color: 'rgba(255,255,255,0.82)', fontFamily: ADMIN_FONT.medium, fontSize: 14, lineHeight: 20 },
  navLabelActive: { color: '#FFFFFF', fontFamily: ADMIN_FONT.semibold },
  pressed: { opacity: 0.75 },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', gap: 4 },
  footerLabel: { color: 'rgba(255,255,255,0.65)', fontFamily: ADMIN_FONT.semibold, fontSize: 10 },
  footerEmail: { color: '#FFFFFF', fontFamily: ADMIN_FONT.medium, fontSize: 13, lineHeight: 19 },
});
