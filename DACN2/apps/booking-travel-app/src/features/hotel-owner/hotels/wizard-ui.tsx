import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { InfoCard, OwnerButton, OwnerScaffold } from '../components/owner-ui';
import { ownerColors } from '../styles/tokens';

export function WizardStep({ title, number, subtitle, onBack, onExit, nextLabel = 'Lưu & tiếp tục', onNext, disabled, busy, children, testID }: { title: string; number: number; subtitle: string; onBack: () => void; onExit?: () => void; nextLabel?: string; onNext: () => void; disabled?: boolean; busy?: boolean; children: ReactNode; testID: string }) {
  return <OwnerScaffold title={title} testID={testID} footer={<OwnerButton label={busy ? 'Đang lưu...' : nextLabel} disabled={disabled || busy} onPress={onNext} />}>
    <View style={styles.navigation}><Pressable accessibilityRole="button" onPress={onBack} style={styles.navButton}><Text style={styles.navText}>‹ Quay lại</Text></Pressable>{onExit ? <Pressable accessibilityRole="button" onPress={onExit} style={styles.navButton}><Text style={styles.navText}>Lưu nháp & thoát</Text></Pressable> : null}</View>
    <InfoCard style={styles.stepCard}><Text style={styles.stepTitle}>Bước {number} / 5</Text><Text style={styles.muted}>{subtitle}</Text></InfoCard>
    {children}
  </OwnerScaffold>;
}

export function WizardSummary({ label, value, hint = 'Chạm để chỉnh sửa', onPress }: { label: string; value: string; hint?: string; onPress: () => void }) {
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><Pressable accessibilityLabel={`${label}: ${value}. ${hint}`} accessibilityRole="button" onPress={onPress} style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.muted}>{hint}</Text></Pressable></View>;
}

export function WizardField({ label, value, onChange, placeholder, multiline = false, error, keyboardType }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; error?: string; keyboardType?: 'default' | 'decimal-pad' | 'email-address' | 'phone-pad' }) {
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} keyboardType={keyboardType} multiline={multiline} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={ownerColors.muted} style={[styles.input, multiline && styles.multiline, error && styles.inputError]} value={value} />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

export function WizardNotice({ title, body, error = false, actionLabel, onAction }: { title: string; body: string; error?: boolean; actionLabel?: string; onAction?: () => void }) {
  return <InfoCard><Text style={[styles.stepTitle, error && styles.error]}>{title}</Text><Text style={styles.muted}>{body}</Text>{actionLabel && onAction ? <OwnerButton label={actionLabel} secondary onPress={onAction} /> : null}</InfoCard>;
}

export function leaveWizard() { router.replace('/hotel-owner/hotels'); }

const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navButton: { minHeight: 44, justifyContent: 'center' },
  navText: { color: ownerColors.primaryDark, fontSize: 14, fontWeight: '600' },
  stepCard: { paddingVertical: 10, gap: 4 },
  stepTitle: { color: ownerColors.text, fontSize: 16, fontWeight: '600', lineHeight: 24 },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  group: { gap: 8 },
  label: { color: ownerColors.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  summary: { minHeight: 72, backgroundColor: ownerColors.surface, borderRadius: 12, padding: 14, gap: 8 },
  summaryValue: { color: ownerColors.text, fontSize: 16, fontWeight: '600', lineHeight: 24 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: ownerColors.border, backgroundColor: ownerColors.surface, paddingHorizontal: 14, paddingVertical: 10, color: ownerColors.text, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: ownerColors.danger },
  error: { color: ownerColors.danger, fontSize: 13, lineHeight: 18 },
});
