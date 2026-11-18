import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { FoodThumb } from '@/components/food-thumb';
import type { IconName } from '@/components/ui';
import type { FoodItem } from '@/lib/foods';
import { C, F, R, S } from '@/lib/theme';

type PressState = PressableStateCallbackType & { hovered?: boolean };

export const SOURCE: Record<FoodItem['source'], { label: string; icon: IconName }> = {
  bls: { label: 'BLS', icon: 'leaf-outline' },
  product: { label: 'Product', icon: 'barcode-outline' },
  custom: { label: 'My food', icon: 'person-outline' },
  recipe: { label: 'Recipe', icon: 'restaurant-outline' },
  'my-recipe': { label: 'My recipe', icon: 'restaurant-outline' },
};

/** "1 serving · 459 g · 563 kcal" */
export function servingLine(item: FoodItem): string {
  const s = item.servings[0];
  const g = s?.g ?? 100;
  const kcal = Math.round(((item.per100.kcal ?? 0) * g) / 100);
  const parts = [s ? `${s.label}${/\bg\b|\d\s*g/.test(s.label) ? '' : ` (${Math.round(g)} g)`}` : '100 g', `${kcal} kcal`];
  if (item.brand) parts.unshift(item.brand);
  else if (item.altName && item.altName !== item.name) parts.unshift(item.altName);
  return parts.join(' · ');
}

export function FoodRow({
  item,
  onPress,
  onQuickAdd,
}: {
  item: FoodItem;
  onPress: () => void;
  onQuickAdd?: () => Promise<void> | void;
}) {
  const [added, setAdded] = useState(0);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={(s: PressState) => [styles.row, (s.hovered || s.pressed) && { backgroundColor: C.cardHi }]}>
      <FoodThumb item={item} size={44} radius={11} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {item.recipe ? `${item.source === 'my-recipe' ? 'My recipe' : 'Recipe'} · ` : ''}
          {servingLine(item)}
        </Text>
      </View>
      {onQuickAdd ? (
        <Pressable
          onPress={async () => {
            await onQuickAdd();
            setAdded((n) => n + 1);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Quick add ${item.name}`}
          style={({ pressed }) => [styles.quick, added > 0 && styles.quickDone, pressed && { transform: [{ scale: 0.9 }] }]}>
          {added > 0 ? (
            <Animated.View key={added} entering={ZoomIn.springify().damping(10)}>
              <Ionicons name="checkmark" size={16} color={C.onAccent} />
            </Animated.View>
          ) : (
            <Ionicons name="add" size={18} color={C.accent} />
          )}
        </Pressable>
      ) : null}
    </Pressable>
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
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRecipe: { backgroundColor: C.accentDim, borderColor: C.accentLine },
  name: { color: C.text, fontFamily: F.medium, fontSize: 14 },
  sub: { color: C.textFaint, fontFamily: F.regular, fontSize: 12, marginTop: 1 },
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
