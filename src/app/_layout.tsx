import '@/global.css';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { CelebrationProvider } from '@/components/celebrate';
import { DialogHost } from '@/components/dialog-host';
import { Sidebar } from '@/components/sidebar';
import { migrate } from '@/lib/db';
import { C, F, useIsDesktop } from '@/lib/theme';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: C.accent,
    background: C.bg,
    card: C.bg,
    text: C.text,
    border: C.border,
  },
};

export default function RootLayout() {
  const desktop = useIsDesktop();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // Wait for the fonts (fall back to system fonts if they fail to load).
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <SQLiteProvider databaseName="ironlog.db" onInit={migrate}>
      <ThemeProvider value={navTheme}>
        <CelebrationProvider>
          <StatusBar style="light" />
          <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
            {desktop ? <Sidebar /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: C.bg },
                  headerTintColor: C.text,
                  headerTitleStyle: { fontFamily: F.semi, fontSize: 15 },
                  headerShadowVisible: false,
                  headerBackButtonDisplayMode: 'minimal',
                  contentStyle: { backgroundColor: C.bg },
                }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
                <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
                <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
                <Stack.Screen name="exercise-picker" options={{ title: 'Add exercise', presentation: 'modal' }} />
                <Stack.Screen name="exercise-new" options={{ title: 'New exercise', presentation: 'modal' }} />
              </Stack>
            </View>
          </View>
          <DialogHost />
        </CelebrationProvider>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
