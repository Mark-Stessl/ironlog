import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { FoodThumb, type ThumbData } from '@/components/food-thumb';
import type { SavedMeal } from '@/lib/food-db';
import { mealLabel } from '@/lib/recipes';
import { C, F, R, S } from '@/lib/theme';

type PressState = PressableStateCallbackType & { hovered?: boolean };

/** A saved meal ("usual breakfast"): the first foods' pictures, name, totals and a one-tap add. */
export function SavedMealRow({
  meal,
  thumbs,
  onAdd,
  onDelete,
}: {
  meal: SavedMeal;
  thumbs: Map<string, Omit<ThumbData, 'ref'>>;
  onAdd: () => Promise<void> | void;
  onDelete: () => void;
}) {
  const [added, setAdded] = useState(0);
  const shown = meal.items.slice(0, 2);
  return (
    <View style={styles.row}>
      <View style={styles.thumbs}>
        {shown.map((it, i) => (
          <View key={`${it.ref}-${i}`} style={[styles.thumb, i > 0 && styles.thumbBehind]}>
            <FoodThumb
              item={{ ref: it.ref, ...thumbs.get(it.ref) }}
              size={i === 0 ? 44 : 30}
              radius={i === 0 ? 11 : 8}
            />
          </View>
        ))}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {meal.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {mealLabel(meal.meal)} · {meal.items.length} {meal.items.length === 1 ? 'food' : 'foods'} ·{' '}
          {Math.round(meal.total.kcal ?? 0)} kcal
        </Text>
      </View>
      <Pressable
        onPress={onDelete}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Delete saved meal ${meal.name}`}
        style={(s: PressState) => [styles.forget, (s.hovered || s.pressed) && { backgroundColor: C.cardHi }]}>
        <Ionicons name="trash-outline" size={16} color={C.textDim} />
      </Pressable>
      <Pressable
        onPress={async () => {
          await onAdd();
          setAdded((n) => n + 1);
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Add saved meal ${meal.name}`}
        style={({ pressed }) => [
          styles.quick,
          added > 0 && styles.quickDone,
          pressed && { transform: [{ scale: 0.9 }] },
        ]}>
        {added > 0 ? (
          <Animated.View key={added} entering={ZoomIn.springify().damping(10)}>
            <Ionicons name="checkmark" size={16} color={C.onAccent} />
          </Animated.View>
        ) : (
          <Ionicons name="add" size={18} color={C.accent} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: 8,
    paddingHorizontal: S.sm,
    borderRadius: R.md,
  },
  thumbs: { width: 52, height: 44 },
  thumb: { position: 'absolute', left: 0, top: 0 },
  thumbBehind: {
    left: 26,
    top: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.bg,
  },
  name: { color: C.text, fontFamily: F.medium, fontSize: 14 },
  sub: { color: C.textFaint, fontFamily: F.regular, fontSize: 12, marginTop: 1 },
  forget: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  quick: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDone: { backgroundColor: C.accent, borderColor: C.accent },
});
