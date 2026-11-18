import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, LinearTransition } from 'react-native-reanimated';

import { CalorieRing, DetailBars, EnergySplit, MacroBars, MicroBars } from '@/components/nutrition-charts';
import { FoodThumb, type ThumbData } from '@/components/food-thumb';
import { RecipeCard } from '@/components/recipe-card';
import { SoundToggle } from '@/components/sound-toggle';
import { Card, IconButton, ListCard, ListRow, Page, SectionTitle, text, type IconName } from '@/components/ui';
import { WaterCard } from '@/components/water-card';
import { addDays, dayKey, dayStart, relativeDay } from '@/lib/calendar';
import {
  addWater,
  allFoodItems,
  copyMeal,
  dayLog,
  dayMealPhotos,
  dayWater,
  favoriteRefs,
  deleteLogEntries,
  deleteLogEntry,
  deleteSavedMeal,
  getGoalSettings,
  goalsFrom,
  logSavedMeal,
  restoreLogEntry,
  restoreSavedMeal,
  saveMeal,
  savedMeals,
  setMealPhoto,
  thumbsFor,
  undoWater,
  type LogEntry,
  type SavedMeal,
} from '@/lib/food-db';
import { playFoodAdded } from '@/lib/food-sounds';
import { confirm } from '@/lib/dialog';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { sum } from '@/lib/nutrition';
import { MEALS, mealForTime, mealLabel, type Meal } from '@/lib/recipes';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type Toast = { id: number; text: string; icon: IconName; undo?: () => Promise<void> };

