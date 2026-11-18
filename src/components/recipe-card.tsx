import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';

import { photoSource } from '@/components/food-thumb';
import { MACRO_COLOR } from '@/components/nutrition-charts';
import { nutrientsFor, type FoodItem } from '@/lib/foods';
import { mealLabel } from '@/lib/recipes';
import { C, F, R, S } from '@/lib/theme';

type PressState = PressableStateCallbackType & { hovered?: boolean };

/** Nutrition for one serving of a recipe (or the first portion of a food). */
export function perServing(item: FoodItem) {
  return nutrientsFor(item, item.servings[0]?.g ?? 100);
}

/** Photo card for the recipe overview and the Food tab's ideas strip. */
export function RecipeCard({
  item,
  width,
  favorite,
  onPress,
}: {
  item: FoodItem;
  width: number;
  favorite?: boolean;
  onPress: () => void;
}) {
  const photo = photoSource(item);
  const n = perServing(item);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${Math.round(n.kcal ?? 0)} kcal`}
      style={(s: PressState) => [
        styles.card,
        { width },
        s.hovered && { borderColor: C.accentLine, transform: [{ translateY: -2 }] },
        s.pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}>
      <View style={styles.photoWrap}>
        {photo ? (
          <Image source={photo} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.noPhoto]}>
            <Text style={{ fontSize: Math.min(56, width / 3.2) }}>{item.emoji ?? '🍽️'}</Text>
          </View>
        )}
        {item.recipe?.minutes ? (
          <View style={styles.time}>
            <Ionicons name="time-outline" size={11} color="#fff" />
            <Text style={styles.timeText}>{item.recipe.minutes} min</Text>
          </View>
        ) : null}
        {favorite ? (
          <View style={styles.fav}>
            <Ionicons name="star" size={12} color={C.gold} />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.recipe ? mealLabel(item.recipe.meal) : item.brand || item.category}
          {item.source === 'my-recipe' ? ' · Mine' : ''}
        </Text>
        <View style={styles.nums}>
          <Text style={styles.kcal}>{Math.round(n.kcal ?? 0)} kcal</Text>
          <View style={styles.protein}>
            <View style={styles.dot} />
            <Text style={styles.proteinText}>{Math.round(n.protein ?? 0)} g protein</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: R.lg,
    overflow: 'hidden',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  photoWrap: { width: '100%', aspectRatio: 4 / 3, backgroundColor: C.cardHi },
  photo: { width: '100%', height: '100%' },
  noPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardHi },
  time: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(6,10,12,0.72)',
  },
  timeText: { color: '#fff', fontFamily: F.medium, fontSize: 11 },
  fav: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,10,12,0.72)',
  },
  body: { padding: S.md, paddingTop: 10, gap: 3 },
  name: { color: C.text, fontFamily: F.semi, fontSize: 14, lineHeight: 18, minHeight: 36 },
  meta: { color: C.textFaint, fontFamily: F.regular, fontSize: 11 },
  nums: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 4 },
  kcal: { color: C.text, fontFamily: F.semi, fontSize: 12, fontVariant: ['tabular-nums'] },
  protein: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MACRO_COLOR.protein },
  proteinText: { color: C.textDim, fontFamily: F.medium, fontSize: 11, fontVariant: ['tabular-nums'] },
});
