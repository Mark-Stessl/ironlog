import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountUp } from '@/components/count-up';
import { SigilView } from '@/components/sigil';
import { recordRows, sigilRows, yearSets } from '@/lib/db';
import { fmtWeight } from '@/lib/format';
import { recordBook } from '@/lib/records';
import { shareSvgImage } from '@/lib/share-image';
import { buildSigil, sigilInputs, type Sigil } from '@/lib/sigil';
import { C, F, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { yearStory, type YearStory } from '@/lib/year';

const SLIDE_MS = 6500;
const num = (n: number) => Math.round(n).toLocaleString('en-US');

type Slide = { key: string; colors: [string, string]; body: ReactNode };

/** Year in Iron: your training year as a story you tap through. */
export default function YearScreen() {
  const params = useLocalSearchParams<{ year?: string }>();
  const year = Number(params.year) || new Date().getFullYear();
  const [data] = useFocusData(async (db) => {
    const [sets, recs, rows] = await Promise.all([yearSets(db, year), recordRows(db), sigilRows(db)]);
    const book = recordBook(recs);
    const story = yearStory(year, sets, book.events);
    const counts = new Map<number, number>();
    for (const e of book.events) counts.set(e.workout_id, (counts.get(e.workout_id) ?? 0) + 1);
    const ids = new Set(story.workoutIds);
    const sigils = sigilInputs(rows, counts)
      .filter((w) => ids.has(w.id))
      .map((w) => buildSigil(w));
    return { story, sigils };
  }, year);
  if (!data) return <View style={styles.screen} />;
  return <Story story={data.story} sigils={data.sigils} />;
}

function Story({ story, sigils }: { story: YearStory; sigils: Sigil[] }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const slides = buildSlides(story, sigils, width);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = slides[Math.min(index, slides.length - 1)];
  const last = index >= slides.length - 1;

  // The bar of the current slide fills up, then the next slide comes.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    if (last || paused) return;
    progress.value = withTiming(1, { duration: SLIDE_MS, easing: Easing.linear });
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, slides.length - 1)), SLIDE_MS);
    return () => {
      clearTimeout(t);
      cancelAnimation(progress);
    };
  }, [index, paused, last, slides.length, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const go = (d: number) => setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + d)));

  return (
    <View style={styles.screen}>
      <LinearGradient
        key={slide.key}
        colors={slide.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Tap left half: back. Right half: next. Hold: pause. */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => go(-1)}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          accessibilityLabel="Previous"
        />
        <Pressable
          style={{ flex: 2 }}
          onPress={() => go(1)}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          accessibilityLabel="Next"
        />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + S.sm }]} pointerEvents="box-none">
        <View style={styles.bars} pointerEvents="none">
          {slides.map((s, i) => (
            <View key={s.key} style={styles.bar}>
              {i < index ? <View style={[styles.barFill, { width: '100%' }]} /> : null}
              {i === index ? <Animated.View style={[styles.barFill, last ? { width: '100%' } : fill]} /> : null}
            </View>
          ))}
        </View>
        <View style={styles.topRow} pointerEvents="box-none">
          <Text style={styles.brand}>IRONLOG · {story.year}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Slides only take taps on the last one (its buttons); otherwise taps go to back / next. */}
      <View
        key={slide.key}
        style={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        pointerEvents={last ? 'box-none' : 'none'}>
        {slide.body}
      </View>
    </View>
  );
}

// ── The slides ──────────────────────────────────────────────────────────

