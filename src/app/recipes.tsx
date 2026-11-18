import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { perServing, RecipeCard } from '@/components/recipe-card';
import { SavedMealRow } from '@/components/saved-meal-row';
import { Chip, Empty, Page, SectionTitle, text } from '@/components/ui';
import { dayKey } from '@/lib/calendar';
import { confirm } from '@/lib/dialog';
import { allFoodItems, deleteSavedMeal, favoriteRefs, logSavedMeal, savedMeals, thumbsFor } from '@/lib/food-db';
import { playFoodAdded } from '@/lib/food-sounds';
import { searchFoods, type FoodItem } from '@/lib/foods';
import { haptic } from '@/lib/haptics';
import { MEALS, mealForTime, type Meal } from '@/lib/recipes';
import { C, F, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type Show = 'all' | Meal | 'favorites' | 'mine';
type Sort = 'popular' | 'protein' | 'light' | 'quick';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'popular', label: 'Most used' },
  { key: 'protein', label: 'Most protein' },
  { key: 'light', label: 'Fewest kcal' },
  { key: 'quick', label: 'Quickest' },
];

/** Every recipe as a photo card, plus your saved meals: browse without going through "Add". */
export default function RecipesScreen() {
  const db = useSQLiteContext();
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [sort, setSort] = useState<Sort>('popular');
  const [width, setWidth] = useState(0);
  const today = dayKey(Date.now());

  const [data, reload] = useFocusData(async (d) => {
    const [items, favs, meals] = await Promise.all([allFoodItems(d), favoriteRefs(d), savedMeals(d, mealForTime())]);
    const thumbs = await thumbsFor(
      d,
      meals.flatMap((m) => m.items.slice(0, 2).map((i) => i.ref)),
    );
    return { items, favs: new Set(favs), meals, thumbs };
  });

  const recipes = useMemo(() => {
    if (!data) return [];
    let list = data.items.filter((f) => !!f.recipe);
    if (show === 'favorites')
      list = data.items.filter((f) => data.favs.has(f.ref)); // favourite foods too
    else if (show === 'mine') list = list.filter((f) => f.source === 'my-recipe');
    else if (show !== 'all') list = list.filter((f) => f.recipe?.meal === show);
    if (query.trim()) return searchFoods(query, list);
    const by: Record<Sort, (a: FoodItem, b: FoodItem) => number> = {
      popular: (a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name),
      protein: (a, b) => (perServing(b).protein ?? 0) - (perServing(a).protein ?? 0),
      light: (a, b) => (perServing(a).kcal ?? 0) - (perServing(b).kcal ?? 0),
      quick: (a, b) => (a.recipe?.minutes ?? 999) - (b.recipe?.minutes ?? 999),
    };
    return [...list].sort(by[sort]);
  }, [data, show, sort, query]);

  const cols = width >= 900 ? 4 : width >= 560 ? 3 : 2;
  const gap = S.md;
  const cardW = width ? Math.floor((width - gap * (cols - 1)) / cols) : 0;

  const open = (f: FoodItem) =>
    router.push({ pathname: '/food/[ref]', params: { ref: f.ref, meal: f.recipe?.meal ?? mealForTime(), day: today } });

  const shows: { key: Show; label: string }[] = [
    { key: 'all', label: 'All' },
    ...MEALS.map((m) => ({ key: m.key as Show, label: m.label })),
    { key: 'favorites', label: '★ Favourites' },
    { key: 'mine', label: 'Mine' },
  ];

  return (
    <Page maxWidth={1100}>
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={text.title}>Recipes</Text>
          <Text style={text.dim}>
            {data ? `${data.items.filter((f) => f.recipe).length} recipes · tap one for ingredients and steps` : ' '}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/recipe-new', params: { meal: mealForTime(), day: today } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.create, pressed && { opacity: 0.7 }]}>
          <Ionicons name="add" size={16} color={C.onAccent} />
          <Text style={styles.createText}>New recipe</Text>
        </Pressable>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={15} color={C.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search recipes or ingredients"
          placeholderTextColor={C.textFaint}
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.searchInput}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={C.textFaint} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {shows.map((x) => (
          <Chip key={x.key} label={x.label} active={show === x.key} onPress={() => setShow(x.key)} />
        ))}
      </ScrollView>
      {!query.trim() ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Ionicons name="swap-vertical" size={14} color={C.textFaint} style={{ marginRight: 2 }} />
          {SORTS.map((x) => (
            <Pressable
              key={x.key}
              onPress={() => setSort(x.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === x.key }}
              style={[styles.sort, sort === x.key && styles.sortOn]}>
              <Text style={[styles.sortText, sort === x.key && { color: C.text }]}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {data?.meals.length && show === 'all' && !query.trim() ? (
        <View>
          <SectionTitle title="Your saved meals" />
          <View style={styles.meals}>
            {data.meals.map((m) => (
              <SavedMealRow
                key={m.id}
                meal={m}
                thumbs={data.thumbs}
                onAdd={async () => {
                  await logSavedMeal(db, m.id, today, m.meal);
                  haptic.success();
                  playFoodAdded(db, today, m.total.protein ?? 0);
                }}
                onDelete={async () => {
                  const ok = await confirm({
                    title: `Delete "${m.name}"?`,
                    message: 'It disappears from your saved meals. Days you already logged stay as they are.',
                    confirmLabel: 'Delete',
                    destructive: true,
                  });
                  if (!ok) return;
                  await deleteSavedMeal(db, m.id);
                  reload();
                }}
              />
            ))}
          </View>
          <SectionTitle title="Recipes" />
        </View>
      ) : null}

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {data && !recipes.length ? (
          <Empty
            icon={show === 'favorites' ? 'star-outline' : 'restaurant-outline'}
            title={
              query.trim()
                ? `No recipe with "${query.trim()}"`
                : show === 'favorites'
                  ? 'No favourites yet'
                  : show === 'mine'
                    ? 'No recipes of your own yet'
                    : 'Nothing here'
            }
            hint={
              show === 'favorites'
                ? 'Tap the star on a recipe or food to keep it here.'
                : show === 'mine'
                  ? 'Create one with "New recipe": nutrition is calculated from the ingredients.'
                  : undefined
            }
          />
        ) : null}
        {cardW ? (
          <Animated.View key={`${show}-${sort}`} entering={FadeIn.duration(200)} style={[styles.grid, { gap }]}>
            {recipes.map((f) => (
              <RecipeCard key={f.ref} item={f} width={cardW} favorite={data?.favs.has(f.ref)} onPress={() => open(f)} />
            ))}
          </Animated.View>
        ) : null}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: S.md },
  create: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: S.md,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  createText: { color: C.onAccent, fontFamily: F.semi, fontSize: 13 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 42,
    paddingHorizontal: S.md,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, minWidth: 0, color: C.text, fontFamily: F.regular, fontSize: 14, paddingVertical: 0 },
  chips: { gap: 6, alignItems: 'center' },
  sort: { height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center' },
  sortOn: { backgroundColor: C.cardHi },
  sortText: { color: C.textFaint, fontFamily: F.medium, fontSize: 12 },
  meals: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
