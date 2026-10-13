import { router } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { hotel } from '../mocks';
import { ownerScreenHref } from '../navigation';
import { ownerColors } from '../styles/tokens';

export function HotelCard({ pressable = true }: { pressable?: boolean }) {
  const content = (
    <>
      <View style={styles.imageFrame}>
        <Image
          resizeMode="cover"
          source={require('../assets/hotel-coastal.png')}
          style={styles.image}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{hotel.name}</Text>
        <Text style={styles.muted}>{hotel.address}</Text>
        <Text style={styles.rating}>★ {hotel.rating}</Text>
        <Text style={styles.price}>{hotel.price}</Text>
        <Text style={styles.promo}>Ưu đãi 12% · Miễn phí hủy theo điều kiện</Text>
      </View>
    </>
  );

  if (!pressable) return <View style={styles.card}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(ownerScreenHref('hotel-detail'))}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 1px 6px rgba(0, 0, 0, 0.08)' },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  pressed: { opacity: 0.9 },
  imageFrame: { width: '100%', aspectRatio: 340 / 228, overflow: 'hidden', borderRadius: 14 },
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: undefined, height: undefined },
  body: { padding: 16, gap: 7 },
  name: { color: ownerColors.text, fontSize: 18, fontWeight: '700', lineHeight: 24 },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 19 },
  rating: { color: '#334155', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  price: { color: ownerColors.primaryDark, fontSize: 19, fontWeight: '700', lineHeight: 24 },
  promo: { color: '#C2410C', fontSize: 12, lineHeight: 17 },
});

