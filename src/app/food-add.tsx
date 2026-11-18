import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FoodRow } from '@/components/food-row';
import { SavedMealRow } from '@/components/saved-meal-row';
import { Chip, Empty, text } from '@/components/ui';
import { dayKey } from '@/lib/calendar';
import { confirm } from '@/lib/dialog';
import {
  allFoodItems,
  deleteSavedMeal,
  favoriteRefs,
  logFood,
  logSavedMeal,
  recentRefs,
  savedMeals,
  saveProduct,
  thumbsFor,
} from '@/lib/food-db';
import { amountLabel, searchFoods, type FoodItem } from '@/lib/foods';
import { playFoodAdded } from '@/lib/food-sounds';
import { haptic } from '@/lib/haptics';
import { isBarcode, lookupBarcode, OffError, searchProducts, type OffProduct } from '@/lib/off';
import { MEALS, mealForTime, mealLabel, type Meal } from '@/lib/recipes';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type Filter = 'all' | 'favorites' | 'recipes' | 'foods' | 'mine';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: '★ Favourites' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'foods', label: 'Foods' },
  { key: 'mine', label: 'My foods' },
];

function matchesFilter(f: FoodItem, filter: Filter, favs?: Set<string>) {
  if (filter === 'favorites') return !!favs?.has(f.ref);
  if (filter === 'recipes') return !!f.recipe;
  if (filter === 'foods') return !f.recipe;
  if (filter === 'mine') return f.source === 'custom' || f.source === 'my-recipe' || f.source === 'product';
  return true;
}

