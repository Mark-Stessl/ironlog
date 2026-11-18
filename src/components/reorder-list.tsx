import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { C, F, R, S } from '@/lib/theme';

export type ReorderItem = { id: number; title: string; subtitle?: string; left?: ReactNode };

const ROW = 60;
const GAP = 6;
const STEP = ROW + GAP;
const SPRING = { damping: 22, stiffness: 260 };

/**
 * A compact list you rearrange by dragging. Rows follow the finger; the others
 * slide out of the way. `onReorder` gets the new order of ids when a row is dropped.
 */
export function ReorderList({ items, onReorder }: { items: ReorderItem[]; onReorder: (ids: number[]) => void }) {
  const [order, setOrder] = useState(() => items.map((i) => i.id));
  // Positions live in a shared value so every row can animate to its slot.
  const positions = useSharedValue<Record<number, number>>(Object.fromEntries(order.map((id, i) => [id, i])));
  const byId = new Map(items.map((i) => [i.id, i]));

  const move = (id: number, to: number) => {
    const from = positions.value[id];
    if (from === to) return;
    const ids = Object.keys(positions.value)
      .map(Number)
      .sort((a, b) => positions.value[a] - positions.value[b]);
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    positions.value = Object.fromEntries(ids.map((x, i) => [x, i]));
    haptic.tap();
  };
  const drop = () => {
    const ids = Object.keys(positions.value)
      .map(Number)
      .sort((a, b) => positions.value[a] - positions.value[b]);
    setOrder(ids);
    onReorder(ids);
  };

  return (
    <View style={{ height: items.length * STEP - GAP }}>
      {order.map((id) => {
        const item = byId.get(id);
        return item ? (
          <Row key={id} item={item} count={items.length} positions={positions} onMove={move} onDrop={drop} />
        ) : null;
      })}
    </View>
  );
}

function Row({
  item,
  count,
  positions,
  onMove,
  onDrop,
}: {
  item: ReorderItem;
  count: number;
  positions: { value: Record<number, number> };
  onMove: (id: number, to: number) => void;
  onDrop: () => void;
}) {
  const dragging = useSharedValue(false);
  const dragY = useSharedValue(0);
  const start = useRef(0);

  const pan = usePanGesture({
    minDistance: 2,
    runOnJS: true,
    onActivate: () => {
      start.current = positions.value[item.id] * STEP;
      dragY.value = start.current;
      dragging.value = true;
      haptic.tap();
    },
    onUpdate: (e) => {
      const y = Math.max(0, Math.min((count - 1) * STEP, start.current + e.translationY));
      dragY.value = y;
      const to = Math.round(y / STEP);
      if (to !== positions.value[item.id]) onMove(item.id, to);
    },
    onDeactivate: () => {
      dragging.value = false;
      onDrop();
    },
  });

  const style = useAnimatedStyle(() => {
    const slot = positions.value[item.id] * STEP;
    return {
      top: dragging.value ? dragY.value : withSpring(slot, SPRING),
      zIndex: dragging.value ? 10 : 1,
      transform: [{ scale: withTiming(dragging.value ? 1.03 : 1, { duration: 120 }) }],
      borderColor: dragging.value ? C.accent : C.border,
      shadowOpacity: withTiming(dragging.value ? 0.35 : 0, { duration: 120 }),
    };
  });

  return (
    <GestureDetector gesture={pan} touchAction="none">
      <Animated.View
        style={[styles.row, style]}
        accessibilityRole="adjustable"
        accessibilityLabel={`${item.title}, drag to move`}>
        {item.left}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons name="reorder-three" size={24} color={C.textDim} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingHorizontal: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    backgroundColor: C.card,
    shadowColor: '#000',
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    userSelect: 'none', // web: no text selection while dragging
  },
  title: { color: C.text, fontFamily: F.semi, fontSize: 14 },
  sub: { color: C.textFaint, fontFamily: F.regular, fontSize: 12, marginTop: 1 },
});
