import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InfoCard, SectionTitle } from '../components';
import { chartValues, dashboardKpis, ownerProfile } from '../mocks';
import { ownerScreenHref } from '../navigation';
import { ownerColors } from '../styles/tokens';

const quickActions = [
  { icon: '▦', label: 'Lịch trống', route: 'availability' },
  { icon: '₫', label: 'Lịch giá', route: 'pricing' },
  { icon: '⌁', label: 'Đặt phòng', route: 'booking-detail' },
  { icon: '✦', label: 'AI dự báo', route: 'forecast' },
] as const;

export function OwnerDashboardScreen() {
  const [period, setPeriod] = useState<'7 ngày' | '30 ngày'>('7 ngày');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>TỔNG QUAN</Text>
          <Text style={styles.title}>Xin chào, {ownerProfile.name.split(' ').at(-1)}</Text>
          <Text style={styles.subtitle}>Tình hình vận hành hôm nay của khách sạn</Text>
        </View>

        <View style={styles.kpiGrid}>
          {dashboardKpis.map((item) => (
            <View key={item.label} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{item.label}</Text>
              <Text style={styles.kpiValue}>{item.value}</Text>
              <Text style={[styles.kpiNote, item.tone === 'green' && styles.success]}>{item.note}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <SectionTitle>Doanh thu gần đây</SectionTitle>
          <View style={styles.segment}>
            {(['7 ngày', '30 ngày'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setPeriod(item)}
                style={[styles.segmentItem, period === item && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, period === item && styles.segmentTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <InfoCard style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTotal}>12.650.000 ₫</Text>
              <Text style={styles.chartCaption}>Tổng doanh thu · {period}</Text>
            </View>
            <Text style={styles.success}>+8,4%</Text>
          </View>
          <View style={styles.chart}>
            {chartValues.map((value, index) => (
              <View key={`${value}-${index}`} style={styles.barSlot}>
                <View style={[styles.bar, { height: value }, index === chartValues.length - 1 && styles.barActive]} />
                <Text style={styles.day}>{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index]}</Text>
              </View>
            ))}
          </View>
        </InfoCard>

        <SectionTitle>Truy cập nhanh</SectionTitle>
        <View style={styles.actions}>
          {quickActions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => router.push(ownerScreenHref(action.route))}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.aiCard}>
          <View style={styles.aiIcon}><Text style={styles.aiIconText}>✦</Text></View>
          <View style={styles.aiCopy}>
            <Text style={styles.aiTitle}>Gợi ý thông minh</Text>
            <Text style={styles.aiBody}>Nhu cầu cuối tuần đang tăng. AI đề xuất điều chỉnh giá phòng.</Text>
          </View>
          <Pressable onPress={() => router.push(ownerScreenHref('pricing-ai'))}>
            <Text style={styles.aiLink}>Xem ›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 16, paddingBottom: 24, gap: 18 },
  hero: { gap: 4 },
  eyebrow: { color: ownerColors.modernPrimary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: ownerColors.textModern, fontSize: 24, fontWeight: '800', lineHeight: 31 },
  subtitle: { color: ownerColors.mutedModern, fontSize: 14, lineHeight: 20 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { minWidth: 0, flexBasis: '47%', flexGrow: 1, borderRadius: 14, backgroundColor: '#F2F7FF', padding: 13, gap: 5 },
  kpiLabel: { color: ownerColors.mutedModern, fontSize: 11, fontWeight: '600' },
  kpiValue: { color: ownerColors.textModern, fontSize: 22, fontWeight: '800', lineHeight: 27 },
  kpiNote: { color: ownerColors.modernPrimary, fontSize: 11, lineHeight: 15 },
  success: { color: '#147A4F', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  segment: { flexDirection: 'row', borderRadius: 9, backgroundColor: '#F0F2F5', padding: 3 },
  segmentItem: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  segmentItemActive: { backgroundColor: '#FFFFFF' },
  segmentText: { color: ownerColors.mutedModern, fontSize: 11, fontWeight: '600' },
  segmentTextActive: { color: ownerColors.modernPrimary },
  chartCard: { borderWidth: 1, borderColor: '#E0E8F2', borderRadius: 14 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartTotal: { color: ownerColors.textModern, fontSize: 19, fontWeight: '800' },
  chartCaption: { color: ownerColors.mutedModern, fontSize: 12, marginTop: 3 },
  chart: { height: 125, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8 },
  barSlot: { flex: 1, height: 115, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: '68%', maxWidth: 26, minHeight: 18, borderRadius: 5, backgroundColor: '#B8D4FA' },
  barActive: { backgroundColor: ownerColors.modernPrimary },
  day: { color: ownerColors.mutedModern, fontSize: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, backgroundColor: '#F2F7FF', paddingHorizontal: 3 },
  actionIcon: { color: ownerColors.modernPrimary, fontSize: 21, fontWeight: '700' },
  actionLabel: { color: ownerColors.textModern, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.75 },
  aiCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, backgroundColor: ownerColors.aiModernSoft, padding: 14 },
  aiIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E1DCFF' },
  aiIconText: { color: '#6138B2', fontSize: 20 },
  aiCopy: { flex: 1, gap: 3 },
  aiTitle: { color: ownerColors.textModern, fontSize: 14, fontWeight: '700' },
  aiBody: { color: ownerColors.mutedModern, fontSize: 12, lineHeight: 17 },
  aiLink: { color: '#6138B2', fontSize: 12, fontWeight: '700' },
});