function buildSlides(y: YearStory, sigils: Sigil[], width: number): Slide[] {
  const slides: Slide[] = [];
  const soFar = y.year === new Date().getFullYear() && new Date().getMonth() < 11;

  slides.push({
    key: 'intro',
    colors: ['#04161C', '#0B3440'],
    body: (
      <>
        <Spinning>
          <View style={styles.mosaic}>
            {sigils.slice(0, 7).map((s, i) => (
              <View key={i} style={[styles.mosaicItem, mosaicSpot(i, Math.min(width - 60, 320))]}>
                <SigilView sigil={s} size={i === 0 ? 120 : 76} />
              </View>
            ))}
          </View>
        </Spinning>
        <Animated.Text entering={FadeInDown.delay(200).duration(500)} style={styles.kicker}>
          {soFar ? `${y.year} so far` : `Your ${y.year}`}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(350).duration(500)} style={styles.huge}>
          A year in iron
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(900).duration(600)} style={styles.hint}>
          Tap to start
        </Animated.Text>
      </>
    ),
  });

  if (!y.workouts) {
    slides.push({
      key: 'empty',
      colors: ['#0A0F12', '#172127'],
      body: <Line big="Nothing logged yet" sub={`Finish a workout in ${y.year} and your story starts here.`} />,
    });
    return slides;
  }

  slides.push({
    key: 'workouts',
    colors: ['#062A33', '#0E7490'],
    body: (
      <>
        <Text style={styles.kicker}>You showed up</Text>
        <CountUp value={y.workouts} style={styles.giant} duration={1400} />
        <Text style={styles.headline}>workouts</Text>
        <Animated.Text entering={FadeInUp.delay(1100).duration(500)} style={styles.sub}>
          {fmtWeight(y.hours)} hours under the bar
          {y.busiestMonth ? `. ${y.busiestMonth.month} was your busiest month, with ${y.busiestMonth.workouts}.` : '.'}
        </Animated.Text>
      </>
    ),
  });

  if (y.kg > 0)
    slides.push({
      key: 'kg',
      colors: ['#1E1033', '#5B21B6'],
      body: (
        <>
          <Text style={styles.kicker}>In total you lifted</Text>
          <CountUp value={y.kg} format={num} style={styles.giant} duration={1800} />
          <Text style={styles.headline}>kg</Text>
          {y.compare ? (
            <Animated.View entering={ZoomIn.delay(1600).springify()} style={styles.pill}>
              <Text style={styles.pillText}>
                That's {fmtWeight(y.compare.count)} {y.compare.count === 1 ? y.compare.thing : y.compare.things}
              </Text>
            </Animated.View>
          ) : null}
          <Animated.Text entering={FadeInUp.delay(1900).duration(500)} style={styles.sub}>
            {num(y.sets)} sets · {num(y.reps)} reps
          </Animated.Text>
        </>
      ),
    });

  if (y.favourite)
    slides.push({
      key: 'favourite',
      colors: ['#2A1405', '#B45309'],
      body: (
        <>
          <Text style={styles.kicker}>Your favourite</Text>
          <Animated.Text entering={ZoomIn.springify().damping(12)} style={[styles.huge, { textAlign: 'center' }]}>
            {y.favourite.name}
          </Animated.Text>
          <Text style={styles.sub}>
            {y.favourite.sets} sets{y.favourite.heaviest ? ` · up to ${fmtWeight(y.favourite.heaviest)} kg` : ''}
          </Text>
          <View style={styles.bars3}>
            {y.topMuscles.map((m, i) => (
              <Animated.View
                key={m.muscle}
                entering={FadeInDown.delay(500 + i * 200).duration(400)}
                style={styles.muscleRow}>
                <Text style={styles.muscleName}>{m.muscle}</Text>
                <View style={styles.muscleTrack}>
                  <View style={[styles.muscleFill, { width: `${Math.max(6, m.share * 100)}%` }]} />
                </View>
                <Text style={styles.musclePct}>{Math.round(m.share * 100)}%</Text>
              </Animated.View>
            ))}
          </View>
        </>
      ),
    });

  if (y.records)
    slides.push({
      key: 'records',
      colors: ['#2B1F05', '#A16207'],
      body: (
        <>
          <Ionicons name="trophy" size={44} color={C.gold} />
          <CountUp value={y.records} style={[styles.giant, { color: C.gold }]} duration={1200} />
          <Text style={styles.headline}>records broken</Text>
          <View style={{ gap: S.sm, marginTop: S.lg, alignSelf: 'stretch' }}>
            {y.bestRecords.map((e, i) => (
              <Animated.View
                key={e.exercise_id}
                entering={FadeInDown.delay(900 + i * 250).duration(400)}
                style={styles.recordRow}>
                <Text style={styles.recordName} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={styles.recordValue}>{e.detail.split('·')[0].trim()}</Text>
              </Animated.View>
            ))}
          </View>
        </>
      ),
    });

  slides.push({
    key: 'habits',
    colors: ['#04211A', '#047857'],
    body: (
      <>
        <Text style={styles.kicker}>Longest run</Text>
        <CountUp value={y.weekStreak} style={styles.giant} duration={1000} />
        <Text style={styles.headline}>{y.weekStreak === 1 ? 'week' : 'weeks in a row'}</Text>
        {y.timeOfDay ? (
          <Animated.Text entering={FadeInUp.delay(900).duration(500)} style={styles.sub}>
            You're {y.timeOfDay === 'afternoon' || y.timeOfDay === 'evening' ? 'an' : 'a'} {y.timeOfDay} lifter
            {y.favouriteDay ? `, and ${y.favouriteDay} is your day.` : '.'}
          </Animated.Text>
        ) : null}
      </>
    ),
  });

  if (y.cardio.minutes)
    slides.push({
      key: 'cardio',
      colors: ['#2A0A0E', '#BE123C'],
      body: (
        <>
          <Text style={styles.kicker}>And your heart</Text>
          <CountUp value={y.cardio.minutes} format={num} style={styles.giant} duration={1300} />
          <Text style={styles.headline}>minutes of cardio</Text>
          <Text style={styles.sub}>
            {[
              y.cardio.km ? `${fmtWeight(y.cardio.km)} km` : '',
              y.cardio.floors ? `${num(y.cardio.floors)} floors` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </>
      ),
    });

  if (sigils.length)
    slides.push({
      key: 'sigils',
      colors: ['#05070A', '#1F2937'],
      body: (
        <>
          <Text style={styles.kicker}>{sigils.length} sigils grown</Text>
          <View style={styles.grid}>
            {sigils.slice(0, 24).map((s, i) => (
              <Animated.View key={i} entering={ZoomIn.delay(i * 70).springify()}>
                <SigilView sigil={s} size={Math.floor((Math.min(width, 420) - 80) / 4)} />
              </Animated.View>
            ))}
          </View>
          <Text style={styles.sub}>One for every workout. Gold for the ones with a record.</Text>
        </>
      ),
    });

  slides.push({
    key: 'end',
    colors: ['#04161C', '#0E7490'],
    body: <Finale y={y} sigils={sigils} />,
  });
  return slides;
}

function Finale({ y, sigils }: { y: YearStory; sigils: Sigil[] }) {
  const [state, setState] = useState<string | null>(null);
  const share = async () => {
    const res = await shareSvgImage(summarySvg(y, sigils), `ironlog-${y.year}`, `My ${y.year} in Iron`);
    setState(res === 'saved' ? 'Saved as a picture' : res === 'failed' ? "Couldn't share it" : null);
  };
  return (
    <>
      <Text style={styles.kicker}>That was your {y.year}</Text>
      <View style={styles.summary}>
        <Stat value={num(y.workouts)} label="workouts" />
        <Stat value={`${num(y.kg / 1000)} t`} label="lifted" />
        <Stat value={num(y.records)} label="records" />
        <Stat value={`${num(y.weekStreak)}`} label="weeks in a row" />
      </View>
      {y.favourite ? <Text style={styles.sub}>Favourite: {y.favourite.name}</Text> : null}
      <Pressable
        onPress={share}
        accessibilityRole="button"
        style={({ pressed }) => [styles.share, pressed && { opacity: 0.85 }]}>
        <Ionicons name="share-outline" size={18} color={C.onAccent} />
        <Text style={styles.shareText}>Share your year</Text>
      </Pressable>
      {state ? <Text style={styles.sub}>{state}</Text> : null}
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: S.md }}>
        <Text style={[styles.sub, { textDecorationLine: 'underline' }]}>Close</Text>
      </Pressable>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Line({ big, sub }: { big: string; sub: string }) {
  return (
    <>
      <Text style={[styles.huge, { textAlign: 'center' }]}>{big}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </>
  );
}

/** Slowly turning sigils on the first slide. */
function Spinning({ children }: { children: ReactNode }) {
  const turn = useSharedValue(0);
  const ref = useRef(turn);
  useEffect(() => {
    const t = ref.current;
    t.value = withRepeat(withTiming(360, { duration: 60_000, easing: Easing.linear }), -1);
    return () => cancelAnimation(t);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return <Animated.View style={[{ marginBottom: S.xl }, style]}>{children}</Animated.View>;
}

function mosaicSpot(i: number, box: number) {
  if (i === 0) return { left: box / 2 - 60, top: box / 2 - 60 };
  const a = ((i - 1) / 6) * Math.PI * 2;
  const r = box / 2 - 38;
  return { left: box / 2 - 38 + Math.cos(a) * r, top: box / 2 - 38 + Math.sin(a) * r };
}

/** The share picture: the year's numbers and a row of sigils. */
function summarySvg(y: YearStory, sigils: Sigil[]): string {
  const W = 1080;
  const H = 1350;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const stat = (x: number, yPos: number, value: string, label: string) =>
    `<text x="${x}" y="${yPos}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="96" fill="#FFFFFF">${esc(value)}</text>` +
    `<text x="${x}" y="${yPos + 50}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="#9FE7F5">${esc(label)}</text>`;
  const row = sigils
    .slice(0, 5)
    .map((s, i) => {
      const shapes = s.shapes
        .map((sh) => {
          const common = `fill="${sh.fill}" fill-opacity="${sh.opacity}"${sh.stroke ? ` stroke="${sh.stroke}" stroke-width="${sh.strokeWidth ?? 1}" stroke-opacity="${sh.opacity}"` : ''}`;
          return sh.kind === 'path'
            ? `<path d="${sh.d}" ${common}/>`
            : `<circle cx="${sh.cx}" cy="${sh.cy}" r="${sh.r}" ${common}/>`;
        })
        .join('');
      return `<g transform="translate(${70 + i * 192},1010) scale(0.88)">${shapes}</g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#04161C"/><stop offset="1" stop-color="#0E7490"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<text x="80" y="150" font-family="Helvetica, Arial, sans-serif" font-size="40" letter-spacing="6" fill="#9FE7F5">IRONLOG</text>
<text x="80" y="250" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="92" fill="#FFFFFF">My ${y.year} in iron</text>
${stat(290, 470, num(y.workouts), 'workouts')}${stat(790, 470, `${num(y.kg / 1000)} t`, 'lifted')}
${stat(290, 720, num(y.records), 'records')}${stat(790, 720, num(y.weekStreak), 'weeks in a row')}
${y.favourite ? `<text x="540" y="900" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#E8EEF1">Favourite: ${esc(y.favourite.name)}</text>` : ''}
${row}
</svg>`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#04161C' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: S.md, gap: S.sm, zIndex: 5 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: 'rgba(255,255,255,0.75)', fontFamily: F.semi, fontSize: 12, letterSpacing: 2 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.xl, gap: S.sm },
  kicker: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: F.semi,
    fontSize: 15,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  giant: { color: '#fff', fontFamily: F.display, fontSize: 104, lineHeight: 112, fontVariant: ['tabular-nums'] },
  huge: { color: '#fff', fontFamily: F.display, fontSize: 40, lineHeight: 46 },
  headline: { color: '#fff', fontFamily: F.display, fontSize: 30 },
  sub: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: F.medium,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: S.sm,
  },
  hint: { color: 'rgba(255,255,255,0.55)', fontFamily: F.medium, fontSize: 14, marginTop: S.xl },
  pill: {
    marginTop: S.md,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  pillText: { color: '#fff', fontFamily: F.semi, fontSize: 18 },
  mosaic: { width: 320, height: 320 },
  mosaicItem: { position: 'absolute' },
  bars3: { alignSelf: 'stretch', gap: S.sm, marginTop: S.xl },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  muscleName: { color: '#fff', fontFamily: F.semi, fontSize: 14, width: 90 },
  muscleTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  muscleFill: { height: '100%', borderRadius: 5, backgroundColor: '#FCD34D' },
  musclePct: { color: '#fff', fontFamily: F.semi, fontSize: 13, width: 40, textAlign: 'right' },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  recordName: { flex: 1, color: '#fff', fontFamily: F.semi, fontSize: 15 },
  recordValue: { color: C.gold, fontFamily: F.semi, fontSize: 15 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginVertical: S.lg,
    maxWidth: 420,
  },
  summary: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: S.lg },
  stat: { width: '50%', alignItems: 'center', paddingVertical: S.md },
  statValue: { color: '#fff', fontFamily: F.display, fontSize: 44 },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontFamily: F.medium, fontSize: 14 },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 28,
    borderRadius: 27,
    backgroundColor: C.accent,
    marginTop: S.lg,
  },
  shareText: { color: C.onAccent, fontFamily: F.semi, fontSize: 17 },
});
