import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { SOURCE } from '@/components/food-row';
import { FoodThumb, photoSource } from '@/components/food-thumb';
import { MACRO_COLOR } from '@/components/nutrition-charts';
import { Button, Card, Chip, Empty, HeaderButton, ListCard, ListRow, Page, SectionTitle, text } from '@/components/ui';
import { dayKey } from '@/lib/calendar';
import { confirm } from '@/lib/dialog';
import {
  deleteFood,
  deleteLogEntry,
  getFoodItem,
  getGoals,
  getLogEntry,
  isFavorite,
  logFood,
  setFavorite,
  setFoodImage,
  updateLogAmount,
} from '@/lib/food-db';
import { amountLabel, nutrientsFor, type FoodItem, type Serving } from '@/lib/foods';
import { parseNum } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { pickPhoto } from '@/lib/photo';
import { RECIPE_PHOTOS } from '@/lib/recipe-photos';
import { fmtNutrient, MICROS, NUTRIENTS, type Goals, type NutrientKey } from '@/lib/nutrition';
import { MEALS, mealForTime, mealLabel, type Meal } from '@/lib/recipes';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { useTween } from '@/lib/use-tween';

const SOURCE_NAME: Partial<Record<FoodItem['source'], string>> = {
  bls: 'Bundeslebensmittelschlüssel (BLS 4.0)',
  product: 'Open Food Facts',
};

const TABLE: { key: NutrientKey; indent?: boolean }[] = [
  { key: 'kcal' },
  { key: 'fat' },
  { key: 'satFat', indent: true },
  { key: 'carbs' },
  { key: 'sugar', indent: true },
  { key: 'fiber' },
  { key: 'protein' },
  { key: 'salt' },
];

export default function FoodScreen() {
  const p = useLocalSearchParams<{ ref: string; meal?: string; day?: string; entry?: string }>();
  const [data, reload] = useFocusData(
    async (db) => ({
      item: await getFoodItem(db, p.ref),
      goals: await getGoals(db),
      entry: p.entry ? await getLogEntry(db, Number(p.entry)) : null,
      favorite: await isFavorite(db, p.ref),
    }),
    `${p.ref}-${p.entry ?? ''}`,
  );
  if (!data) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!data.item) return <Empty icon="alert-circle-outline" title="Food not found" />;
  return (
    <FoodDetail
      reload={reload}
      item={data.item}
      goals={data.goals}
      entry={data.entry}
      favorite={data.favorite}
      meal={(data.entry?.meal ?? (p.meal as Meal)) || mealForTime()}
      day={data.entry?.day || p.day || dayKey(Date.now())}
    />
  );
}

type Unit = { kind: 'serving'; serving: Serving } | { kind: 'g' };

