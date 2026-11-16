import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';

import { Elapsed } from '@/components/elapsed';
import type { IconName } from '@/components/ui';
import { getActiveWorkout, type Workout } from '@/lib/db';
import { REPDB_URL } from '@/lib/exercise-media';
import { C, F, R, S } from '@/lib/theme';

type PressState = PressableStateCallbackType & { hovered?: boolean };

const NAV: { label: string; icon: IconName; href: '/' | '/history' | '/exercises'; match: (p: string) => boolean }[] = [
  { label: 'Workout', icon: 'barbell-outline', href: '/', match: (p) => p === '/' || p.startsWith('/workout') || p.startsWith('/routine') },
  { label: 'History', icon: 'time-outline', href: '/history', match: (p) => p.startsWith('/history') },
  { label: 'Exercises', icon: 'search-outline', href: '/exercises', match: (p) => p.startsWith('/exercise') },
];

/** Desktop navigation, like Nightshelf's sidebar and Hevy's web app. */
export function Sidebar() {
  const db = useSQLiteContext();
  const pathname = usePathname();
  const [active, setActive] = useState<Workout | null>(null);

  // Re-check for a running workout whenever the page changes.
  useEffect(() => {
    getActiveWorkout(db).then(setActive);
  }, [db, pathname]);

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <View style={styles.markBar} />
          <View style={[styles.markBar, { height: 14 }]} />
          <View style={styles.markBar} />
        </View>
        <Text style={styles.brandName}>Ironlog</Text>
      </View>

      <View style={{ gap: 2 }}>
        {NAV.map((item) => {
          const on = item.match(pathname);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.navigate(item.href)}
              accessibilityRole="link"
              style={(s: PressState) => [
                styles.navItem,
                s.hovered && !on && { backgroundColor: C.card },
                on && styles.navItemOn,
              ]}>
              <Ionicons name={item.icon} size={18} color={on ? C.accent : C.textDim} />
              <Text style={[styles.navLabel, on && { color: C.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 'auto', gap: S.md }}>
        {active ? (
          <Pressable
            onPress={() => router.navigate({ pathname: '/workout/[id]', params: { id: String(active.id) } })}
            style={(s: PressState) => [styles.live, s.hovered && { borderColor: C.good }]}>
            <View style={styles.liveDot} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.liveLabel} numberOfLines={1}>
                {active.name}
              </Text>
              <Elapsed since={active.started_at} style={styles.liveTime} />
            </View>
          </Pressable>
        ) : null}
        <Pressable onPress={() => Linking.openURL(REPDB_URL)}>
          <Text style={styles.credit}>Exercise data by RepDB</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    paddingVertical: S.xl,
    paddingHorizontal: S.md,
    borderRightWidth: 1,
    borderRightColor: C.border,
    gap: 28,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: S.sm },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  markBar: { width: 3, height: 9, borderRadius: 2, backgroundColor: C.accent },
  brandName: { fontFamily: F.display, fontSize: 18, color: C.text, letterSpacing: -0.4 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: R.md,
  },
  navItemOn: { backgroundColor: C.accentDim },
  navLabel: { fontFamily: F.medium, fontSize: 14, color: C.textDim },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.goodDim,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.good },
  liveLabel: { fontFamily: F.medium, fontSize: 13, color: C.text },
  liveTime: { fontFamily: F.regular, fontSize: 12, color: C.textDim, fontVariant: ['tabular-nums'] },
  credit: { fontFamily: F.regular, fontSize: 11, color: C.textFaint, paddingHorizontal: S.sm },
});
