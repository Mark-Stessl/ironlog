import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { C, F, useIsDesktop } from '@/lib/theme';

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
          : { backgroundColor: C.bg, borderTopColor: C.border, borderTopWidth: 1, height: 58, paddingTop: 4 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textFaint,
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: 10 },
        tabBarIconStyle: { marginBottom: -2 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color }) => <Ionicons name="barbell-outline" size={20} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={20} color={color as string} />,
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
