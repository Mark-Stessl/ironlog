import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExerciseImage } from '@/components/exercise-image';
import { Button, Card, Empty, text } from '@/components/ui';
import { computeRecords, getExercise, getExerciseHistory } from '@/lib/db';
import { formVideoUrl, getMedia, REPDB_URL } from '@/lib/exercise-media';
import { fmtDate, fmtSet, fmtVolume, fmtWeight } from '@/lib/format';
import { C, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);
  const [data] = useFocusData(
    async (db) => ({
      exercise: await getExercise(db, exerciseId),
      sessions: await getExerciseHistory(db, exerciseId),
    }),
    exerciseId,
  );

  if (!data) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!data.exercise) return <Empty icon="alert-circle-outline" title="Exercise not found" />;

  const { exercise, sessions } = data;
  const rec = computeRecords(sessions);
  const media = getMedia(exercise.name);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: '' }} />

      {media ? (
        <View style={styles.hero}>
          <ExerciseImage name={exercise.name} equipment={exercise.equipment} size={300} radius={R.lg} animate />
        </View>
      ) : null}

      <Text style={text.h1}>{exercise.name}</Text>
      <Text style={text.dim}>
        {exercise.muscle} · {exercise.equipment}
        {exercise.is_custom ? ' · Custom' : ''}
      </Text>

      <Button
        label="Watch a form video"
        icon="logo-youtube"
        kind="secondary"
        onPress={() => Linking.openURL(formVideoUrl(exercise.name))}
        style={{ marginTop: S.md }}
      />

      {media ? (
        <>
          <Text style={[text.body, { color: C.textDim, marginTop: S.md, lineHeight: 22 }]}>{media.description}</Text>

          <Text style={[text.label, { marginTop: S.lg }]}>How to do it</Text>
          <Card style={{ gap: S.md }}>
            {media.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={[text.body, { flex: 1, lineHeight: 22 }]}>{step}</Text>
              </View>
            ))}
          </Card>

          {media.tips.length ? (
            <>
              <Text style={[text.label, { marginTop: S.lg }]}>Tips</Text>
              <Card style={{ gap: S.sm }}>
                {media.tips.map((tip, i) => (
                  <View key={i} style={styles.step}>
                    <Ionicons name="bulb-outline" size={18} color={C.accent} style={{ marginTop: 2 }} />
                    <Text style={[text.body, { flex: 1, lineHeight: 22 }]}>{tip}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <Pressable onPress={() => Linking.openURL(REPDB_URL)} accessibilityRole="link">
            <Text style={[text.faint, { marginTop: S.sm }]}>
              Exercise data by <Text style={{ color: C.accent }}>RepDB (repdb.co)</Text>
            </Text>
          </Pressable>
        </>
      ) : null}

      <Text style={[text.label, { marginTop: S.lg }]}>Personal records</Text>
      <View style={styles.records}>
        <Record
          label="Heaviest"
          value={rec.bestWeight ? `${fmtWeight(rec.bestWeight.weight)} kg` : '—'}
          sub={rec.bestWeight ? `× ${rec.bestWeight.reps}` : undefined}
        />
        <Record
          label="Est. 1RM"
          value={rec.best1RM ? `${fmtWeight(rec.best1RM.value)} kg` : '—'}
          sub={rec.best1RM ? fmtSet(rec.best1RM.weight, rec.best1RM.reps) : undefined}
        />
        <Record label="Best session" value={rec.bestVolume ? fmtVolume(rec.bestVolume.value) : '—'} sub={rec.bestVolume ? 'volume' : undefined} />
      </View>

      <Text style={[text.label, { marginTop: S.lg }]}>
        History{sessions.length ? ` · ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}` : ''}
      </Text>
      {sessions.length === 0 ? (
        <Empty icon="time-outline" title="Not logged yet" hint="Once you finish a workout with this exercise, it shows up here." />
      ) : (
        sessions.map((s) => (
          <Card key={s.workout_id} style={{ gap: S.xs }}>
            <Text style={[text.body, { fontWeight: '700' }]}>{s.workout_name}</Text>
            <Text style={text.faint}>{fmtDate(s.date)}</Text>
            {s.sets.map((set, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: S.md }}>
                <Text style={[text.dim, { width: 20, fontWeight: '700' }]}>{i + 1}</Text>
                <Text style={text.body}>{fmtSet(set.weight, set.reps)}</Text>
              </View>
            ))}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function Record({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={styles.record}>
      <Ionicons name="trophy" size={16} color={C.gold} />
      <Text style={text.faint}>{label}</Text>
      <Text style={[text.h2, { fontSize: 17 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={text.faint}>{sub}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: S.lg, gap: S.sm, paddingBottom: S.xxl },
  hero: { alignItems: 'center', marginBottom: S.md },
  step: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start' },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: C.accent, fontSize: 13, fontWeight: '800' },
  records: { flexDirection: 'row', gap: S.sm },
  record: { flex: 1, padding: S.md, gap: 2 },
});
