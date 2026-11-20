import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type PressableStateCallbackType } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { BodyMap } from '@/components/body-map';
import { SigilView } from '@/components/sigil';
import { CountUp } from '@/components/count-up';
import { MuscleBars } from '@/components/muscle-bars';
import { RadarChart } from '@/components/radar-chart';
import { Card, Chip, Empty, Page, SectionTitle, text, type IconName } from '@/components/ui';
import { backupDue } from '@/lib/backup';
import { dayKey, dayStreak } from '@/lib/calendar';
import {
  getSetting,
  latestMeasurements,
  listExercises,
  recordRows,
  sigilRows,
  listMeasurements,
  listRestDays,
  profileTotals,
  setSetting,
  statSets,
  trainingTime,
  workoutsBetween,
} from '@/lib/db';
import { fmtMeasure, WEIGHT } from '@/lib/measures';
import { dailyTotals, getGoals, waterBetween } from '@/lib/food-db';
import { fmtAgo, fmtDurationShort, fmtVolume, plural } from '@/lib/format';
import { groupRecords, recordBook } from '@/lib/records';
import { buildSigil, sigilInputs } from '@/lib/sigil';
import { nutritionSummary, weightChange } from '@/lib/overview';
import { GROUPS, heat, muscleStats, periodRange, type Period } from '@/lib/stats';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { choose } from '@/lib/dialog';
import { haptic } from '@/lib/haptics';
import { pickPhoto } from '@/lib/photo';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export default function ProfileTab() {
  const desktop = useIsDesktop();
  const [period, setPeriod] = useState<Period>('month');
  const range = periodRange(period);
  const periodName = range.label.toLowerCase().startsWith('this') ? range.label.toLowerCase() : range.label;

  const [data] = useFocusData(async (db) => {
    const days = { from: dayKey(range.from), to: dayKey(range.to) };
    const prevDays = { from: dayKey(range.prevFrom), to: dayKey(range.from - 1) };
    const [cur, prev, time, prevTime, food, prevFood, water, prevWater, goals, weights] = await Promise.all([
      statSets(db, range.from, range.to + 1),
      statSets(db, range.prevFrom, range.from),
      trainingTime(db, range.from, range.to + 1),
      trainingTime(db, range.prevFrom, range.from),
      dailyTotals(db, days.from, days.to),
      dailyTotals(db, prevDays.from, prevDays.to),
      waterBetween(db, days.from, days.to),
      waterBetween(db, prevDays.from, prevDays.to),
      getGoals(db),
      listMeasurements(db, WEIGHT.key),
    ]);
    return {
      now: muscleStats(cur),
      before: muscleStats(prev),
      time,
      prevTime,
      eat: nutritionSummary(food, water, goals),
      eatBefore: nutritionSummary(prevFood, prevWater, goals),
      weight: weightChange(weights, range.from, range.to + 1),
      weightBefore: weightChange(weights, range.prevFrom, range.from),
    };
  }, period);

  const [profile] = useFocusData(async (db) => {
    const [name, totals, exercises, latest, workouts, rest] = await Promise.all([
      getSetting(db, 'profile_name', ''),
      profileTotals(db),
      listExercises(db),
      latestMeasurements(db),
      workoutsBetween(db, 0, Date.now() + 1),
      listRestDays(db),
    ]);
    const lastBackup = Number(await getSetting(db, 'last_backup', '0')) || null;
    const photo = await getSetting(db, 'profile_photo', '');
    const book = recordBook(await recordRows(db));
    const counts = new Map<number, number>();
    for (const e of book.events) counts.set(e.workout_id, (counts.get(e.workout_id) ?? 0) + 1);
    const sigilList = sigilInputs(await sigilRows(db), counts);
    const streak = dayStreak(new Set([...workouts.map((w) => dayKey(w.started_at)), ...rest]));
    return {
      name,
      photo,
      sigil: sigilList[0] ? buildSigil(sigilList[0]) : null,
      sigilCount: sigilList.length,
      records: {
        count: book.events.length,
        latest: groupRecords(book.events).slice(0, 3),
        exercises: book.bests.length,
      },
      totals,
      exercises: exercises.length,
      weight: latest[WEIGHT.key]?.value,
      streak,
      backupDue: backupDue(lastBackup) && totals.workouts > 0,
    };
  });

  const now = data?.now;
  const before = data?.before;
  const empty = data && now?.sets === 0;

  return (
    <Page maxWidth={1000} topInset>
      {profile ? (
        <>
          <ProfileHead
            name={profile.name}
            photo={profile.photo}
            first={profile.totals.first}
            backupDue={profile.backupDue}
          />
          <View style={styles.totals}>
            <Total label="Workouts" value={profile.totals.workouts} big />
            <Total label="Total volume" value={profile.totals.volume} format={fmtVolume} />
            <Total label="Sets" value={profile.totals.sets} />
          </View>
          <View style={styles.shortcuts}>
            <Shortcut icon="search" label="Exercises" sub={`${profile.exercises} in library`} href="/exercises" />
            <Shortcut
              icon="calendar"
              label="Calendar"
              sub={profile.streak ? `${profile.streak} day streak` : 'Track rest days'}
              href="/calendar"
            />
            <Shortcut
              icon="body"
              label="Measures"
              sub={profile.weight != null ? fmtMeasure(profile.weight, 'kg') : 'Weight & body'}
              href="/measures"
            />
          </View>
          <RecordsCard {...profile.records} />
          <View style={styles.tiles}>
            <Pressable
              onPress={() => router.push('/sigils')}
              accessibilityRole="button"
              accessibilityLabel="Your sigils"
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
              {profile.sigil ? (
                <SigilView sigil={profile.sigil} size={46} />
              ) : (
                <Ionicons name="sparkles" size={30} color={C.accent} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={text.strong}>Sigils</Text>
                <Text style={text.faint} numberOfLines={1}>
                  {profile.sigilCount ? `${profile.sigilCount} grown` : 'One per workout'}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => router.push('/year')}
              accessibilityRole="button"
              accessibilityLabel={`Year in Iron ${new Date().getFullYear()}`}
              style={({ pressed }) => [styles.tile, styles.yearTile, pressed && { opacity: 0.85 }]}>
              <LinearGradient
                colors={['#0B3440', '#5B21B6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="play-circle" size={30} color="#fff" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[text.strong, { color: '#fff' }]}>Year in Iron</Text>
                <Text style={[text.faint, { color: 'rgba(255,255,255,0.75)' }]} numberOfLines={1}>
                  Your {new Date().getFullYear()} story
                </Text>
              </View>
            </Pressable>
          </View>
        </>
      ) : null}

      <SectionTitle title="Statistics" />
      <Text style={[text.dim, { marginTop: -S.xs }]}>{`${range.label} compared with ${range.prevLabel}`}</Text>
      <View style={styles.periods}>
        {PERIODS.map((p) => (
          <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />
        ))}
      </View>

      {now && before ? (
        <Animated.View key={period} entering={FadeInDown.duration(300)} style={styles.summary}>
          <Summary label="Workouts" value={now.workouts} prev={before.workouts} />
          <Summary label="Time" value={data.time} prev={data.prevTime} format={(n) => fmtDurationShort(n)} />
          <Summary label="Volume" value={now.volume} prev={before.volume} format={(n) => fmtVolume(n)} />
          <Summary label="Sets" value={now.sets} prev={before.sets} />
        </Animated.View>
      ) : null}

      {empty ? (
        <Empty
          icon="stats-chart-outline"
          title={`No workouts in ${periodName} yet`}
          hint="Finish a workout and your muscle distribution shows up here."
        />
      ) : now && before ? (
        <View style={[{ gap: S.md }, desktop && styles.columns]}>
          <View style={desktop ? styles.column : undefined}>
            <SectionTitle title="Muscle distribution" />
            <Card style={styles.chartCard}>
              <RadarChart axes={GROUPS} values={now.groups} compare={before.groups} size={desktop ? 340 : 300} />
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: C.accent }]} />
                  <Text style={text.faint}>{range.label}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.swatch, styles.swatchDashed]} />
                  <Text style={text.faint}>{range.prevLabel}</Text>
                </View>
              </View>
            </Card>
          </View>
          <View style={desktop ? styles.column : undefined}>
            <SectionTitle title="Body heatmap" />
            <Card style={[styles.chartCard, { gap: S.lg }]}>
              <BodyMap heat={heat(now.regions)} height={desktop ? 300 : 260} />
              <MuscleBars regions={now.regions} count={8} />
            </Card>
          </View>
        </View>
      ) : null}

      {data ? (
        <Animated.View key={`eat-${period}`} entering={FadeInDown.delay(60).duration(300)} style={{ gap: S.sm }}>
          <SectionTitle
            title="Eating and body"
            right={
              <Text style={text.faint}>
                {data.eat.days
                  ? `${data.eat.days} ${data.eat.days === 1 ? 'day' : 'days'} logged`
                  : 'Nothing logged yet'}
              </Text>
            }
          />
          <View style={styles.summary}>
            <Summary
              label="Calories per day"
              noPrev={data.eatBefore.days ? undefined : `Nothing logged in ${range.prevLabel}`}
              value={data.eat.kcal}
              prev={data.eatBefore.kcal}
              format={(n) => `${Math.round(n).toLocaleString('en-US')} kcal`}
              neutral
            />
            <Summary
              label="Protein per day"
              noPrev={data.eatBefore.days ? undefined : `Nothing logged in ${range.prevLabel}`}
              value={data.eat.protein}
              prev={data.eatBefore.protein}
              format={(n) => `${Math.round(n)} g`}
            />
            <Summary
              label="Days on calorie goal"
              noPrev={data.eatBefore.days ? undefined : `Nothing logged in ${range.prevLabel}`}
              value={data.eat.onTarget}
              prev={data.eatBefore.onTarget}
              suffix={data.eat.days ? ` / ${data.eat.days}` : undefined}
            />
            <Summary
              label="Days on protein goal"
              noPrev={data.eatBefore.days ? undefined : `Nothing logged in ${range.prevLabel}`}
              value={data.eat.proteinDays}
              prev={data.eatBefore.proteinDays}
              suffix={data.eat.days ? ` / ${data.eat.days}` : undefined}
            />
            <Summary
              label="Water per day"
              noPrev={data.eatBefore.waterMl ? undefined : `No water logged in ${range.prevLabel}`}
              value={data.eat.waterMl}
              prev={data.eatBefore.waterMl}
              format={(n) => `${(n / 1000).toFixed(1)} L`}
            />
            <View style={styles.summaryCard}>
              <Text style={text.faint}>Weight</Text>
              <Text style={styles.summaryValue}>
                {data.weight
                  ? fmtMeasure(data.weight.now, 'kg')
                  : profile?.weight != null
                    ? fmtMeasure(profile.weight, 'kg')
                    : '–'}
              </Text>
              <Text style={[styles.delta, { color: C.textDim }]} numberOfLines={1}>
                {data.weight
                  ? data.weight.change === 0
                    ? `No change in ${periodName}`
                    : `${data.weight.change > 0 ? '▲' : '▼'} ${Math.abs(data.weight.change).toFixed(1)} kg in ${periodName}`
                  : 'Weigh in twice for a trend'}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </Page>
  );
}

