import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { C } from '@/lib/theme';

const COLORS = [C.accent, C.gold, C.good, '#FFFFFF', '#A78BFA', C.gold];
const DURATION = 1700;

type Particle = { dx: number; dy: number; spin: number; size: number; color: string; round: boolean };

function makeParticles(count: number, spread: number): Particle[] {
  return Array.from({ length: count }, () => ({
    dx: (Math.random() - 0.5) * spread,
    dy: -(160 + Math.random() * 420),
    spin: (Math.random() - 0.5) * 900,
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    round: Math.random() < 0.35,
  }));
}

/**
 * A one-off confetti burst from a point (default: upper middle of the screen).
 * Draws nothing when the device asks for reduced motion.
 */
export function Confetti({
  count = 44,
  originTop = '30%',
  spread = 620,
}: {
  count?: number;
  originTop?: `${number}%` | number;
  spread?: number;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const particles = useMemo(() => makeParticles(count, spread), [count, spread]);

  useEffect(() => {
    t.value = withTiming(1, { duration: DURATION, easing: Easing.linear });
  }, [t]);

  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Piece key={i} p={p} t={t} top={originTop} />
      ))}
    </View>
  );
}

function Piece({ p, t, top }: { p: Particle; t: SharedValue<number>; top: `${number}%` | number }) {
  const style = useAnimatedStyle(() => {
    const k = t.value;
    return {
      opacity: k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3,
      transform: [
        { translateX: p.dx * k },
        { translateY: p.dy * k + 820 * k * k }, // thrown up, then gravity pulls it down
        { rotate: `${p.spin * k}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: '50%',
          top,
          width: p.size,
          height: p.round ? p.size : p.size * 0.45,
          borderRadius: p.round ? p.size / 2 : 1.5,
          backgroundColor: p.color,
          marginLeft: -p.size / 2,
        },
        style,
      ]}
    />
  );
}
