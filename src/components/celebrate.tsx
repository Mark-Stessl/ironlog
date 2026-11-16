import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Confetti } from '@/components/confetti';
import { haptic } from '@/lib/haptics';
import type { PR } from '@/lib/records';
import { C, F, R, S } from '@/lib/theme';

type Celebration = { id: number; exercise: string; pr: PR };

const CelebrateContext = createContext<(exercise: string, pr: PR) => void>(() => {});

/** Call `celebrate(exerciseName, pr)` to show the new-record banner and confetti. */
export function useCelebrate() {
  return useContext(CelebrateContext);
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Celebration | null>(null);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrate = useCallback((exercise: string, pr: PR) => {
    haptic.record();
    if (timer.current) clearTimeout(timer.current);
    setCurrent({ id: nextId.current++, exercise, pr });
    timer.current = setTimeout(() => setCurrent(null), 3400);
  }, []);

  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      {current ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Confetti key={`c${current.id}`} originTop="42%" />
          <Animated.View
            key={`b${current.id}`}
            entering={FadeInUp.springify().damping(14)}
            exiting={FadeOutUp.duration(250)}
            style={[styles.wrap, { top: insets.top + 12 }]}
            pointerEvents="none">
            <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <LinearGradient
                colors={['rgba(233,190,88,0.22)', 'rgba(233,190,88,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View entering={ZoomIn.delay(120).springify().damping(9)} style={styles.trophy}>
                <Ionicons name="trophy" size={18} color="#2A1E05" />
              </Animated.View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.kicker}>New PR · {current.exercise}</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {current.pr.title}
                </Text>
                <Text style={styles.detail} numberOfLines={1}>
                  {current.pr.detail}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </CelebrateContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: S.lg, right: S.lg, alignItems: 'center' },
  banner: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: 14,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: 'rgba(233,190,88,0.55)',
    backgroundColor: '#15130C',
    overflow: 'hidden',
  },
  trophy: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { color: C.gold, fontFamily: F.semi, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { color: C.text, fontFamily: F.display, fontSize: 17, letterSpacing: -0.3, marginTop: 1 },
  detail: { color: C.textDim, fontFamily: F.medium, fontSize: 12, marginTop: 1, fontVariant: ['tabular-nums'] },
});
