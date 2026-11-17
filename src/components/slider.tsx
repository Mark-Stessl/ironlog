import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type ViewInstance } from 'react-native';

import { C } from '@/lib/theme';

/** A simple horizontal slider (0..1). Drag or tap anywhere on the track. */
export function Slider({
  value,
  onChange,
  onRelease,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  onRelease?: (v: number) => void;
  label: string;
}) {
  const track = useRef<ViewInstance>(null);
  const box = useRef({ x: 0, width: 1 });
  const last = useRef(value);
  const [dragging, setDragging] = useState(false);

  const update = (pageX: number) => {
    const v = Math.min(1, Math.max(0, (pageX - box.current.x) / box.current.width));
    last.current = v;
    onChange(v);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const pageX = e.nativeEvent.pageX;
        setDragging(true);
        track.current?.measureInWindow((x, _y, width) => {
          box.current = { x, width: Math.max(1, width) };
          update(pageX);
        });
      },
      onPanResponderMove: (e) => update(e.nativeEvent.pageX),
      onPanResponderRelease: () => {
        setDragging(false);
        onRelease?.(last.current);
      },
      onPanResponderTerminate: () => setDragging(false),
    }),
  ).current;

  const step = (delta: number) => {
    const v = Math.min(1, Math.max(0, Math.round((value + delta) * 10) / 10));
    onChange(v);
    onRelease?.(v);
  };

  return (
    <View
      style={styles.hit}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100), text: `${Math.round(value * 100)}%` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)}>
      <View ref={track} style={styles.track}>
        <View style={[styles.fill, { width: `${value * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: `${value * 100}%` }, dragging && styles.thumbActive]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 36, justifyContent: 'center', marginHorizontal: 9 },
  track: { height: 6, borderRadius: 3, backgroundColor: C.cardHi, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: C.accent },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: C.accent,
  },
  thumbActive: { transform: [{ scale: 1.15 }] },
});
