import '@/global.css';
import { DarkTheme, ThemeProvider } from "expo-router";
import { Stack } from "expo-router/stack";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, View } from "react-native";

import { migrate } from "@/lib/db";
import { C } from "@/lib/theme";

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
        <View style={styles.outer}>
          <View style={styles.column}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: C.bg },
                headerTintColor: C.text,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: C.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="workout/[id]"
                options={{ title: "Workout" }}
              />
              <Stack.Screen
                name="routine/[id]"
                options={{ title: "Routine" }}
              />
              <Stack.Screen
                name="exercise/[id]"
                options={{ title: "Exercise" }}
              />
              <Stack.Screen
                name="exercise-picker"
                options={{ title: "Add Exercise", presentation: "modal" }}
              />
              <Stack.Screen
                name="exercise-new"
                options={{ title: "New Exercise", presentation: "modal" }}
              />
            </Stack>
          </View>
        </View>
      </ThemeProvider>
    </SQLiteProvider>
  );
}

// On a laptop the app is shown as a phone-width column in the middle.
const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#07080A" : C.bg,
    alignItems: "center",
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 560 : undefined,
    backgroundColor: C.bg,
  },
});
