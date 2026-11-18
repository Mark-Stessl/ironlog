import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { FoodRow } from '@/components/food-row';
import { MACRO_COLOR } from '@/components/nutrition-charts';
import { Button, Card, Chip, IconButton, Page, SectionTitle, text } from '@/components/ui';
import { notify } from '@/lib/dialog';
import { allFoodItems, createRecipe, saveProduct } from '@/lib/food-db';
import { searchFoods, totalOf, type FoodItem } from '@/lib/foods';
import { parseNum } from '@/lib/format';
import { fmtNutrient, scale } from '@/lib/nutrition';
import { OffError, searchProducts, type OffProduct } from '@/lib/off';
import { MEALS, mealForTime, type Meal } from '@/lib/recipes';
import { C, F, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type Part = { item: FoodItem; g: string };

export default function NewRecipeScreen() {
  const params = useLocalSearchParams<{ meal?: string; day?: string }>();
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [meal, setMeal] = useState<Meal>((params.meal as Meal) || mealForTime());
  const [servings, setServings] = useState(1);
  const [parts, setParts] = useState<Part[]>([]);
  const [steps, setSteps] = useState('');
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState<OffProduct[] | null>(null);
  const [busy, setBusy] = useState(false);

  const [items, reload] = useFocusData(async (d) => (await allFoodItems(d)).filter((f) => !f.recipe));
  const results = useMemo(
    () => (query.trim() ? searchFoods(query, items ?? []).slice(0, 8) : []),
    [items, query],
  );

  const grams = parts.map((p) => parseNum(p.g) ?? 0);
  const total = totalOf(parts.map((p, i) => ({ per100: p.item.per100, g: grams[i] })));
  const per = scale(total.n, 100 / Math.max(1, servings));

  const addPart = (item: FoodItem) => {
    setParts((ps) => [...ps, { item, g: String(Math.round(item.servings[0]?.g ?? 100)) }]);
    setQuery('');
    setOnline(null);
  };

  const searchOnline = async () => {
    if (!query.trim() || busy) return;
    setBusy(true);
    try {
      setOnline(await searchProducts(query));
    } catch (e) {
      notify('Search failed', e instanceof OffError ? e.message : 'Try again in a moment.', 'globe-outline');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return notify('Name your recipe', 'So you can find it when you log a meal.', 'restaurant-outline');
    if (!parts.length || total.g <= 0) return notify('Add ingredients', 'Nutrition is calculated from them.', 'restaurant-outline');
    const ref = await createRecipe(db, {
      name,
      meal,
      servings,
      steps,
      ingredients: parts.map((p, i) => ({ item: p.item, g: grams[i] })).filter((p) => p.g > 0),
    });
    router.replace({ pathname: '/food/[ref]', params: { ref, meal, day: params.day ?? '' } });
  };

  return (
    <Page maxWidth={640}>
      <Stack.Screen options={{ title: 'New recipe' }} />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Recipe name"
        placeholderTextColor={C.textFaint}
        autoFocus
        accessibilityLabel="Recipe name"
        style={styles.name}
      />
      <View style={styles.row}>
        {MEALS.map((m) => (
          <Chip key={m.key} label={m.label} active={meal === m.key} onPress={() => setMeal(m.key)} />
        ))}
      </View>
      <View style={styles.servings}>
        <Text style={[text.body, { flex: 1 }]}>Makes</Text>
        <IconButton icon="remove" label="Fewer servings" onPress={() => setServings((s) => Math.max(1, s - 1))} />
        <Text style={styles.servingsValue}>
          {servings} {servings === 1 ? 'serving' : 'servings'}
        </Text>
        <IconButton icon="add" label="More servings" onPress={() => setServings((s) => Math.min(20, s + 1))} />
      </View>

      {parts.length ? (
        <Animated.View entering={FadeIn} style={styles.summary}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kcal}>{Math.round(per.kcal ?? 0)}</Text>
            <Text style={text.faint}>kcal per serving · {Math.round(total.g / servings)} g</Text>
          </View>
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <View key={k} style={{ alignItems: 'center', minWidth: 52 }}>
              <View style={[styles.dot, { backgroundColor: MACRO_COLOR[k] }]} />
              <Text style={styles.macro}>{fmtNutrient(k, per[k])}</Text>
              <Text style={text.faint}>{k === 'protein' ? 'Protein' : k === 'carbs' ? 'Carbs' : 'Fat'}</Text>
            </View>
          ))}
        </Animated.View>
      ) : null}

      <SectionTitle title="Ingredients" />
      {parts.map((p, i) => (
        <Animated.View key={`${p.item.ref}-${i}`} entering={FadeInDown.duration(200)} style={styles.part}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={text.strong} numberOfLines={1}>
              {p.item.name}
            </Text>
            <Text style={text.faint}>{Math.round(((p.item.per100.kcal ?? 0) * grams[i]) / 100)} kcal</Text>
          </View>
          <View style={styles.gramBox}>
            <TextInput
              value={p.g}
              onChangeText={(t) => setParts((ps) => ps.map((x, j) => (j === i ? { ...x, g: t } : x)))}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel={`${p.item.name} grams`}
              style={styles.gramInput}
            />
            <Text style={text.faint}>g</Text>
          </View>
          <IconButton
            icon="close"
            label={`Remove ${p.item.name}`}
            size={16}
            onPress={() => setParts((ps) => ps.filter((_, j) => j !== i))}
          />
        </Animated.View>
      ))}

      <Card style={{ gap: S.sm, padding: S.sm }}>
        <View style={styles.searchBox}>
          <Ionicons name="add-circle-outline" size={17} color={C.accent} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setOnline(null);
            }}
            placeholder="Add ingredient: oats, Hühnerbrust, Skyr…"
            placeholderTextColor={C.textFaint}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search ingredient"
            style={styles.searchInput}
          />
        </View>
        {results.map((f) => (
          <FoodRow key={f.ref} item={f} onPress={() => addPart(f)} />
        ))}
        {online?.map((o) => (
          <FoodRow
            key={o.barcode}
            item={{
              ref: `off:${o.barcode}`,
              source: 'product',
              name: o.name,
              brand: o.brand,
              category: 'Product',
              words: '',
              per100: o.per100,
              servings: o.servingG ? [{ label: o.servingLabel ?? '1 serving', g: o.servingG }] : [],
              useCount: 0,
            }}
            onPress={async () => {
              const ref = await saveProduct(db, o);
              const fresh = (await allFoodItems(db)).find((f) => f.ref === ref);
              reload();
              if (fresh) addPart(fresh);
            }}
          />
        ))}
        {query.trim() && online == null ? (
          <Pressable onPress={searchOnline} style={styles.online} accessibilityRole="button">
            {busy ? <ActivityIndicator size="small" color={C.accent} /> : <Ionicons name="globe-outline" size={15} color={C.accent} />}
            <Text style={styles.onlineText}>Search supermarket products for "{query.trim()}"</Text>
          </Pressable>
        ) : null}
      </Card>

      <SectionTitle title="Steps (optional)" />
      <TextInput
        value={steps}
        onChangeText={setSteps}
        placeholder={'One step per line\nCook the rice\nFry the chicken'}
        placeholderTextColor={C.textFaint}
        multiline
        accessibilityLabel="Steps"
        style={styles.steps}
      />

      <Button label="Save recipe" icon="checkmark" kind="primary" onPress={save} style={{ marginTop: S.md }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  name: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 24,
    letterSpacing: -0.5,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.accentLine,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: S.xs },
  servings: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  servingsValue: { color: C.text, fontFamily: F.semi, fontSize: 14, minWidth: 84, textAlign: 'center' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    padding: 14,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
  },
  kcal: { color: C.text, fontFamily: F.display, fontSize: 26, letterSpacing: -0.6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  macro: { color: C.text, fontFamily: F.semi, fontSize: 13 },
  part: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    padding: S.sm,
    paddingLeft: S.md,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  gramBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: S.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.bg,
  },
  gramInput: { width: 52, color: C.text, fontFamily: F.semi, fontSize: 14, textAlign: 'right', paddingVertical: 0 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 40,
    paddingHorizontal: S.sm,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, minWidth: 0, color: C.text, fontFamily: F.regular, fontSize: 14, paddingVertical: 0 },
  online: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.sm },
  onlineText: { color: C.accent, fontFamily: F.medium, fontSize: 13, flex: 1 },
  steps: {
    minHeight: 110,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    color: C.text,
    fontFamily: F.regular,
    fontSize: 14,
    textAlignVertical: 'top',
  },
});