type PressState = PressableStateCallbackType & { hovered?: boolean };

function ProfileHead({
  name: saved,
  photo: savedPhoto,
  first,
  backupDue: due,
}: {
  name: string;
  photo: string;
  first: number | null;
  backupDue: boolean;
}) {
  const db = useSQLiteContext();
  const [name, setName] = useState(saved);
  const [focused, setFocused] = useState(false);
  const [textWidth, setTextWidth] = useState(0);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  useEffect(() => setName(saved), [saved]);
  const save = () => setSetting(db, 'profile_name', name.trim());

  // Profile picture: take one or pick one you already have; it stays on this phone.
  const [photo, setPhoto] = useState(savedPhoto);
  useEffect(() => setPhoto(savedPhoto), [savedPhoto]);
  const changePhoto = async () => {
    if (photo) {
      const pick = await choose({
        title: 'Profile picture',
        cancelLabel: 'Cancel',
        icon: 'person-circle-outline',
        choices: [
          { label: 'New photo', value: 'new', icon: 'camera-outline', primary: true },
          { label: 'Remove photo', value: 'remove', icon: 'trash-outline' },
        ],
      });
      if (pick === 'remove') {
        setPhoto('');
        await setSetting(db, 'profile_photo', '');
        return;
      }
      if (pick !== 'new') return;
    }
    const img = await pickPhoto({ title: 'Profile picture', square: true, width: 360 });
    if (!img) return;
    haptic.success();
    setPhoto(img);
    await setSetting(db, 'profile_photo', img);
  };
  const since = first
    ? `Training since ${new Date(first).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    : 'Your first workout starts the story';

  return (
    <View style={styles.head}>
      <Pressable
        onPress={changePhoto}
        accessibilityRole="button"
        accessibilityLabel={photo ? 'Change profile picture' : 'Add a profile picture'}
        style={({ pressed }) => pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }}>
        <Avatar photo={photo} name={name} size={64} />
        <View style={styles.cameraBadge}>
          <Ionicons name="camera" size={12} color={C.onAccent} />
        </View>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={[styles.nameWrap, focused && styles.nameWrapFocused]}>
          {/* Invisible copy of the name to size the field, so the pencil sits right after it. */}
          <Text
            style={[styles.name, styles.measure]}
            pointerEvents="none"
            onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            {name || 'Your name'}
          </Text>
          <TextInput
            ref={input}
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              save();
            }}
            onSubmitEditing={save}
            placeholder="Your name"
            placeholderTextColor={C.textFaint}
            returnKeyType="done"
            maxLength={40}
            accessibilityLabel="Your name"
            style={[styles.name, textWidth ? { width: textWidth + 6 } : null]}
          />
          {!focused ? (
            <Pressable onPress={() => input.current?.focus()} hitSlop={12} accessibilityLabel="Edit your name">
              <Ionicons name="pencil" size={14} color={C.textDim} />
            </Pressable>
          ) : null}
        </View>
        <Text style={text.dim}>{since}</Text>
      </View>
      <Pressable
        onPress={() => router.push('/settings')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={due ? 'Settings (a backup is due)' : 'Settings'}
        style={({ pressed }) => [styles.cog, pressed && { transform: [{ scale: 0.94 }], opacity: 0.85 }]}>
        <Ionicons name="settings-outline" size={23} color={C.accent} />
        {due ? <View style={styles.cogDot} /> : null}
      </Pressable>
    </View>
  );
}

function Total({
  label,
  value,
  big,
  format = (n) => Math.round(n).toLocaleString('en-US'),
}: {
  label: string;
  value: number;
  big?: boolean;
  format?: (n: number) => string;
}) {
  return (
    <View style={[styles.total, big && styles.totalBig]}>
      <CountUp value={value} format={format} style={[styles.totalValue, big && { color: C.accent }]} />
      <Text style={text.faint} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Personal records: how many, and the latest ones. Opens the records page. */
function RecordsCard({
  count,
  latest,
  exercises,
}: {
  count: number;
  latest: ReturnType<typeof groupRecords>;
  exercises: number;
}) {
  return (
    <Pressable
      onPress={() => router.push('/records')}
      accessibilityRole="button"
      accessibilityLabel={`Personal records, ${count}`}
      style={(s: PressState) => [
        styles.records,
        s.hovered && { backgroundColor: 'rgba(233,190,88,0.1)' },
        s.pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}>
      <View style={styles.recordsHead}>
        <View style={styles.recordsIcon}>
          <Ionicons name="trophy" size={17} color={C.gold} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={text.strong}>Personal records</Text>
          <Text style={text.faint} numberOfLines={1}>
            {count
              ? `${plural(count, 'record')} broken · bests for ${plural(exercises, 'exercise')}`
              : exercises
                ? `Bests for ${plural(exercises, 'exercise')} · beat one for a record`
                : 'Your best lifts show up after your first workout'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
      </View>
      {latest.map((e) => (
        <View key={e.key} style={styles.recordLine}>
          <Text style={[text.body, { flex: 1, minWidth: 0, fontFamily: F.semi }]} numberOfLines={1}>
            {e.name}
          </Text>
          <Text style={[text.body, { color: C.gold }]} numberOfLines={1}>
            {e.kinds.join(' + ')}
          </Text>
          <Text style={[text.faint, { minWidth: 62, textAlign: 'right' }]}>{fmtAgo(e.date)}</Text>
        </View>
      ))}
    </Pressable>
  );
}

function Shortcut({ icon, label, sub, href }: { icon: IconName; label: string; sub: string; href: Href }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(s: PressState) => [
        styles.shortcut,
        s.hovered && { borderColor: C.accentLine, backgroundColor: C.cardHi },
        s.pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
      ]}>
      <View style={styles.shortcutIcon}>
        <Ionicons name={icon} size={17} color={C.accent} />
      </View>
      <Text style={text.strong} numberOfLines={1}>
        {label}
      </Text>
      <Text style={text.faint} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

function Summary({
  label,
  value,
  prev,
  format = (n) => String(Math.round(n)),
  suffix,
  neutral,
  noPrev,
}: {
  label: string;
  value: number;
  prev: number;
  format?: (n: number) => string;
  /** Text after the number, e.g. " / 12". */
  suffix?: string;
  /** More isn't better (calories): don't color an increase green. */
  neutral?: boolean;
  /** Shown instead of the comparison when the previous period has no data. */
  noPrev?: string;
}) {
  const diff = format(value) === format(prev) ? 0 : value - prev;
  const up = diff > 0;
  return (
    <View style={styles.summaryCard}>
      <Text style={text.faint}>{label}</Text>
      <CountUp value={value} format={suffix ? (n) => format(n) + suffix : format} style={styles.summaryValue} />
      <Text
        style={[styles.delta, { color: diff === 0 || noPrev ? C.textFaint : up && !neutral ? C.good : C.textDim }]}
        numberOfLines={1}>
        {noPrev ?? (diff === 0 ? 'Same as before' : `${up ? '▲' : '▼'} ${format(Math.abs(diff))}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cog: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentLine,
  },
  cogDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.gold,
    borderWidth: 2,
    borderColor: C.bg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.lg,
    marginTop: S.xs,
    marginBottom: S.sm,
  },
  tiles: { flexDirection: 'row', gap: S.sm, marginTop: S.sm },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
    minHeight: 72,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    overflow: 'hidden',
  },
  yearTile: { borderColor: 'transparent' },
  records: {
    gap: S.sm,
    marginTop: S.sm,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: 'rgba(233,190,88,0.4)',
    backgroundColor: 'rgba(233,190,88,0.06)',
  },
  recordsHead: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  recordsIcon: {
    width: 34,
    height: 34,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(233,190,88,0.14)',
  },
  recordLine: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingLeft: 46 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderWidth: 2,
    borderColor: C.bg,
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  // Invisible copy of the name used to size the field: it must never catch taps meant for the field.
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0, zIndex: -1, pointerEvents: 'none' },
  nameWrapFocused: { borderBottomColor: C.accentLine },
  name: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 24,
    letterSpacing: -0.6,
    paddingVertical: 2,
    minWidth: 60,
    flexShrink: 1,
    outlineStyle: 'none',
  } as never,
  totals: { flexDirection: 'row', gap: S.sm },
  total: {
    flex: 1,
    gap: 2,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  totalBig: { borderColor: C.accentLine, backgroundColor: C.accentDim },
  totalValue: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 20,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  shortcuts: { flexDirection: 'row', gap: S.sm, marginTop: S.xs },
  shortcut: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  shortcutIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  periods: { flexDirection: 'row', gap: 6, marginBottom: S.xs },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 140,
    gap: 3,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  summaryValue: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 20,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  delta: { fontFamily: F.medium, fontSize: 11 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: S.lg },
  column: { flex: 1, minWidth: 0 },
  chartCard: { paddingVertical: S.lg, alignItems: 'stretch' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: S.lg,
    marginTop: S.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
  swatchDashed: {
    backgroundColor: 'transparent',
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.textFaint,
    height: 0,
  },
});
