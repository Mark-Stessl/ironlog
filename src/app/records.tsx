import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ExerciseImage } from '@/components/exercise-image';
import { Card, Chip, Empty, ListCard, ListRow, Page, PageHeader, SectionTitle, text } from '@/components/ui';
import { recordRows } from '@/lib/db';
import { fmtAgo, fmtCardio, fmtVolume, fmtWeight, plural } from '@/lib/format';
import { recordBook, type ExerciseBest, type RecordEvent } from '@/lib/records';
import { C, F, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type Sort = 'recent' | 'heaviest' | 'name';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'heaviest', label: 'Heaviest' },
  { key: 'name', label: 'A–Z' },
];
const RECENT = 8;

/** Personal records: the latest records you broke, and the best of every exercise. */
export default function RecordsScreen() {
  const [book] = useFocusData(async (db) => recordBook(await recordRows(db)));
  const [sort, setSort] = useState<Sort>('recent');
  const [showAll, setShowAll] = useState(false);

  if (!book) return <Page maxWidth={760}>{null}</Page>;
  const { bests, events } = book;
  const monthAgo = Date.now() - 30 * 86_400_000;
  const thisMonth = events.filter((e) => e.date >= monthAgo).length;

  const sorted = [...bests].sort((a, b) =>
    sort === 'name'
      ? a.name.localeCompare(b.name)
      : sort === 'heaviest'
        ? (b.heaviest?.weight ?? -1) - (a.heaviest?.weight ?? -1)
        : b.last - a.last,
  );
  const recent = showAll ? events : events.slice(0, RECENT);

  return (
    <Page maxWidth={760}>
      <PageHeader title="Personal records" sub="Your best lifts and runs, and when you set them" />

      {bests.length === 0 ? (
        <Empty
          icon="trophy-outline"
          title="No records yet"
          hint="Finish a workout and your best for every exercise shows up here. Beat it next time for a record."
        />
      ) : (
        <>
          <View style={styles.stats}>
            <Stat value={events.length} label="records broken" gold />
            <Stat value={thisMonth} label="in the last 30 days" />
            <Stat value={bests.length} label="exercises logged" />
          </View>

          <SectionTitle title="Latest records" />
          {events.length === 0 ? (
            <Text style={text.faint}>
              Your first session of an exercise sets the bar. Beat it in a later workout and the record shows up here.
            </Text>
          ) : (
            <ListCard>
              {recent.map((e, i) => (
                <EventRow key={`${e.workout_id}-${e.exercise_id}-${e.kind}`} e={e} last={i === recent.length - 1} />
              ))}
              {events.length > RECENT ? (
                <ListRow last onPress={() => setShowAll((x) => !x)}>
                  <Text style={[text.body, { flex: 1, color: C.accent }]}>
                    {showAll ? 'Show fewer' : `Show all ${events.length}`}
                  </Text>
                  <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color={C.accent} />
                </ListRow>
              ) : null}
            </ListCard>
          )}

          <SectionTitle title="Best per exercise" />
          <View style={styles.sorts}>
            {SORTS.map((s) => (
              <Chip key={s.key} label={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />
            ))}
          </View>
          <ListCard>
            {sorted.map((b, i) => (
              <BestRow key={b.exercise_id} b={b} last={i === sorted.length - 1} />
            ))}
          </ListCard>
        </>
      )}
    </Page>
  );
}

function Stat({ value, label, gold }: { value: number; label: string; gold?: boolean }) {
  return (
    <Card style={[styles.stat, gold && styles.statGold]}>
      {gold ? <Ionicons name="trophy" size={16} color={C.gold} /> : null}
      <Text style={[styles.statValue, gold && { color: C.gold }]}>{value}</Text>
      <Text style={text.faint} numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

function EventRow({ e, last }: { e: RecordEvent; last: boolean }) {
  return (
    <ListRow last={last} onPress={() => openExercise(e.exercise_id)} style={{ alignItems: 'flex-start' }}>
      <View style={styles.trophy}>
        <Ionicons name="trophy" size={14} color={C.gold} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={text.strong} numberOfLines={1}>
          {e.name}
        </Text>
        <Text style={[text.body, { color: C.gold, fontFamily: F.semi }]} numberOfLines={1}>
          {e.title}
        </Text>
        <Text style={text.faint} numberOfLines={1}>
          {e.detail}
        </Text>
      </View>
      <Text style={text.faint}>{fmtAgo(e.date)}</Text>
    </ListRow>
  );
}

function BestRow({ b, last }: { b: ExerciseBest; last: boolean }) {
  const cardio = b.track !== 'weight_reps';
  const floors = b.track === 'time_floors';
  const main = cardio
    ? fmtCardio(b.longest?.seconds, b.farthest?.distance, floors)
    : b.heaviest
      ? b.heaviest.weight > 0
        ? `${fmtWeight(b.heaviest.weight)} kg × ${b.heaviest.reps}`
        : `${b.heaviest.reps} reps`
      : '—';
  const sub = cardio
    ? `Longest ${fmtCardio(b.longest?.seconds, null, floors)} · ${plural(b.sessions, 'session')}`
    : [
        b.e1rm ? `1RM ${fmtWeight(b.e1rm.value)} kg` : null,
        b.bestSession && b.bestSession.volume > 0 ? `best session ${fmtVolume(b.bestSession.volume)}` : null,
        plural(b.sessions, 'session'),
      ]
        .filter(Boolean)
        .join(' · ');
  return (
    <ListRow last={last} onPress={() => openExercise(b.exercise_id)}>
      <ExerciseImage name={b.name} equipment={b.equipment} size={36} radius={8} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={text.strong} numberOfLines={1}>
          {b.name}
        </Text>
        <Text style={text.faint} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Text style={styles.best}>{main}</Text>
    </ListRow>
  );
}

const openExercise = (id: number) => router.push({ pathname: '/exercise/[id]', params: { id: String(id) } });

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: S.sm },
  stat: { flex: 1, gap: 2, padding: S.md },
  statGold: { borderColor: 'rgba(233,190,88,0.45)', backgroundColor: 'rgba(233,190,88,0.07)' },
  statValue: { color: C.text, fontFamily: F.display, fontSize: 24 },
  sorts: { flexDirection: 'row', gap: S.sm, marginBottom: S.xs },
  trophy: {
    width: 28,
    height: 28,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(233,190,88,0.12)',
  },
  best: { color: C.text, fontFamily: F.semi, fontSize: 14, fontVariant: ['tabular-nums'] },
});
