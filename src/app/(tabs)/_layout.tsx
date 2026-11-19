import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';

import { C, F, useIsDesktop } from '@/lib/theme';

/** Room under the tab bar for the home-screen swipe bar. */
const HOME_BAR = 22;

export default function TabsLayout() {
  // On desktop the sidebar (root layout) replaces the bottom tab bar.
  const desktop = useIsDesktop();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: desktop
          ? { display: 'none' }
          : {
              backgroundColor: C.bg,
              borderTopColor: C.border,
              borderTopWidth: 1,
              paddingTop: 4,
              // Web app on the phone: keep the tabs clear of the iPhone's swipe-home bar.
              ...(Platform.OS === 'web' ? { height: 58 + HOME_BAR, paddingBottom: HOME_BAR } : { height: 58 }),
            },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textFaint,
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: 10 },
        tabBarIconStyle: { marginBottom: -2 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={19} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color }) => <Ionicons name="barbell-outline" size={20} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food',
          tabBarIcon: ({ color }) => <Ionicons name="nutrition-outline" size={20} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={21} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