export default function AddFoodScreen() {
  const params = useLocalSearchParams<{ meal?: string; day?: string }>();
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const day = params.day || dayKey(Date.now());
  const [meal, setMeal] = useState<Meal>((params.meal as Meal) || mealForTime());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [online, setOnline] = useState<{ q: string; items: OffProduct[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, reload] = useFocusData(async (d) => {
    const [items, recent, favs, meals] = await Promise.all([
      allFoodItems(d),
      recentRefs(d, meal),
      favoriteRefs(d),
      savedMeals(d, meal),
    ]);
    const thumbs = await thumbsFor(
      d,
      meals.flatMap((m) => m.items.slice(0, 2).map((i) => i.ref)),
    );
    return { items, recent, favs, meals, thumbs };
  }, meal);
  const items = data?.items ?? [];
  const favs = useMemo(() => new Set(data?.favs ?? []), [data?.favs]);

  const results = useMemo(() => {
    const pool = items.filter((f) => matchesFilter(f, filter, favs));
    if (query.trim()) return searchFoods(query, pool).slice(0, 40);
    return [];
  }, [items, query, filter, favs]);

  const recent = useMemo(() => {
    const map = new Map(items.map((f) => [f.ref, f]));
    return (data?.recent ?? [])
      .map((r) => map.get(r))
      .filter((f): f is FoodItem => !!f && filter !== 'favorites' && matchesFilter(f, filter));
  }, [items, data?.recent, filter]);

  const favorites = useMemo(() => {
    const map = new Map(items.map((f) => [f.ref, f]));
    return (data?.favs ?? [])
      .map((r) => map.get(r))
      .filter((f): f is FoodItem => !!f && (filter === 'favorites' || matchesFilter(f, filter)));
  }, [items, data?.favs, filter]);

  const suggested = useMemo(
    () => (filter === 'favorites' ? [] : items.filter((f) => f.recipe?.meal === meal && matchesFilter(f, filter))),
    [items, meal, filter],
  );

  const open = (ref: string) => router.push({ pathname: '/food/[ref]', params: { ref, meal, day } });

  const quickAdd = async (f: FoodItem) => {
    const s = f.servings[0] ?? null;
    const g = s?.g ?? 100;
    await logFood(db, { day, meal, item: f, grams: g, amount: amountLabel(s, 1, g) });
    haptic.tap();
    playFoodAdded(db, day, ((f.per100.protein ?? 0) * g) / 100);
  };

  const addSaved = async (id: number) => {
    await logSavedMeal(db, id, day, meal);
    haptic.success();
    playFoodAdded(db, day, data?.meals.find((m) => m.id === id)?.total.protein ?? 0);
  };

  const forgetSaved = async (id: number, name: string) => {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: 'It disappears from your saved meals. Days you already logged stay as they are.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteSavedMeal(db, id);
    reload();
  };

  const searchOnline = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isBarcode(q)) {
        const p = await lookupBarcode(q);
        if (!p) {
          setError(`No product with barcode ${q} on Open Food Facts. You can add it yourself.`);
          setOnline({ q, items: [] });
        } else {
          open(await saveProduct(db, p));
        }
      } else {
        setOnline({ q, items: await searchProducts(q) });
      }
    } catch (e) {
      setError(e instanceof OffError ? e.message : 'Search failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickOnline = async (p: OffProduct) => {
    const ref = await saveProduct(db, p);
    reload();
    open(ref);
  };

  const list = (title: string, list: FoodItem[]) =>
    list.length ? (
      <View style={{ gap: 2 }}>
        <Text style={[text.label, styles.listTitle]}>{title}</Text>
        {list.map((f) => (
          <FoodRow key={f.ref} item={f} onPress={() => open(f.ref)} onQuickAdd={() => quickAdd(f)} />
        ))}
      </View>
    ) : null;

  const showOnline = online && online.q === query.trim();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: `Add to ${mealLabel(meal)}` }} />
      <View style={[styles.top, desktop && styles.wide]}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={15} color={C.textFaint} />
            <TextInput
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setError(null);
              }}
              onSubmitEditing={() =>
                isBarcode(query) || (results.length === 0 && query.trim()) ? searchOnline() : null
              }
              placeholder="Search food, recipe or barcode"
              placeholderTextColor={C.textFaint}
              autoFocus={desktop}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={C.textFaint} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/food-scan', params: { meal, day } })}
            accessibilityRole="button"
            accessibilityLabel="Scan barcode"
            style={({ pressed }) => [styles.scan, pressed && { opacity: 0.7 }]}>
            <Ionicons name="barcode-outline" size={20} color={C.onAccent} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {MEALS.map((m) => (
            <Chip key={m.key} label={m.label} active={meal === m.key} onPress={() => setMeal(m.key)} />
          ))}
          <View style={styles.divider} />
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.list, desktop && styles.wide]}>
        {query.trim() ? (
          <>
            {list(`${results.length} ${results.length === 1 ? 'result' : 'results'}`, results)}
            {!results.length && !showOnline ? (
              <Empty
                icon="search-outline"
                title={`Nothing for "${query.trim()}" yet`}
                hint="Search supermarket products below."
              />
            ) : null}

            {showOnline ? (
              <View style={{ gap: 2, marginTop: S.md }}>
                <Text style={[text.label, styles.listTitle]}>Open Food Facts</Text>
                {online.items.length ? (
                  online.items.map((p) => (
                    <Pressable
                      key={p.barcode}
                      onPress={() => pickOnline(p)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.offRow, pressed && { backgroundColor: C.cardHi }]}>
                      <View style={styles.offIcon}>
                        <Ionicons name="barcode-outline" size={15} color={C.textDim} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.offName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={text.faint} numberOfLines={1}>
                          {[p.brand, `${Math.round(p.per100.kcal ?? 0)} kcal / 100 g`].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
                    </Pressable>
                  ))
                ) : error ? null : (
                  <Text style={[text.faint, { padding: S.sm }]}>No products found.</Text>
                )}
              </View>
            ) : (
              <Pressable
                onPress={searchOnline}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [styles.onlineButton, pressed && { opacity: 0.7 }]}>
                {busy ? (
                  <ActivityIndicator color={C.accent} size="small" />
                ) : (
                  <Ionicons name={isBarcode(query) ? 'barcode-outline' : 'globe-outline'} size={16} color={C.accent} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.onlineLabel}>
                    {isBarcode(query)
                      ? `Look up barcode ${query.trim()}`
                      : `Search supermarket products for "${query.trim()}"`}
                  </Text>
                  <Text style={text.faint}>Open Food Facts · free, millions of products</Text>
                </View>
              </Pressable>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        ) : (
          <>
            {data?.meals.length && (filter === 'all' || filter === 'favorites') ? (
              <View style={{ gap: 2 }}>
                <Text style={[text.label, styles.listTitle]}>Your meals · one tap adds everything</Text>
                {data.meals.map((m) => (
                  <SavedMealRow
                    key={m.id}
                    meal={m}
                    thumbs={data.thumbs}
                    onAdd={() => addSaved(m.id)}
                    onDelete={() => forgetSaved(m.id, m.name)}
                  />
                ))}
              </View>
            ) : null}
            {list('Favourites', favorites)}
            {list('Recent', recent.slice(0, 8))}
            {list(`Recipes for ${mealLabel(meal).toLowerCase()}`, suggested)}
            {filter === 'mine' && !recent.length && !suggested.length ? (
              <Empty icon="person-outline" title="Nothing of your own yet" hint="Create a food or recipe below." />
            ) : null}
            {filter === 'favorites' && !favorites.length && !data?.meals.length ? (
              <Empty
                icon="star-outline"
                title="No favourites yet"
                hint="Tap the star on any food or recipe. On the Food tab, the bookmark next to a meal saves it for one-tap adding."
              />
            ) : null}
          </>
        )}

        <View style={styles.create}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/food-new',
                params: { meal, day, ...(isBarcode(query) ? { barcode: query.trim() } : { name: query.trim() }) },
              })
            }
            accessibilityRole="button"
            style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.7 }]}>
            <Ionicons name="create-outline" size={18} color={C.accent} />
            <Text style={styles.createLabel}>Create food</Text>
            <Text style={text.faint}>Type in the label</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/recipe-new', params: { meal, day } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.7 }]}>
            <Ionicons name="restaurant-outline" size={18} color={C.accent} />
            <Text style={styles.createLabel}>Create recipe</Text>
            <Text style={text.faint}>Nutrition calculated</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: S.lg, paddingTop: S.sm, gap: 2 },
  wide: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  searchRow: { flexDirection: 'row', gap: S.sm },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingHorizontal: S.md,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontFamily: F.regular, paddingVertical: 0, minWidth: 0 },
  scan: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: 6, paddingVertical: S.sm, alignItems: 'center' },
  divider: { width: 1, height: 16, backgroundColor: C.border, marginHorizontal: 4 },
  list: { paddingHorizontal: S.sm, paddingBottom: 40, gap: S.md },
  listTitle: { paddingHorizontal: S.sm, paddingTop: S.sm, paddingBottom: 4 },
  offRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: 8,
    paddingHorizontal: S.sm,
    borderRadius: R.md,
  },
  offIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offName: { color: C.text, fontFamily: F.medium, fontSize: 14 },
  onlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    marginHorizontal: S.sm,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
  },
  onlineLabel: { color: C.text, fontFamily: F.semi, fontSize: 13 },
  error: { color: C.gold, fontFamily: F.medium, fontSize: 12, paddingHorizontal: S.sm },
  create: { flexDirection: 'row', gap: S.sm, marginHorizontal: S.sm, marginTop: S.md },
  createButton: {
    flex: 1,
    gap: 3,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.borderHi,
  },
  createLabel: { color: C.text, fontFamily: F.semi, fontSize: 13, marginTop: 4 },
});
