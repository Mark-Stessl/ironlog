import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Confetti } from '@/components/confetti';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import type { PR } from '@/lib/records';
import { C, F, R, S } from '@/lib/theme';

type Celebration = { id: number; exercise: string; prs: PR[] };

const CelebrateContext = createContext<(exercise: string, prs: PR[]) => void>(() => {});

/** Call `celebrate(exerciseName, records)` to show the new-record banner and confetti. */
export function useCelebrate() {
  return useContext(CelebrateContext);
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Celebration | null>(null);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrate = useCallback((exercise: string, prs: PR[]) => {
    if (!prs.length) return;
    haptic.record();
    sound.play('record');
    if (timer.current) clearTimeout(timer.current);
    setCurrent({ id: nextId.current++, exercise, prs });
    timer.current = setTimeout(() => setCurrent(null), 3400 + (prs.length - 1) * 600);
  }, []);

  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {current ? <Confetti key={`c${current.id}`} originTop="42%" /> : null}
        {current ? (
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
                <Text style={styles.kicker}>
                  {current.prs.length > 1 ? `${current.prs.length} new records` : 'New PR'} · {current.exercise}
                </Text>
                {current.prs.map((pr, i) => (
                  <Animated.View
                    key={pr.kind}
                    entering={FadeInUp.delay(i * 140).duration(260)}
                    style={i > 0 && styles.more}>
                    <Text style={i === 0 ? styles.title : styles.titleSmall} numberOfLines={1}>
                      {pr.title}
                    </Text>
                    <Text style={styles.detail} numberOfLines={1}>
                      {pr.detail}
                    </Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>
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
  titleSmall: { color: C.text, fontFamily: F.semi, fontSize: 13 },
  more: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(233,190,88,0.18)' },
  detail: { color: C.textDim, fontFamily: F.medium, fontSize: 12, marginTop: 1, fontVariant: ['tabular-nums'] },
});
