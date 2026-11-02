import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';

import { ownerColors } from '../styles/tokens';

export function HotelPinMap({ latitude, longitude, onChange }: { latitude: number | null; longitude: number | null; onChange: (latitude: number, longitude: number) => void }) {
  const map = useRef<MapView>(null);
  const valid = latitude !== null && longitude !== null && latitude >= 7 && latitude <= 24.5 && longitude >= 102 && longitude <= 117.5;
  useEffect(() => {
    if (valid) map.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 350);
  }, [valid, latitude, longitude]);
  const pin = (lat: number, lng: number) => {
    if (lat >= 7 && lat <= 24.5 && lng >= 102 && lng <= 117.5) onChange(Number(lat.toFixed(7)), Number(lng.toFixed(7)));
  };
  return <View style={styles.group}>
    <Text style={styles.label}>Ghim vị trí trên bản đồ</Text>
    <MapView ref={map} style={styles.map} initialRegion={{ latitude: valid ? latitude : 16.0544, longitude: valid ? longitude : 108.2022, latitudeDelta: 0.06, longitudeDelta: 0.06 }} onPress={(event: MapPressEvent) => pin(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)}>
      {valid ? <Marker coordinate={{ latitude, longitude }} draggable onDragEnd={(event) => pin(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)} /> : null}
    </MapView>
    <Text style={styles.hint}>Chạm bản đồ hoặc kéo ghim đến vị trí chính xác của chỗ ở.</Text>
  </View>;
}

const styles = StyleSheet.create({ group: { gap: 8 }, label: { color: ownerColors.text, fontSize: 14, fontWeight: '600' }, map: { width: '100%', height: 220, borderRadius: 12 }, hint: { color: ownerColors.muted, fontSize: 13, lineHeight: 18 } });
