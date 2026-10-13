import { Asset } from 'expo-asset';
import { router, type Href } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, type TextProps, type ViewStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgUri } from 'react-native-svg';

import { currency, type Hotel } from './data';
import { useTravelerStore } from './store';
import { colors, font } from './theme';

const TAB_ICONS = {
  home: { active: require('./assets/14120.svg'), inactive: require('./assets/38de7.svg') },
  search: { active: require('./assets/0823a.svg'), inactive: require('./assets/261ed.svg') },
  bookings: { active: require('./assets/5c9f6.svg'), inactive: require('./assets/5c9f6.svg') },
  messages: { active: require('./assets/d3906.svg'), inactive: require('./assets/d3906.svg') },
  profile: { active: require('./assets/a201f.svg'), inactive: require('./assets/6f688.svg') },
} as const;

const MAX_CONTENT_WIDTH = 520;
const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0 1px 6px rgba(0, 0, 0, 0.08)' },
  default: { elevation: 2, shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
});

export function TravelerTabIcon({ name, focused }: { name: keyof typeof TAB_ICONS; focused: boolean }) {
  const uri = Asset.fromModule(TAB_ICONS[name][focused ? 'active' : 'inactive']).uri;
  return <View style={{ opacity: focused ? 1 : 0.85 }}><SvgUri height={20} uri={uri} width={20} /></View>;
}

export function FigmaIcon({ source, size = 20 }: { source: number; size?: number }) {
  return <SvgUri height={size} uri={Asset.fromModule(source).uri} width={size} />;
}

export function T({ children, style, weight = 'regular', ...props }: TextProps & { weight?: keyof typeof font }) {
  return <Text {...props} style={[{ color: colors.ink, fontFamily: font[weight] }, style]}>{children}</Text>;
}

export function go(id: string, params?: Record<string, string>) {
  router.push({ pathname: '/user/screen/[id]', params: { id, ...params } } as Href);
}

export function TravelerScaffold({ title, children, footer, back = false, scroll = true, background = colors.background, headerRight }: PropsWithChildren<{ title?: string; footer?: ReactNode; back?: boolean; scroll?: boolean; background?: string; headerRight?: ReactNode }>) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {title ? <View style={styles.header}>
          {back ? <Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.back}><T style={styles.backText}>‹</T></Pressable> : null}
          <T weight="semibold" style={styles.headerTitle}>{title}</T>
          {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
        </View> : null}
        {scroll ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[styles.content, styles.flex]}>{children}</View>}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Button({ label, onPress, secondary = false, violet = false, disabled = false, compact = false }: { label: string; onPress: () => void; secondary?: boolean; violet?: boolean; disabled?: boolean; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, compact && styles.buttonCompact, secondary ? styles.buttonSecondary : violet ? styles.buttonViolet : styles.buttonPrimary, (pressed || disabled) && { opacity: 0.72 }]}>
    <T weight="semibold" style={[styles.buttonLabel, secondary && { color: colors.ink }]}>{label}</T>
  </Pressable>;
}

export function Card({ children, style, onPress }: PropsWithChildren<{ style?: ViewStyle; onPress?: () => void }>) {
  if (onPress) return <Pressable onPress={onPress} style={[styles.card, style]}>{children}</Pressable>;
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress, small = false }: { label: string; selected?: boolean; onPress: () => void; small?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, small && styles.chipSmall, selected && styles.chipSelected]}><T weight="semibold" style={[styles.chipText, selected && { color: colors.primaryDark }]}>{label}</T></Pressable>;
}

export function Field({ label, multiline, error, style, ...inputProps }: TextInputProps & { label: string; error?: string }) {
  return <View style={styles.fieldWrap}>
    <T weight="semibold" style={styles.fieldLabel}>{label}</T>
    <TextInput {...inputProps} accessibilityLabel={label} autoCapitalize={inputProps.autoCapitalize ?? 'none'} multiline={multiline} placeholderTextColor={colors.muted} style={[styles.input, multiline && { height: 96, textAlignVertical: 'top' }, error && { borderColor: colors.error }, style]} />
    {error ? <T style={styles.error}>{error}</T> : null}
  </View>;
}

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionRow}><T weight="semibold" style={styles.sectionTitle}>{title}</T>{action ? onPress ? <Pressable onPress={onPress}><T weight="semibold" style={styles.sectionAction}>{action}</T></Pressable> : <T weight="semibold" style={styles.sectionAction}>{action}</T> : null}</View>;
}

