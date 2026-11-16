import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Counts a number up from 0 when it first appears. */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  duration = 900,
  delay = 0,
  style,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
  style?: StyleProp<TextStyle>;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const k = Math.min(1, (now - start) / duration);
      setShown(value * (1 - Math.pow(1 - k, 3))); // ease out
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => (frame = requestAnimationFrame(tick)), delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, duration, delay, reduced]);

  return <Text style={style}>{format(shown)}</Text>;
}
