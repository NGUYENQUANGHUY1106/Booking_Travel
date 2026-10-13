import { router } from 'expo-router';
import { Asset } from 'expo-asset';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgUri } from 'react-native-svg';

import accountIcon from '../assets/account.svg';
import bookingIcon from '../assets/booking.svg';
import dashboardIcon from '../assets/dashboard.svg';
import hotelIcon from '../assets/hotel.svg';
import messageIcon from '../assets/message.svg';
import { ownerColors } from '../styles/tokens';

const MAX_CONTENT_WIDTH = 520;

type OwnerScaffoldProps = PropsWithChildren<{
  title: string;
  overline?: string;
  footer?: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function OwnerScaffold({
  title,
  overline = 'CHỦ KHÁCH SẠN',
  footer,
  scroll = true,
  children,
  style,
}: OwnerScaffoldProps) {
  const content = <View style={[styles.content, style]}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <OwnerHeader overline={overline} title={title} />
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, footer ? styles.withFooter : null]}
            keyboardShouldPersistTaps="handled"
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
}: {
  label?: string;
  value: string;
  hint?: string;
  multiline?: boolean;
  onChangeText?: (value: string) => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.fieldCard}>
        {onChangeText ? (
          <TextInput
            multiline={multiline}
            onChangeText={onChangeText}
            style={[styles.fieldValue, multiline && styles.multiline]}
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

const tabAssets = {
  dashboard: dashboardIcon,
  hotel: hotelIcon,
  booking: bookingIcon,
  message: messageIcon,
  account: accountIcon,
} as const;

export function OwnerTabIcon({ name, focused }: { name: keyof typeof tabAssets; focused: boolean }) {
  const uri = Asset.fromModule(tabAssets[name]).uri;
  return (
    <View style={[styles.tabIcon, !focused && styles.tabIconInactive]}>
      <SvgUri height={20} uri={uri} width={20} />
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
  fieldValue: { padding: 0, color: ownerColors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  multiline: { minHeight: 44, textAlignVertical: 'top' },
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
  tabIconInactive: { opacity: 0.86 },
});

