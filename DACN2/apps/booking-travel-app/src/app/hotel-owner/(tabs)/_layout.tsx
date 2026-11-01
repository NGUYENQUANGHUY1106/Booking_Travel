import { Tabs } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTravelerStore } from '@/features/traveler/store';
import { DashboardSheet } from '@/features/hotel-owner/dashboard/DashboardFilters';
import { dashboardStyles } from '@/features/hotel-owner/dashboard/styles';
import { OWNER_FONT } from '@/features/hotel-owner/styles/tokens';

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
  const insets = useSafeAreaInsets();
  const session = useTravelerStore((state) => state.session);
  const [unavailable, setUnavailable] = useState(false);
  const listeners = {
    tabPress: (event: { preventDefault: () => void }) => {
      if (session?.mode === 'api') {
        event.preventDefault();
        setUnavailable(true);
      }
    },
  };
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#175ED6',
          tabBarInactiveTintColor: '#57667A',
          tabBarLabelStyle: {
            fontSize: 11,
            lineHeight: 16,
            fontFamily: OWNER_FONT.medium,
          },
          tabBarItemStyle: { minWidth: 0, maxWidth: 104, flex: 1 },
          tabBarStyle: {
            ...tabBarStyle,
            height: 74 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
          },
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Tổng quan',
            tabBarIcon: ({ focused }) => (
              <OwnerTabIcon focused={focused} name="dashboard" />
            ),
          }}
        />
        <Tabs.Screen
          name="hotels"
          listeners={listeners}
          options={{
            title: 'Khách sạn',
            tabBarIcon: ({ focused }) => (
              <OwnerTabIcon focused={focused} name="hotel" />
            ),
          }}
        />
        <Tabs.Screen
          name="bookings"
          listeners={listeners}
          options={{
            title: 'Đặt phòng',
            tabBarIcon: ({ focused }) => (
              <OwnerTabIcon focused={focused} name="booking" />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          listeners={listeners}
          options={{
            title: 'Tin nhắn',
            tabBarIcon: ({ focused }) => (
              <OwnerTabIcon focused={focused} name="message" />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Tài khoản',
            tabBarIcon: ({ focused }) => (
              <OwnerTabIcon focused={focused} name="account" />
            ),
          }}
        />
        <Tabs.Screen name="availability" options={{ href: null }} />
        <Tabs.Screen name="pricing" options={{ href: null }} />
      </Tabs>
      {unavailable ? (
        <DashboardSheet
          title="Chức năng chưa khả dụng"
          close={() => setUnavailable(false)}
        >
          <Text style={dashboardStyles.body}>
            Chức năng này chưa sẵn sàng cho dữ liệu khách sạn của bạn.
          </Text>
        </DashboardSheet>
      ) : null}
    </>
  );
}
