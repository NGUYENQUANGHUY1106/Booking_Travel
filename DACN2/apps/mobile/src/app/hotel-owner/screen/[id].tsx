import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { isOwnerScreenId, OwnerScreenRouter } from '@/features/hotel-owner';

export default function HotelOwnerDynamicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id || !isOwnerScreenId(id)) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Không tìm thấy màn hình Chủ khách sạn.</Text>
      </View>
    );
  }

  return <OwnerScreenRouter id={id} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#111827', fontSize: 18, fontWeight: '700', textAlign: 'center' },
});
