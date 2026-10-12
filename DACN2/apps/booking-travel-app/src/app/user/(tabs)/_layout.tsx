import { Tabs } from 'expo-router';

import { TravelerTabIcon } from '@/features/traveler/ui';
import { colors, font } from '@/features/traveler/theme';

export default function UserTabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 }, tabBarStyle: { height: 74, paddingTop: 10, paddingBottom: 10, borderTopColor: '#F0F2F5', backgroundColor: colors.white } }}>
    <Tabs.Screen name="index" options={{ title: 'Trang chủ', tabBarIcon: ({ focused }) => <TravelerTabIcon focused={focused} name="home" /> }} />
    <Tabs.Screen name="search" options={{ title: 'Tìm kiếm', tabBarIcon: ({ focused }) => <TravelerTabIcon focused={focused} name="search" /> }} />
    <Tabs.Screen name="bookings" options={{ title: 'Đặt phòng', tabBarIcon: ({ focused }) => <TravelerTabIcon focused={focused} name="bookings" /> }} />
    <Tabs.Screen name="messages" options={{ title: 'Tin nhắn', tabBarIcon: ({ focused }) => <TravelerTabIcon focused={focused} name="messages" /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Tài khoản', tabBarIcon: ({ focused }) => <TravelerTabIcon focused={focused} name="profile" /> }} />
  </Tabs>;
}
