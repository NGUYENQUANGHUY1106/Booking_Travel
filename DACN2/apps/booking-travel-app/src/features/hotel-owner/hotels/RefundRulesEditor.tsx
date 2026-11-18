import { Pressable, Text, TextInput, View } from 'react-native';
import type { RefundRule } from './api';

export function validRefundRules(rules: RefundRule[]) {
  if (!rules.length) return true;
  if (rules.length > 10 || !rules.some((rule) => rule.minimumHoursBeforeCheckIn === 0)) return false;
  const sorted = [...rules].sort((a, b) => a.minimumHoursBeforeCheckIn - b.minimumHoursBeforeCheckIn);
  return sorted.every((rule, index) => Number.isInteger(rule.minimumHoursBeforeCheckIn) && rule.minimumHoursBeforeCheckIn >= 0 && rule.minimumHoursBeforeCheckIn <= 8760 && Number.isInteger(rule.refundPercent) && rule.refundPercent >= 0 && rule.refundPercent <= 100 && (index === 0 || (rule.minimumHoursBeforeCheckIn > sorted[index - 1].minimumHoursBeforeCheckIn && rule.refundPercent >= sorted[index - 1].refundPercent)));
}

export function RefundRulesEditor({ rules, onChange, disabled = false }: { rules: RefundRule[]; onChange: (rules: RefundRule[]) => void; disabled?: boolean }) {
  const update = (index: number, key: keyof RefundRule, text: string) => onChange(rules.map((rule, item) => item === index ? { ...rule, [key]: text.trim() === '' ? -1 : Number(text) } : rule));
  return <View style={{ gap: 10 }}>
    <Text style={{ fontSize: 15, fontWeight: '700' }}>Quy tắc hoàn tiền theo giờ trước nhận phòng</Text>
    <Text>Thêm mốc 0 giờ. Các mốc sớm hơn phải có tỷ lệ hoàn bằng hoặc cao hơn. Quy tắc này chỉ áp dụng cho booking tạo sau khi lưu.</Text>
    {rules.map((rule, index) => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <TextInput accessibilityLabel={`Số giờ trước nhận phòng của quy tắc ${index + 1}`} keyboardType="numeric" editable={!disabled} value={rule.minimumHoursBeforeCheckIn < 0 ? '' : String(rule.minimumHoursBeforeCheckIn)} onChangeText={(text) => update(index, 'minimumHoursBeforeCheckIn', text)} placeholder="Giờ" style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, minWidth: 75 }} />
      <Text>giờ trước · hoàn</Text>
      <TextInput accessibilityLabel={`Phần trăm hoàn của quy tắc ${index + 1}`} keyboardType="numeric" editable={!disabled} value={rule.refundPercent < 0 ? '' : String(rule.refundPercent)} onChangeText={(text) => update(index, 'refundPercent', text)} placeholder="%" style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, minWidth: 60 }} />
      <Text>%</Text>
      {!disabled ? <Pressable accessibilityRole="button" onPress={() => onChange(rules.filter((_, item) => item !== index))}><Text style={{ color: '#B91C1C' }}>Xóa</Text></Pressable> : null}
    </View>)}
    {!disabled && rules.length < 10 ? <Pressable accessibilityRole="button" onPress={() => onChange([...rules, { minimumHoursBeforeCheckIn: rules.length ? -1 : 0, refundPercent: -1 }])}><Text style={{ color: '#1D4ED8', fontWeight: '700' }}>+ Thêm mốc hoàn tiền</Text></Pressable> : null}
    {!rules.length ? <Text>Chưa có quy tắc cấu trúc; booking mới sẽ cần đối soát thủ công khi hủy.</Text> : null}
  </View>;
}
