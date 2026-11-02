import { StyleSheet, Text, View } from 'react-native';
import { ownerColors } from '../styles/tokens';

export function HotelPinMap({ latitude, longitude }: { latitude: number | null; longitude: number | null; onChange: (latitude: number, longitude: number) => void }) {
  return <View style={styles.card}><Text style={styles.text}>Bản đồ ghim vị trí khả dụng trên Expo iOS/Android. Trên web, hãy nhập vĩ độ và kinh độ ở trên.</Text>{latitude !== null && longitude !== null ? <Text style={styles.text}>Ghim: {latitude.toFixed(5)}, {longitude.toFixed(5)}</Text> : null}</View>;
}

const styles = StyleSheet.create({ card: { minHeight: 120, backgroundColor: ownerColors.surface, borderRadius: 12, padding: 14, justifyContent: 'center', gap: 8 }, text: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 } });
