import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ownerColors } from '../styles/tokens';

const MAX_CONTENT_WIDTH = 520;

type OwnerScaffoldProps = PropsWithChildren<{
  title: string;
  overline?: string;
  footer?: ReactNode;
  footerPadding?: number;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function OwnerScaffold({
  title,
  overline = 'CHỦ KHÁCH SẠN',
  footer,
  footerPadding = 82,
  scroll = true,
  onRefresh,
  refreshing = false,
  children,
  style,
  testID,
}: OwnerScaffoldProps) {
  const content = <View style={[styles.content, style]}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea} testID={testID}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <OwnerHeader overline={overline} title={title} />
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, footer ? { paddingBottom: footerPadding } : null]}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ownerColors.primary} /> : undefined}
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.flex, footer ? styles.withFooter : null]}>{content}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function OwnerHeader({ title, overline }: { title: string; overline?: string }) {
  return (
    <View style={styles.header}>
      {overline ? <Text style={styles.overline}>{overline}</Text> : null}
      <Text numberOfLines={2} style={styles.headerTitle}>
        {title}
      </Text>
    </View>
  );
}

export function OwnerButton({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={2}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText, danger && styles.buttonDangerText]}>{label}</Text>
    </Pressable>
  );
}

export function InfoCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function FieldCard({
  label,
  value,
  hint = 'Chạm để chỉnh sửa',
  multiline = false,
  onChangeText,
  placeholder,
  onBlur,
  compact = false,
}: {
  label?: string;
  value: string;
  hint?: string;
  multiline?: boolean;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  onBlur?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.fieldCard, compact && styles.fieldCardCompact]}>
        {onChangeText ? (
          <TextInput
            accessibilityLabel={label}
            multiline={multiline}
            onChangeText={onChangeText}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={ownerColors.muted}
            style={[styles.fieldValue, multiline && styles.multiline, compact && multiline && styles.compactMultiline]}
            value={value}
          />
        ) : (
          <Text style={styles.fieldValue}>{value}</Text>
        )}
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