export default function FoodTab() {
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const today = dayKey(Date.now());
  const [day, setDay] = useState(today);
  // The calendar opens a specific day with /food?day=2026-11-12.
  const params = useLocalSearchParams<{ day?: string }>();
  useEffect(() => {
    if (params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) && params.day <= today) setDay(params.day);
  }, [params.day, today]);

  const [data, reload] = useFocusData(async (d) => {
    const [log, yesterday, water, settings, photos, saved] = await Promise.all([
      dayLog(d, day),
      dayLog(d, addDays(day, -1)),
      dayWater(d, day),
      getGoalSettings(d),
      dayMealPhotos(d, day),
      savedMeals(d),
    ]);
    const [items, favs] = await Promise.all([allFoodItems(d), favoriteRefs(d)]);
    const ideaMeal = mealForTime();
    const ideas = items
      .filter((f) => f.recipe?.meal === ideaMeal)
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 10);
    const thumbs = await thumbsFor(
      d,
      log.map((e) => e.ref),
    );
    return {
      log,
      yesterday,
      water,
      settings,
      goals: goalsFrom(settings),
      photos,
      thumbs,
      saved,
      ideas,
      ideaMeal,
      favs: new Set(favs),
    };
  }, day);

  const log = data?.log ?? [];
  const goals = data?.goals;
  const total = sum(log.map((e) => e.n));
  const eaten = total.kcal ?? 0;

  // Short message at the bottom ("Removed banana", "Saved as usual breakfast"), often with Undo.
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const showToast = (t: Omit<Toast, 'id'>) => {
    setToast({ ...t, id: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };
  const runUndo = async () => {
    if (!toast?.undo) return;
    await toast.undo();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
    haptic.tap();
    reload();
  };

  const removeEntry = async (e: LogEntry) => {
    await deleteLogEntry(db, e.id);
    haptic.tap();
    sound.play('foodRemove');
    showToast({ text: `Removed ${e.name}`, icon: 'trash-outline', undo: () => restoreLogEntry(db, e) });
    reload();
  };

  const saveUsual = async (meal: Meal) => {
    const res = await saveMeal(db, day, meal);
    if (!res) return;
    haptic.success();
    sound.play('saved');
    const label = mealLabel(meal).toLowerCase();
    if (res.existed) {
      showToast({ text: `Already saved as a usual ${label}`, icon: 'bookmark' });
    } else {
      showToast({
        text: `Saved as a usual ${label}`,
        icon: 'bookmark',
        undo: () => deleteSavedMeal(db, res.meal.id),
      });
    }
    reload();
  };

  const forgetSaved = async (m: SavedMeal) => {
    const ok = await confirm({
      title: `Delete "${m.name}"?`,
      message: 'It disappears from your usual meals. Days you already logged stay as they are.',
      confirmLabel: 'Delete',
      icon: 'bookmark-outline',
      destructive: true,
    });
    if (!ok) return;
    await deleteSavedMeal(db, m.id);
    haptic.tap();
    sound.play('foodRemove');
    showToast({ text: `Deleted ${m.name}`, icon: 'trash-outline', undo: () => restoreSavedMeal(db, m) });
    reload();
  };

  const addSaved = async (m: SavedMeal, meal: Meal) => {
    const ids = await logSavedMeal(db, m.id, day, meal);
    haptic.success();
    playFoodAdded(db, day, m.total.protein ?? 0);
    showToast({ text: `Added ${m.name}`, icon: 'checkmark-circle', undo: () => deleteLogEntries(db, ids) });
    reload();
  };

  const openAdd = (meal: Meal) => router.push({ pathname: '/food-add', params: { meal, day } });

  const drink = async (ml: number) => {
    const before = data?.water ?? 0;
    await addWater(db, day, ml);
    if (goals && before < goals.waterMl && before + ml >= goals.waterMl) {
      haptic.success();
      sound.play('waterGoal');
    } else {
      haptic.tap();
      sound.play('water');
    }
    reload();
  };

  const summary = goals ? (
    <Card style={styles.summary}>
      <View style={[styles.summaryTop, !desktop && { gap: S.lg }]}>
        <CalorieRing eaten={eaten} goal={goals.kcal} size={desktop ? 180 : 150} />
        <MacroBars n={total} goals={goals} />
      </View>
      <View style={styles.eatenRow}>
        <Stat label="Eaten" value={Math.round(eaten).toLocaleString('en-US')} />
        <Stat label="Goal" value={goals.kcal.toLocaleString('en-US')} />
        <Stat label="Protein" value={`${Math.round(total.protein ?? 0)} g`} />
      </View>
      <EnergySplit n={total} />
    </Card>
  ) : null;

  const meals = (
    <View>
      {MEALS.map((m, mi) => {
        const entries = log.filter((e) => e.meal === m.key);
        const kcal = sum(entries.map((e) => e.n)).kcal ?? 0;
        const before = (data?.yesterday ?? []).filter((e) => e.meal === m.key);
        return (
          <Animated.View key={m.key} entering={FadeInDown.delay(mi * 40).duration(260)}>
            <SectionTitle
              title={entries.length ? `${m.label} · ${Math.round(kcal)} kcal` : m.label}
              right={
                <View style={{ flexDirection: 'row' }}>
                  {entries.length ? (
                    <IconButton
                      icon="bookmark-outline"
                      label={`Save ${m.label.toLowerCase()} as a usual meal`}
                      onPress={() => saveUsual(m.key)}
                    />
                  ) : null}
                  <IconButton icon="add" label={`Add to ${m.label}`} onPress={() => openAdd(m.key)} color={C.accent} />
                </View>
              }
            />
            {data?.photos[m.key] ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.mealPhotoWrap}>
                <Image
                  source={{ uri: data.photos[m.key] }}
                  style={styles.mealPhoto}
                  resizeMode="cover"
                  accessibilityLabel={`Your photo of ${m.label.toLowerCase()}`}
                />
                <Pressable
                  onPress={async () => {
                    await setMealPhoto(db, day, m.key, null);
                    reload();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo of ${m.label.toLowerCase()}`}
                  style={styles.mealPhotoRemove}>
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </Animated.View>
            ) : null}
            {entries.length ? (
              <ListCard>
                {entries.map((e, i) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    thumb={{ ref: e.ref, ...data?.thumbs.get(e.ref) }}
                    last={i === entries.length - 1}
                    onRemove={() => removeEntry(e)}
                  />
                ))}
              </ListCard>
            ) : (
              <View style={{ gap: S.sm }}>
                <View style={styles.emptyMeal}>
                  <Pressable
                    onPress={() => openAdd(m.key)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.addMeal, pressed && { opacity: 0.7 }]}>
                    <Ionicons name={m.icon} size={16} color={C.textDim} />
                    <Text style={styles.addMealLabel}>Add {m.label.toLowerCase()}</Text>
                  </Pressable>
                  {before.length ? (
                    <Pressable
                      onPress={async () => {
                        await copyMeal(db, addDays(day, -1), day, m.key);
                        haptic.success();
                        playFoodAdded(db, day, sum(before.map((e) => e.n)).protein ?? 0);
                        reload();
                      }}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.copy, pressed && { opacity: 0.7 }]}>
                      <Ionicons name="copy-outline" size={14} color={C.accent} />
                      <Text style={styles.copyLabel}>Same as yesterday</Text>
                    </Pressable>
                  ) : null}
                </View>
                {(data?.saved ?? [])
                  .filter((x) => x.meal === m.key)
                  .slice(0, 3)
                  .map((x) => (
                    <View key={x.id} style={styles.usualRow}>
                      <Pressable
                        onPress={() => addSaved(x, m.key)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${x.name}`}
                        style={({ pressed }) => [styles.usual, pressed && { opacity: 0.7 }]}>
                        <Ionicons name="bookmark" size={14} color={C.accent} />
                        <Text style={styles.usualName} numberOfLines={1}>
                          {x.name}
                        </Text>
                        <Text style={text.faint}>{Math.round(x.total.kcal ?? 0)} kcal</Text>
                        <Ionicons name="add" size={18} color={C.accent} />
                      </Pressable>
                      <Pressable
                        onPress={() => forgetSaved(x)}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete usual meal ${x.name}`}
                        style={({ pressed }) => [styles.usualDelete, pressed && { backgroundColor: C.cardHi }]}>
                        <Ionicons name="trash-outline" size={16} color={C.textDim} />
                      </Pressable>
                    </View>
                  ))}
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );

  // Recipe ideas for the time of day, so recipes are visible without opening "Add".
  const ideas = data?.ideas.length ? (
    <View>
      <SectionTitle
        title={`Ideas for ${mealLabel(data.ideaMeal).toLowerCase()}`}
        right={
          <Pressable onPress={() => router.push('/recipes')} accessibilityRole="link" hitSlop={8} style={styles.seeAll}>
            <Text style={styles.seeAllText}>All recipes</Text>
            <Ionicons name="chevron-forward" size={14} color={C.accent} />
          </Pressable>
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ideas}>
        {data.ideas.map((f) => (
          <RecipeCard
            key={f.ref}
            item={f}
            width={desktop ? 180 : 156}
            favorite={data.favs.has(f.ref)}
            onPress={() => router.push({ pathname: '/food/[ref]', params: { ref: f.ref, meal: data.ideaMeal, day } })}
          />
        ))}
        <Pressable
          onPress={() => router.push('/recipes')}
          accessibilityRole="link"
          style={({ pressed }) => [styles.moreCard, { width: desktop ? 140 : 120 }, pressed && { opacity: 0.7 }]}>
          <Ionicons name="restaurant-outline" size={22} color={C.accent} />
          <Text style={styles.seeAllText}>All recipes</Text>
        </Pressable>
      </ScrollView>
    </View>
  ) : null;

  const side = goals ? (
    <View style={{ gap: S.sm }}>
      <SectionTitle title="Water" />
      <WaterCard
        ml={data?.water ?? 0}
        goal={goals.waterMl}
        onAdd={drink}
        onUndo={async () => {
          await undoWater(db, day);
          reload();
        }}
      />
      <SectionTitle title="Fibre, sugar and salt" />
      <Card>
        <DetailBars n={total} goals={goals} />
      </Card>
      <SectionTitle title="Vitamins and minerals" />
      <Card style={{ gap: S.md }}>
        <MicroBars n={total} goals={goals} />
        <Text style={text.faint}>
          % of the EU daily reference. Packaged products often don't list vitamins, so these can read low.
        </Text>
      </Card>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <Page topInset maxWidth={1100}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={text.title}>Food</Text>
            <Text style={text.dim}>
              {data?.settings.profile ? 'Goals from your body profile' : 'EU reference intakes'}
            </Text>
          </View>
          {/* One capsule for the three page buttons, in the style of the Workout tab's sound button. */}
          <View style={styles.headIcons}>
            <IconButton
              icon="restaurant-outline"
              label="All recipes"
              size={22}
              color={C.accent}
              onPress={() => router.push('/recipes')}
            />
            <View style={styles.headDivider} />
            <SoundToggle size={22} tint={C.accent} />
            <View style={styles.headDivider} />
            <IconButton
              icon="options-outline"
              label="Nutrition goals"
              size={22}
              color={C.accent}
              onPress={() => router.push('/nutrition-goals')}
            />
          </View>
        </View>

        <DaySwitcher day={day} today={today} onChange={setDay} />

        {desktop ? (
          <View style={styles.columns}>
            <View style={{ flex: 1.15, minWidth: 0 }}>
              {summary}
              {meals}
              {ideas}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>{side}</View>
          </View>
        ) : (
          <>
            {summary}
            {meals}
            {ideas}
            {side}
          </>
        )}
        <Text style={[text.faint, { marginTop: S.lg }]}>
          Food data: Max Rubner-Institut, Bundeslebensmittelschlüssel (BLS) 4.0, CC BY 4.0. Products: Open Food Facts
          (ODbL). Goals: EU reference intakes (Regulation 1169/2011) and EFSA.
        </Text>
      </Page>
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(200)}
          style={styles.undoBar}>
          <Ionicons name={toast.icon} size={16} color={toast.icon === 'trash-outline' ? C.textDim : C.accent} />
          <Text style={styles.undoText} numberOfLines={1}>
            {toast.text}
          </Text>
          {toast.undo ? (
            <Pressable onPress={runUndo} accessibilityRole="button" hitSlop={8} style={styles.undoButton}>
              <Text style={styles.undoButtonText}>Undo</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** "Thu 19" style label for the buttons next to the current day. */
function shortDay(key: string, today: string): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  const d = new Date(dayStart(key));
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`;
}

/**
 * Previous / next day as labelled buttons ("‹ Yesterday", "Thu 19 ›") around the
 * current day and its date, so it's obvious you can move between days.
 */
function DaySwitcher({ day, today, onChange }: { day: string; today: string; onChange: (d: string) => void }) {
  const prev = addDays(day, -1);
  const next = addDays(day, 1);
  const canNext = day < today;
  const date = new Date(dayStart(day)).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const go = (d: string) => {
    haptic.tap();
    onChange(d);
  };
  return (
    <View style={styles.daySwitch}>
      <Pressable
        onPress={() => go(prev)}
        accessibilityRole="button"
        accessibilityLabel={`Previous day, ${shortDay(prev, today)}`}
        style={({ pressed }) => [styles.dayStep, pressed && styles.dayStepPressed]}>
        <Ionicons name="chevron-back" size={18} color={C.accent} />
        <Text style={styles.dayStepText} numberOfLines={1}>
          {shortDay(prev, today)}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => day !== today && go(today)}
        disabled={day === today}
        accessibilityRole="button"
        accessibilityLabel={day === today ? `Today, ${date}` : `${date}. Go back to today`}
        style={styles.dayCenter}>
        <Animated.Text key={day} entering={FadeIn.duration(200)} style={styles.day} numberOfLines={1}>
          {relativeDay(day)}
        </Animated.Text>
        {day === today ? (
          <Text style={styles.daySub} numberOfLines={1}>
            {date}
          </Text>
        ) : (
          <View style={styles.backToday}>
            <Ionicons name="return-down-back" size={11} color={C.accent} />
            <Text style={styles.backTodayText}>Back to today</Text>
          </View>
        )}
      </Pressable>
      <Pressable
        onPress={() => canNext && go(next)}
        disabled={!canNext}
        accessibilityRole="button"
        accessibilityLabel={canNext ? `Next day, ${shortDay(next, today)}` : 'Next day (no days after today)'}
        style={({ pressed }) => [
          styles.dayStep,
          styles.dayStepRight,
          !canNext && styles.dayStepOff,
          pressed && canNext && styles.dayStepPressed,
        ]}>
        <Text style={[styles.dayStepText, !canNext && { color: C.textFaint }]} numberOfLines={1}>
          {canNext ? shortDay(next, today) : 'Tomorrow'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={canNext ? C.accent : C.textFaint} />
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={text.faint}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function EntryRow({
  entry: e,
  thumb,
  last,
  onRemove,
}: {
  entry: LogEntry;
  thumb: ThumbData;
  last: boolean;
  onRemove: () => void;
}) {
  return (
    <Animated.View layout={LinearTransition.duration(200)} exiting={FadeOut.duration(150)}>
      <ListRow
        last={last}
        onPress={() => router.push({ pathname: '/food/[ref]', params: { ref: e.ref, entry: String(e.id) } })}>
        <FoodThumb item={thumb} size={38} radius={10} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={text.strong} numberOfLines={1}>
            {e.name}
          </Text>
          <Text style={text.faint} numberOfLines={1}>
            {[e.amount, e.brand].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.kcal}>{Math.round(e.n.kcal ?? 0)} kcal</Text>
          <Text style={text.faint}>{Math.round(e.n.protein ?? 0)} g protein</Text>
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${e.name}`}
          style={({ pressed }) => [styles.removeEntry, pressed && { backgroundColor: C.cardHi }]}>
          <Ionicons name="close" size={16} color={C.textFaint} />
        </Pressable>
      </ListRow>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: S.md },
  headIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
  },
  headDivider: { width: 1, height: 20, backgroundColor: C.accentLine },
  daySwitch: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.xs },
  dayStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 40,
    minWidth: 96,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
  },
  dayStepRight: { paddingLeft: 12, paddingRight: 8, justifyContent: 'flex-end' },
  dayStepOff: { borderColor: C.border, backgroundColor: 'transparent', opacity: 0.6 },
  dayStepPressed: { transform: [{ scale: 0.96 }], opacity: 0.8 },
  dayStepText: { color: C.text, fontFamily: F.semi, fontSize: 13, flexShrink: 1 },
  dayCenter: { flex: 1, minWidth: 0, alignItems: 'center', gap: 1 },
  day: { color: C.text, fontFamily: F.displaySemi, fontSize: 17 },
  daySub: { color: C.textFaint, fontFamily: F.medium, fontSize: 11 },
  backToday: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backTodayText: { color: C.accent, fontFamily: F.semi, fontSize: 11 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: S.xl },
  summary: { gap: S.lg, padding: S.lg },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: S.xl },
  eatenRow: { flexDirection: 'row', gap: S.md },
  statValue: { color: C.text, fontFamily: F.displaySemi, fontSize: 16, fontVariant: ['tabular-nums'] },
  emptyMeal: { flexDirection: 'row', gap: S.sm },
  addMeal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 46,
    paddingHorizontal: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.borderHi,
  },
  addMealLabel: { color: C.textDim, fontFamily: F.medium, fontSize: 13 },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: S.md,
    borderRadius: R.lg,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentLine,
  },
  copyLabel: { color: C.text, fontFamily: F.semi, fontSize: 12 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: C.accent, fontFamily: F.semi, fontSize: 13 },
  ideas: { gap: S.sm, paddingBottom: 4 },
  moreCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.borderHi,
  },
  usualRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  usualDelete: {
    width: 42,
    height: 42,
    borderRadius: R.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  usual: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 42,
    paddingHorizontal: S.md,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  usualName: { flex: 1, minWidth: 0, color: C.text, fontFamily: F.medium, fontSize: 13 },
  removeEntry: {
    width: 32,
    height: 32,
    marginRight: -6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoBar: {
    position: 'absolute',
    left: S.lg,
    right: S.lg,
    bottom: S.lg,
    alignSelf: 'center',
    maxWidth: 480,
    marginHorizontal: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    minHeight: 48,
    paddingLeft: S.md,
    paddingRight: 6,
    borderRadius: R.lg,
    backgroundColor: C.cardHi,
    borderWidth: 1,
    borderColor: C.borderHi,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  undoText: { flex: 1, color: C.text, fontFamily: F.medium, fontSize: 13 },
  undoButton: { height: 36, paddingHorizontal: S.md, borderRadius: R.md, justifyContent: 'center' },
  undoButtonText: { color: C.accent, fontFamily: F.semi, fontSize: 14 },
  mealPhotoWrap: { marginBottom: S.sm },
  mealPhoto: { width: '100%', aspectRatio: 16 / 9, maxHeight: 220, borderRadius: R.lg, backgroundColor: C.cardHi },
  mealPhotoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcal: { color: C.text, fontFamily: F.semi, fontSize: 13, fontVariant: ['tabular-nums'] },
});
