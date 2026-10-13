import { router, type Href } from 'expo-router';
import { ImageBackground, Pressable, ScrollView, View } from 'react-native';

import { DESTINATIONS, HOTELS, dateLabel } from './data';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, FigmaIcon, HotelCard, SectionTitle, T, TravelerScaffold, go } from './ui';

const notificationIcon = require('./assets/308c8.svg');
const locationIcon = require('./assets/c9f3a.svg');
const destinationIcon = require('./assets/2241d.svg');
const aiIcon = require('./assets/fb574.svg');

export function HomeScreen() {
  const profile = useTravelerStore((state) => state.profile);
  const destination = useTravelerStore((state) => state.destination);
  const checkIn = useTravelerStore((state) => state.checkIn);
  const checkOut = useTravelerStore((state) => state.checkOut);
  const adults = useTravelerStore((state) => state.adults);
  const rooms = useTravelerStore((state) => state.rooms);
  const setSearch = useTravelerStore((state) => state.setSearch);
  const firstName = profile.name.split(' ').at(-1) ?? 'bạn';

  return <TravelerScaffold background={colors.white}>
    <View style={{ gap: 6, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}><T weight="semibold" style={{ color: colors.primaryDark, fontSize: 11 }}>CHÀO BUỔI SÁNG, {firstName.toUpperCase()}</T><T weight="bold" style={{ color: colors.navy, fontSize: 26, lineHeight: 36 }}>Đi đâu lần này?</T></View>
        <Pressable accessibilityLabel="Thông báo" onPress={() => go('notifications')} style={{ backgroundColor: '#F3F8FD', borderRadius: 28, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><FigmaIcon source={notificationIcon} /></Pressable>
        <Pressable accessibilityLabel="Tài khoản" onPress={() => router.push('/user/profile' as Href)} style={{ marginLeft: 8, backgroundColor: colors.primaryDark, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><T weight="bold" style={{ color: colors.white }}>M</T></Pressable>
      </View>
      <Pressable onPress={() => go('destination')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><FigmaIcon source={locationIcon} size={16} /><T style={{ color: colors.muted, fontSize: 13 }}>{destination}, Việt Nam</T></Pressable>
    </View>

    <Card style={{ borderWidth: 1, borderColor: '#DAE4F2', borderRadius: 20, padding: 16, gap: 12, elevation: 2 }}>
      <Pressable onPress={() => go('destination')}><T style={{ color: colors.muted, fontSize: 11 }}>ĐỊA ĐIỂM</T><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><FigmaIcon source={destinationIcon} size={20} /><T weight="semibold" style={{ fontSize: 16 }}>{destination}</T></View></Pressable>
      <View style={{ height: 1, backgroundColor: colors.line }} />
      <View style={{ flexDirection: 'row' }}>
        <Pressable onPress={() => go('dates')} style={{ flex: 1 }}><T style={{ color: colors.muted, fontSize: 11 }}>NHẬN · TRẢ PHÒNG</T><T weight="semibold" style={{ fontSize: 14 }}>{dateLabel(checkIn)}–{dateLabel(checkOut)}</T></Pressable>
        <Pressable onPress={() => go('guests')} style={{ flex: 1 }}><T style={{ color: colors.muted, fontSize: 11 }}>KHÁCH & PHÒNG</T><T weight="semibold" style={{ fontSize: 14 }}>{adults} khách · {rooms} phòng</T></Pressable>
      </View>
      <Button label="Tìm khách sạn" onPress={() => go('results')} />
    </Card>

    <Card style={{ backgroundColor: '#F0EEFF', borderRadius: 20, padding: 16, gap: 10, marginTop: 8 }} onPress={() => go('ai-home')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E0D8FF', alignItems: 'center', justifyContent: 'center' }}><FigmaIcon source={aiIcon} size={20} /></View><View><T weight="semibold" style={{ color: colors.navy, fontSize: 16 }}>Tìm nơi ở theo cách của bạn</T><T style={{ color: colors.muted, fontSize: 12 }}>Gợi ý theo sở thích và ngân sách</T></View></View>
      <Pressable onPress={() => go('ai-search')} style={{ backgroundColor: colors.white, borderRadius: 12, padding: 12 }}><T style={{ color: colors.muted, fontSize: 13 }}>Bạn muốn ở đâu và như thế nào?</T></Pressable>
      <View style={{ flexDirection: 'row', gap: 6 }}>{['Gần biển', 'Dưới 2 triệu', 'Có hồ bơi'].map((item) => <Pressable key={item} onPress={() => { setSearch({ destination: 'Đà Nẵng' }); go('ai-search', { prompt: item }); }} style={{ backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 }}><T style={{ color: '#4D3D8C', fontSize: 11 }}>{item}</T></Pressable>)}</View>
    </Card>

    <SectionTitle title="Điểm đến nổi bật" action="Xem tất cả" onPress={() => go('popular-destinations')} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>{DESTINATIONS.map((item) => <Pressable key={item.name} onPress={() => { setSearch({ destination: item.name }); go('results'); }} style={{ width: 172, height: 208, borderRadius: 16, overflow: 'hidden' }}><ImageBackground source={item.image} resizeMode="cover" style={{ flex: 1, justifyContent: 'flex-end' }}><View style={{ backgroundColor: 'rgba(5,15,31,0.65)', paddingHorizontal: 12, paddingVertical: 10 }}><T weight="bold" style={{ color: colors.white, fontSize: 18 }}>{item.name}</T><T style={{ color: colors.white, fontSize: 11 }}>{item.detail}</T></View></ImageBackground></Pressable>)}</ScrollView>

    <SectionTitle title="Dành cho bạn" action="Xem thêm" onPress={() => go('results')} />
    {HOTELS.slice(0, 2).map((hotel) => <HotelCard hotel={hotel} key={hotel.id} showActions />)}
    <SectionTitle title="Ưu đãi cuối tuần" /><T style={{ color: colors.muted, marginTop: -12 }}>Tiết kiệm cho chuyến đi sắp tới.</T>
    <SectionTitle title="Gần bạn" action="Xem tất cả" onPress={() => go('nearby')} /><T style={{ color: colors.muted, marginTop: -12 }}>Ở gần bãi biển Mỹ Khê.</T>
    <SectionTitle title="Đã xem gần đây" action="Xem tất cả" onPress={() => go('recent')} /><T style={{ color: colors.muted, marginTop: -12 }}>Blue Horizon My Khe Hotel · An Thu Riverside Boutique</T>
  </TravelerScaffold>;
}
