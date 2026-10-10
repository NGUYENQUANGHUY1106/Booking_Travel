import { Href, Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Booking Travel</Text>
      <Text>Project skeleton is ready.</Text>
      <Link href={'/hotel-owner' as Href} style={styles.ownerLink}>Mở giao diện Chủ khách sạn</Link>
      <Link href={'/address-demo' as Href} style={styles.link}>Mở biểu mẫu địa chỉ</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: 8,
    fontSize: 24,
    fontWeight: '600',
  },
  link: {
    marginTop: 20,
    color: '#175CD3',
    fontWeight: '600',
  },
  ownerLink: {
    marginTop: 24,
    color: '#175ED6',
    fontWeight: '700',
  },
});
