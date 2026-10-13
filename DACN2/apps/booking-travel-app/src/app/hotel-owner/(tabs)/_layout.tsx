import { Tabs } from 'expo-router';

import { OwnerTabIcon } from '@/features/hotel-owner';

const tabBarStyle = {
  width: '100%',
  maxWidth: 520,
  alignSelf: 'center',
  height: 70,
  paddingTop: 8,
  paddingBottom: 8,
  borderTopColor: '#F0F2F5',
  backgroundColor: '#FFFFFF',
} as const;

export default function HotelOwnerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#175ED6',
        tabBarInactiveTintColor: '#57667A',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarItemStyle: { minWidth: 0, maxWidth: 104, flex: 1 },
        tabBarStyle,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Tổng quan', tabBarIcon: ({ focused }) => <OwnerTabIcon focused={focused} name="dashboard" /> }} />
      <Tabs.Screen name="hotels" options={{ title: 'Khách sạn', tabBarIcon: ({ focused }) => <OwnerTabIcon focused={focused} name="hotel" /> }} />
      <Tabs.Screen name="bookings" options={{ title: 'Đặt phòng', tabBarIcon: ({ focused }) => <OwnerTabIcon focused={focused} name="booking" /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Tin nhắn', tabBarIcon: ({ focused }) => <OwnerTabIcon focused={focused} name="message" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Tài khoản', tabBarIcon: ({ focused }) => <OwnerTabIcon focused={focused} name="account" /> }} />
      <Tabs.Screen name="availability" options={{ href: null }} />
      <Tabs.Screen name="pricing" options={{ href: null }} />
    </Tabs>
  );
}