function FoodDetail({
  reload,
  item,
  goals,
  entry,
  favorite,
  meal: initialMeal,
  day,
}: {
  favorite: boolean;
  item: FoodItem;
  goals: Goals;
  entry: Awaited<ReturnType<typeof getLogEntry>>;
  reload: () => void;
  meal: Meal;
  day: string;
}) {
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const first = item.servings[0];
  const [unit, setUnit] = useState<Unit>(first ? { kind: 'serving', serving: first } : { kind: 'g' });
  const [countText, setCountText] = useState('1');
  const [gramText, setGramText] = useState(String(first?.g ?? 100));

  // Editing a logged entry: start from its amount.
  useEffect(() => {
    if (!entry) return;
    const s = item.servings.find((x) => entry.amount === x.label || entry.amount.endsWith(`× ${x.label}`));
    if (s) {
      setUnit({ kind: 'serving', serving: s });
      setCountText(String(Math.round((entry.grams / s.g) * 100) / 100));
    } else {
      setUnit({ kind: 'g' });
      setGramText(String(Math.round(entry.grams)));
    }
  }, [entry, item]);

  const count = parseNum(countText) ?? 0;
  const grams = unit.kind === 'serving' ? count * unit.serving.g : (parseNum(gramText) ?? 0);
  const n = nutrientsFor(item, grams);
  const kcal = useTween(n.kcal ?? 0, 400);
  const label = amountLabel(unit.kind === 'serving' ? unit.serving : null, count, grams);
  const valid = grams > 0;

  const save = async () => {
    if (!valid) return;
    if (entry) {
      await updateLogAmount(db, entry.id, item, grams, label);
      if (meal !== entry.meal) await db.runAsync('UPDATE food_log SET meal = ? WHERE id = ?', meal, entry.id);
    } else {
      await logFood(db, { day, meal, item, grams, amount: label });
    }
    haptic.success();
    router.dismissTo('/food');
  };

  const remove = async () => {
    if (!entry) return;
    await deleteLogEntry(db, entry.id);
    haptic.tap();
    router.back();
  };

  const removeFood = async () => {
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      message: 'It disappears from search. Days you already logged keep their numbers.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteFood(db, item.ref);
    router.back();
  };

  const stepGrams = (d: number) =>
    setGramText(String(Math.max(5, Math.round(((parseNum(gramText) ?? 0) + d) / 5) * 5)));
  const step = (d: number) => setCountText(String(Math.max(0.5, Math.round((count + d) * 2) / 2)));
  const src = SOURCE[item.source];
  const photo = photoSource(item);
  // Open Food Facts package photos are shown whole on a light background instead of cropped.
  const isPackShot = !!item.image?.startsWith('http');
  const recipePhoto = item.ref.startsWith('r:') ? RECIPE_PHOTOS[item.ref.slice(2)] : undefined;
  const credit = recipePhoto ? (
    <Pressable onPress={() => Linking.openURL(recipePhoto.url)} accessibilityRole="link">
      <Text style={styles.credit}>
        Photo: {recipePhoto.author} on <Text style={{ textDecorationLine: 'underline' }}>Unsplash</Text>
      </Text>
    </Pressable>
  ) : item.image?.startsWith('http') ? (
    <Text style={styles.credit}>Photo: Open Food Facts (CC BY-SA)</Text>
  ) : null;
  const own = item.source === 'custom' || item.source === 'my-recipe' || item.source === 'product';

  const amount = (
    <Card style={{ gap: S.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {item.servings.map((s) => (
          <Chip
            key={s.label}
            label={`${s.label}${/\d\s*g\b/.test(s.label) ? '' : ` · ${Math.round(s.g)} g`}`}
            active={unit.kind === 'serving' && unit.serving.label === s.label}
            onPress={() => {
              setUnit({ kind: 'serving', serving: s });
              setCountText('1');
            }}
          />
        ))}
        <Chip
          label="Grams"
          active={unit.kind === 'g'}
          onPress={() => {
            setUnit({ kind: 'g' });
            setGramText(String(Math.round(grams || 100)));
          }}
        />
      </ScrollView>
      {unit.kind === 'serving' ? (
        <View style={styles.stepper}>
          <Pressable onPress={() => step(-0.5)} style={styles.stepButton} accessibilityLabel="Less">
            <Ionicons name="remove" size={20} color={C.text} />
          </Pressable>
          <View style={styles.amountBox}>
            <TextInput
              value={countText}
              onChangeText={setCountText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel="Number of servings"
              style={styles.amountInput}
            />
            <Text style={styles.amountUnit} numberOfLines={1}>
              × {unit.serving.label}
            </Text>
          </View>
          <Pressable onPress={() => step(0.5)} style={styles.stepButton} accessibilityLabel="More">
            <Ionicons name="add" size={20} color={C.text} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.stepper}>
          <Pressable onPress={() => stepGrams(-10)} style={styles.stepButton} accessibilityLabel="10 g less">
            <Ionicons name="remove" size={20} color={C.text} />
          </Pressable>
          <View style={styles.amountBox}>
            <TextInput
              value={gramText}
              onChangeText={setGramText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel="Amount in grams"
              style={styles.amountInput}
            />
            <Text style={styles.amountUnit}>g</Text>
          </View>
          <Pressable onPress={() => stepGrams(10)} style={styles.stepButton} accessibilityLabel="10 g more">
            <Ionicons name="add" size={20} color={C.text} />
          </Pressable>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {MEALS.map((m) => (
          <Chip key={m.key} label={m.label} active={meal === m.key} onPress={() => setMeal(m.key)} />
        ))}
      </ScrollView>
    </Card>
  );

  const hero = (
    <Card style={styles.hero}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kcal}>{Math.round(kcal)}</Text>
        <Text style={text.faint}>kcal · {Math.round((100 * (n.kcal ?? 0)) / goals.kcal)}% of your goal</Text>
      </View>
      {(['protein', 'carbs', 'fat'] as const).map((k) => (
        <View key={k} style={styles.macro}>
          <View style={[styles.macroDot, { backgroundColor: MACRO_COLOR[k] }]} />
          <Text style={styles.macroValue}>{fmtNutrient(k, n[k])}</Text>
          <Text style={text.faint}>{NUTRIENTS[k].label}</Text>
        </View>
      ))}
    </Card>
  );

  const details = (
    <>
      <SectionTitle title={`Nutrition for ${Math.round(grams)} g`} />
      <ListCard>
        {TABLE.map((r, i) => (
          <ListRow key={r.key} last={i === TABLE.length - 1}>
            <Text style={[r.indent ? text.dim : text.body, { flex: 1, paddingLeft: r.indent ? S.md : 0 }]}>
              {r.indent ? `of which ${NUTRIENTS[r.key].label.toLowerCase()}` : NUTRIENTS[r.key].label}
            </Text>
            <Text style={styles.cell}>{fmtNutrient(r.key, n[r.key])}</Text>
            <Text style={styles.per100}>{fmtNutrient(r.key, item.per100[r.key])}</Text>
          </ListRow>
        ))}
      </ListCard>
      <Text style={[text.faint, { textAlign: 'right' }]}>Right column: per 100 g</Text>
      {MICROS.some((k) => item.per100[k] != null) ? (
        <>
          <SectionTitle title="Vitamins and minerals" />
          <ListCard>
            {MICROS.filter((k) => item.per100[k] != null).map((k, i, all) => (
              <ListRow key={k} last={i === all.length - 1}>
                <Text style={[text.body, { flex: 1 }]}>{NUTRIENTS[k].label}</Text>
                <Text style={styles.cell}>{fmtNutrient(k, n[k])}</Text>
                <Text style={styles.per100}>{Math.round((100 * (n[k] ?? 0)) / goals[k])}%</Text>
              </ListRow>
            ))}
          </ListCard>
        </>
      ) : null}
    </>
  );

  // Right under the amount, so you don't have to scroll past the nutrition table to log it.
  const actions = (
    <View style={styles.actions}>
      {entry ? <Button label="Remove" icon="trash-outline" kind="danger" onPress={remove} /> : null}
      <Button
        label={entry ? 'Save' : `Add to ${mealLabel(meal)}`}
        icon={entry ? 'checkmark' : 'add'}
        kind="primary"
        onPress={save}
        style={[{ flex: 1 }, !valid && { opacity: 0.4 }]}
      />
    </View>
  );

  const recipe = item.recipe ? (
    <>
      <SectionTitle
        title="Ingredients"
        right={
          <Text style={text.faint}>
            {item.recipe.servings > 1 ? `${item.recipe.servings} servings` : '1 serving'}
            {item.recipe.minutes ? ` · ${item.recipe.minutes} min` : ''}
          </Text>
        }
      />
      <ListCard>
        {item.recipe.ingredients.map((g, i) => (
          <ListRow key={`${g.ref}-${i}`} last={i === item.recipe!.ingredients.length - 1}>
            <Text style={[text.body, { flex: 1 }]}>{g.name}</Text>
            <Text style={text.dim}>
              {g.note ? `${g.note} · ` : ''}
              {Math.round(g.g)} g
            </Text>
          </ListRow>
        ))}
      </ListCard>
      {item.recipe.steps.length ? (
        <>
          <SectionTitle title="Steps" />
          <Card style={{ gap: S.md }}>
            {item.recipe.steps.map((s, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={[text.body, { flex: 1 }]}>{s}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </>
  ) : null;

  return (
    <Page maxWidth={desktop ? 980 : 640}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <HeaderButton
                icon={favorite ? 'star' : 'star-outline'}
                label={favorite ? 'Remove from favourites' : 'Add to favourites'}
                onPress={async () => {
                  await setFavorite(db, item.ref, !favorite);
                  haptic.tap();
                  reload();
                }}
                color={favorite ? C.gold : C.textDim}
              />
              {own && !entry ? (
                <HeaderButton icon="trash-outline" label="Delete food" onPress={removeFood} color={C.danger} />
              ) : null}
            </View>
          ),
        }}
      />
      <View style={desktop && photo ? styles.headWide : { gap: S.md }}>
        {photo ? (
          <Animated.View entering={FadeIn.duration(300)} style={[{ gap: 6 }, desktop && styles.photoCol]}>
            <Image
              source={photo}
              style={[styles.photo, isPackShot && styles.packShot]}
              resizeMode={isPackShot ? 'contain' : 'cover'}
            />
            {credit}
          </Animated.View>
        ) : null}
        <View style={{ flex: desktop ? 1 : undefined, minWidth: 0, gap: S.md, alignSelf: 'stretch' }}>
          <Animated.View entering={FadeIn.duration(250)} style={styles.titleRow}>
            {!photo ? <FoodThumb item={item} size={64} radius={16} /> : null}
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.badges}>
                <View style={styles.badge}>
                  <Ionicons name={src.icon} size={12} color={C.textDim} />
                  <Text style={styles.badgeText}>{SOURCE_NAME[item.source] ?? src.label}</Text>
                </View>
                {item.barcode ? <Text style={text.faint}>{item.barcode}</Text> : null}
              </View>
              <Text style={text.title}>{item.name}</Text>
              {item.brand ? <Text style={text.dim}>{item.brand}</Text> : null}
              {item.altName && item.altName !== item.name ? <Text style={text.dim}>{item.altName}</Text> : null}
            </View>
          </Animated.View>
          {own ? (
            <View style={styles.photoActions}>
              <Button
                small
                icon="camera-outline"
                label={item.image ? 'Change photo' : 'Add photo'}
                onPress={async () => {
                  const img = await pickPhoto();
                  if (!img) return;
                  await setFoodImage(db, item.ref, img);
                  haptic.tap();
                  reload();
                }}
              />
              {item.image?.startsWith('data:') ? (
                <Button
                  small
                  kind="ghost"
                  icon="trash-outline"
                  label="Remove photo"
                  onPress={async () => {
                    await setFoodImage(db, item.ref, null);
                    reload();
                  }}
                />
              ) : null}
            </View>
          ) : null}
          {desktop && photo ? <View style={{ marginTop: 'auto' }}>{hero}</View> : null}
        </View>
      </View>

      {desktop ? (
        <View style={styles.columns}>
          <View style={{ flex: 1, minWidth: 0, gap: S.sm }}>
            {amount}
            {actions}
            {recipe}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: S.sm }}>
            {photo ? null : hero}
            {details}
          </View>
        </View>
      ) : (
        <>
          {amount}
          {actions}
          {hero}
          {recipe}
          {details}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, maxHeight: 300, borderRadius: R.lg, backgroundColor: C.cardHi },
  headWide: { flexDirection: 'row', alignItems: 'flex-start', gap: S.xl },
  photoCol: { width: 420 },
  packShot: { backgroundColor: '#F4F6F7' },
  credit: { color: C.textFaint, fontFamily: F.regular, fontSize: 11 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  photoActions: { flexDirection: 'row', gap: S.sm },
  badges: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  badgeText: { color: C.textDim, fontFamily: F.medium, fontSize: 11 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: S.xl },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.cardHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 44,
    paddingHorizontal: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.bg,
  },
  amountInput: {
    width: 64,
    color: C.text,
    fontFamily: F.displaySemi,
    fontSize: 18,
    paddingVertical: 0,
  },
  amountUnit: { flex: 1, color: C.textDim, fontFamily: F.medium, fontSize: 13 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  kcal: { color: C.text, fontFamily: F.display, fontSize: 32, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  macro: { alignItems: 'center', gap: 2, minWidth: 54 },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  macroValue: { color: C.text, fontFamily: F.semi, fontSize: 14, fontVariant: ['tabular-nums'] },
  cell: { color: C.text, fontFamily: F.medium, fontSize: 13, fontVariant: ['tabular-nums'] },
  per100: {
    width: 72,
    textAlign: 'right',
    color: C.textFaint,
    fontFamily: F.regular,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  stepRow: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start' },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: C.accent, fontFamily: F.semi, fontSize: 12 },
  actions: { flexDirection: 'row', gap: S.sm, marginBottom: S.sm },
});
