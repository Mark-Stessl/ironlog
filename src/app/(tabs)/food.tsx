import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, LinearTransition } from 'react-native-reanimated';

import { CalorieRing, DetailBars, EnergySplit, MacroBars, MicroBars, WeekBars } from '@/components/nutrition-charts';
import { FoodThumb, type ThumbData } from '@/components/food-thumb';
import { Card, IconButton, ListCard, ListRow, Page, SectionTitle, text, type IconName } from '@/components/ui';
import { WaterCard } from '@/components/water-card';
import { addDays, dayKey, dayStart, relativeDay } from '@/lib/calendar';
import {
  addWater,
  copyMeal,
  dailyTotals,
  dayLog,
  dayMealPhotos,
  dayWater,
  deleteLogEntries,
  deleteLogEntry,
  deleteSavedMeal,
  getGoalSettings,
  goalsFrom,
  logSavedMeal,
  restoreLogEntry,
  saveMeal,
  savedMeals,
  setMealPhoto,
  thumbsFor,
  undoWater,
  type LogEntry,
  type SavedMeal,
} from '@/lib/food-db';
import { haptic } from '@/lib/haptics';
import { pickPhoto } from '@/lib/photo';
import { sum } from '@/lib/nutrition';
import { MEALS, mealLabel, type Meal } from '@/lib/recipes';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type Toast = { id: number; text: string; icon: IconName; undo?: () => Promise<void> };

export default function FoodTab() {
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const today = dayKey(Date.now());
  const [day, setDay] = useState(today);

  const [data, reload] = useFocusData(async (d) => {
    const from = addDays(day, -6);
    const [log, yesterday, water, settings, week, photos, saved] = await Promise.all([
      dayLog(d, day),
      dayLog(d, addDays(day, -1)),
      dayWater(d, day),
      getGoalSettings(d),
      dailyTotals(d, from, day),
      dayMealPhotos(d, day),
      savedMeals(d),
    ]);
    const thumbs = await thumbsFor(
      d,
      log.map((e) => e.ref),
    );
    return { log, yesterday, water, settings, goals: goalsFrom(settings), week, photos, thumbs, saved };
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
    showToast({ text: `Removed ${e.name}`, icon: 'trash-outline', undo: () => restoreLogEntry(db, e) });
    reload();
  };

  const saveUsual = async (meal: Meal) => {
    const res = await saveMeal(db, day, meal);
    if (!res) return;
    haptic.success();
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

  const addSaved = async (m: SavedMeal, meal: Meal) => {
    const ids = await logSavedMeal(db, m.id, day, meal);
    haptic.success();
    showToast({ text: `Added ${m.name}`, icon: 'checkmark-circle', undo: () => deleteLogEntries(db, ids) });
    reload();
  };

  const addMealPhoto = async (meal: Meal) => {
    const img = await pickPhoto();
    if (!img) return;
    await setMealPhoto(db, day, meal, img);
    haptic.tap();
    reload();
  };

  const openAdd = (meal: Meal) => router.push({ pathname: '/food-add', params: { meal, day } });

  const drink = async (ml: number) => {
    const before = data?.water ?? 0;
    await addWater(db, day, ml);
    if (goals && before < goals.waterMl && before + ml >= goals.waterMl) haptic.success();
    else haptic.tap();
    reload();
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(day, i - 6);
    return {
      day: k,
      label: new Date(dayStart(k)).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
      kcal: data?.week.get(k)?.kcal ?? 0,
    };
  });

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
                  <IconButton
                    icon="camera-outline"
                    label={`Photo of ${m.label.toLowerCase()}`}
                    onPress={() => addMealPhoto(m.key)}
                  />
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
                    <Pressable
                      key={x.id}
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
                  ))}
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );

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
      <SectionTitle title="Last 7 days" />
      <Card>
        <WeekBars days={week} goal={goals.kcal} selected={day} onSelect={setDay} />
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
          <IconButton icon="options-outline" label="Nutrition goals" onPress={() => router.push('/nutrition-goals')} />
        </View>

        <View style={styles.dayNav}>
          <IconButton icon="chevron-back" label="Previous day" onPress={() => setDay(addDays(day, -1))} />
          <Pressable onPress={() => setDay(today)} accessibilityRole="button" accessibilityLabel="Go to today">
            <Animated.Text key={day} entering={FadeIn.duration(200)} style={styles.day}>
              {relativeDay(day)}
            </Animated.Text>
          </Pressable>
          <IconButton
            icon="chevron-forward"
            label="Next day"
            onPress={() => day < today && setDay(addDays(day, 1))}
            color={day < today ? C.textDim : C.border}
          />
        </View>

        {desktop ? (
          <View style={styles.columns}>
            <View style={{ flex: 1.15, minWidth: 0 }}>
              {summary}
              {meals}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>{side}</View>
          </View>
        ) : (
          <>
            {summary}
            {meals}
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
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.xs },
  day: { color: C.text, fontFamily: F.displaySemi, fontSize: 16 },
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
  usual: {
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
