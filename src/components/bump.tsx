import { useEffect, useRef, type ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** Gives its content a little bounce whenever `value` goes up. */
export function Bump({ value, children }: { value: number; children: ReactNode }) {
  const scale = useSharedValue(1);
  const last = useRef(value);

  useEffect(() => {
    if (value > last.current) {
      scale.value = withSequence(withTiming(1.18, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 260 }));
    }
    last.current = value;
  }, [value, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[{ alignSelf: 'flex-start', transformOrigin: 'left center' }, style]}>
      {children}
    </Animated.View>
  );
}
