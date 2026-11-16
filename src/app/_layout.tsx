import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrate } from '@/lib/db';
import { C } from '@/lib/theme';

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
  return (
    <SQLiteProvider databaseName="ironlog.db" onInit={migrate}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: C.bg },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
          <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
          <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
          <Stack.Screen name="exercise-picker" options={{ title: 'Add Exercise', presentation: 'modal' }} />
          <Stack.Screen name="exercise-new" options={{ title: 'New Exercise', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