export function HotelCard({ hotel, compact = false, showActions = false }: { hotel: Hotel; compact?: boolean; showActions?: boolean }) {
  const favorites = useTravelerStore((state) => state.favorites);
  const compare = useTravelerStore((state) => state.compare);
  const selectHotel = useTravelerStore((state) => state.selectHotel);
  const toggleFavorite = useTravelerStore((state) => state.toggleFavorite);
  const toggleCompare = useTravelerStore((state) => state.toggleCompare);
  const open = () => { selectHotel(hotel.id); go('hotel-detail', { hotelId: hotel.id }); };
  return <View style={styles.hotelCard}>
    <Pressable onPress={open}>
      <Image accessibilityLabel={`Ảnh ${hotel.name}`} source={hotel.image} style={[styles.hotelImage, compact && styles.hotelImageCompact]} />
      <View style={styles.hotelDetails}>
        <T weight="semibold" style={styles.hotelName}>{hotel.name}</T>
        <T style={styles.hotelMeta}>{hotel.address} · {hotel.destination} · {hotel.distance}</T>
        <T weight="semibold" style={styles.hotelRating}>★ {hotel.rating}/10 · {new Intl.NumberFormat('vi-VN').format(hotel.reviews)} đánh giá · {hotel.amenities[0]}</T>
        <T weight="bold" style={styles.hotelPrice}>Từ {currency(hotel.price)} / đêm</T>
        <T style={styles.hotelOffer}>Ưu đãi 12% · Miễn phí hủy theo điều kiện</T>
      </View>
    </Pressable>
    {showActions ? <View style={styles.hotelActions}>
      <Chip label={favorites.includes(hotel.id) ? '♥ Đã lưu' : '♡ Yêu thích'} selected={favorites.includes(hotel.id)} onPress={() => toggleFavorite(hotel.id)} small />
      <Chip label={compare.includes(hotel.id) ? '✓ So sánh' : 'So sánh'} selected={compare.includes(hotel.id)} onPress={() => toggleCompare(hotel.id)} small />
    </View> : null}
  </View>;
}

export function EmptyState({ title, detail, action, onPress }: { title: string; detail: string; action?: string; onPress?: () => void }) {
  return <View style={styles.empty}><T weight="semibold" style={styles.emptyTitle}>{title}</T><T style={styles.emptyDetail}>{detail}</T>{action && onPress ? <Button label={action} onPress={onPress} /> : null}</View>;
}

export function Row({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  const content = <><T style={styles.rowLabel}>{label}</T><T weight="medium" style={styles.rowValue}>{value ?? '›'}</T></>;
  return onPress ? <Pressable onPress={onPress} style={styles.row}>{content}</Pressable> : <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1 },
  header: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white },
  headerTitle: { fontSize: 20, lineHeight: 28, flex: 1 },
  back: { width: 32, marginRight: 8 }, backText: { fontSize: 32, lineHeight: 34 }, headerRight: { marginLeft: 8 },
  content: { flexGrow: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: 16, paddingBottom: 28, gap: 16 },
  footer: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonCompact: { minHeight: 40 }, buttonPrimary: { backgroundColor: colors.primary }, buttonViolet: { backgroundColor: colors.violet }, buttonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  buttonLabel: { color: colors.white, fontSize: 16, lineHeight: 20, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  chipSmall: { minHeight: 32 }, chipSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary }, chipText: { fontSize: 13, lineHeight: 18 },
  fieldWrap: { gap: 8, marginBottom: 4 }, fieldLabel: { fontSize: 14, lineHeight: 20, color: colors.gray },
  input: { minHeight: 44, backgroundColor: colors.white, borderWidth: 1, borderColor: '#CDD4DE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.ink, fontFamily: font.regular, fontSize: 14 },
  error: { color: colors.error, fontSize: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 20, lineHeight: 28, color: colors.navy }, sectionAction: { color: colors.primaryDark, fontSize: 13 },
  hotelCard: { width: '100%', alignSelf: 'stretch', backgroundColor: colors.white, borderRadius: 16, overflow: 'hidden', ...CARD_SHADOW },
  hotelImage: { width: '100%', aspectRatio: 340 / 228, borderRadius: 14 }, hotelImageCompact: { height: 180, aspectRatio: undefined }, hotelDetails: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 6 },
  hotelName: { fontSize: 18, lineHeight: 26 }, hotelMeta: { color: colors.gray, fontSize: 13, lineHeight: 18 }, hotelRating: { color: '#374151', fontSize: 14, lineHeight: 20 },
  hotelPrice: { color: colors.primaryDark, fontSize: 18, lineHeight: 24 }, hotelOffer: { color: colors.orange, fontSize: 12, lineHeight: 18 },
  hotelActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  empty: { backgroundColor: colors.white, borderRadius: 16, padding: 24, alignItems: 'center', gap: 12 }, emptyTitle: { fontSize: 18, textAlign: 'center' }, emptyDetail: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  row: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowLabel: { fontSize: 14 }, rowValue: { fontSize: 14, color: colors.muted },
});