export function StatusPanel({
  title,
  body,
  tone = 'blue',
}: {
  title: string;
  body: string;
  tone?: 'blue' | 'yellow' | 'red' | 'purple';
}) {
  return (
    <View style={[styles.status, styles[`status_${tone}`]]}>
      <Text style={[styles.statusTitle, styles[`statusTitle_${tone}`]]}>● {title}</Text>
      <Text style={styles.statusBody}>{body}</Text>
    </View>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function BackRow({ title }: { title: string }) {
  return (
    <View style={styles.backRow}>
      <Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text style={styles.backTitle}>{title}</Text>
      <View style={styles.backSpacer} />
    </View>
  );
}

type OwnerTabName = 'dashboard' | 'hotel' | 'booking' | 'message' | 'account';

export function OwnerTabIcon({ name, focused }: { name: OwnerTabName; focused: boolean }) {
  const stroke = focused ? ownerColors.primary : '#596779';
  return (
    <View style={styles.tabIcon}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {name === 'dashboard' ? <>
          <Path d="M3.333 2.5H8.333a.833.833 0 0 1 .834.833v5a.833.833 0 0 1-.834.834h-5a.833.833 0 0 1-.833-.834v-5a.833.833 0 0 1 .833-.833Z" />
          <Path d="M11.667 2.5h5a.833.833 0 0 1 .833.833v5a.833.833 0 0 1-.833.834h-5a.833.833 0 0 1-.834-.834v-5a.833.833 0 0 1 .834-.833Z" />
          <Path d="M3.333 10.833h5a.833.833 0 0 1 .834.834v5a.833.833 0 0 1-.834.833h-5a.833.833 0 0 1-.833-.833v-5a.833.833 0 0 1 .833-.834Z" />
          <Path d="M11.667 10.833h5a.833.833 0 0 1 .833.834v5a.833.833 0 0 1-.833.833h-5a.833.833 0 0 1-.834-.833v-5a.833.833 0 0 1 .834-.834Z" />
        </> : null}
        {name === 'hotel' ? <><Path d="M2.5 17.5V6.667L10 2.5l7.5 4.167V17.5H2.5Z" /><Path d="M7.5 17.5v-5.833h5V17.5M6.667 8.333H7.5m5 0h.833" /></> : null}
        {name === 'booking' ? <><Path d="M4.167 4.167h11.666A1.667 1.667 0 0 1 17.5 5.833v10a1.667 1.667 0 0 1-1.667 1.667H4.167A1.667 1.667 0 0 1 2.5 15.833v-10a1.667 1.667 0 0 1 1.667-1.666Z" /><Path d="M5.833 2.5v3.333M14.167 2.5v3.333M2.5 8.333h15" /></> : null}
        {name === 'message' ? <><Path d="M3.333 4.167h13.334v10H7.5L3.333 17.5V4.167Z" /><Path d="M6.667 7.5h6.666m-6.666 3.333h4.166" /></> : null}
        {name === 'account' ? <><Path d="M13.333 6.667A3.333 3.333 0 1 1 6.667 6.667a3.333 3.333 0 0 1 6.666 0Z" /><Path d="M3.333 17.5a6.667 6.667 0 0 1 13.334 0" /></> : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: ownerColors.background },
  header: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    minHeight: 74,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: ownerColors.surface,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  overline: {
    color: ownerColors.primary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.35,
    marginBottom: 3,
  },
  headerTitle: { color: ownerColors.text, fontSize: 21, fontWeight: '700', lineHeight: 28 },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  withFooter: { paddingBottom: 82 },
  content: { flex: 1, width: '100%', alignSelf: 'stretch', padding: 16, gap: 12 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    backgroundColor: ownerColors.background,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  button: {
    width: '100%',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: ownerColors.primary,
    paddingHorizontal: 16,
  },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { backgroundColor: ownerColors.disabled },
  buttonSecondary: { backgroundColor: '#DBEAFE' },
  buttonDanger: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buttonSecondaryText: { color: ownerColors.primaryDark },
  buttonDangerText: { color: '#B91C1C' },
  card: { borderRadius: 12, backgroundColor: ownerColors.surface, padding: 14, gap: 8 },
  fieldGroup: { gap: 8 },
  fieldLabel: { color: ownerColors.muted, fontSize: 14, fontWeight: '700' },
  fieldCard: { minHeight: 78, justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 14, gap: 8 },
  fieldCardCompact: { minHeight: 68, paddingVertical: 10 },
  fieldValue: { padding: 0, color: ownerColors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  multiline: { minHeight: 44, textAlignVertical: 'top' },
  compactMultiline: { minHeight: 22 },
  fieldHint: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  status: { borderRadius: 12, padding: 16, gap: 10 },
  status_blue: { backgroundColor: '#D9E9FE' },
  status_yellow: { backgroundColor: ownerColors.yellowSoft },
  status_red: { backgroundColor: '#F3F4F6' },
  status_purple: { backgroundColor: ownerColors.aiSoft },
  statusTitle: { fontSize: 16, fontWeight: '700' },
  statusTitle_blue: { color: ownerColors.success },
  statusTitle_yellow: { color: ownerColors.warning },
  statusTitle_red: { color: ownerColors.danger },
  statusTitle_purple: { color: ownerColors.ai },
  statusBody: { color: ownerColors.muted, fontSize: 14, lineHeight: 21 },
  sectionTitle: { color: ownerColors.textModern, fontSize: 17, fontWeight: '700', lineHeight: 24 },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: ownerColors.primary, fontSize: 32, lineHeight: 34 },
  backTitle: { color: ownerColors.textModern, fontSize: 20, fontWeight: '700' },
  backSpacer: { width: 38 },
  tabIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});

