import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ExerciseImage } from '@/components/exercise-image';
import { Button, Card, Empty, ListCard, ListRow, SectionTitle, text } from '@/components/ui';
import { computeRecords, getExercise, getExerciseHistory } from '@/lib/db';
import { formVideoUrl, getMedia, REPDB_URL } from '@/lib/exercise-media';
import { fmtDate, fmtSet, fmtVolume, fmtWeight } from '@/lib/format';
import { C, F, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

/** Picture, how-to, records and history of one exercise. Used as a page and as the desktop side panel. */
export function ExerciseDetail({ exerciseId }: { exerciseId: number }) {
  const desktop = useIsDesktop();
  const [data] = useFocusData(
    async (db) => ({
      exercise: await getExercise(db, exerciseId),
      sessions: await getExerciseHistory(db, exerciseId),
    }),
    exerciseId,
  );

  if (!data) return null;
  if (!data.exercise) return <Empty icon="alert-circle-outline" title="Exercise not found" />;

  const { exercise, sessions } = data;
  const rec = computeRecords(sessions);
  const media = getMedia(exercise.name);
  const imageSize = desktop ? 180 : 132;

  return (
    <View style={{ gap: S.sm }}>
      <View style={styles.hero}>
        {media ? (
          <ExerciseImage name={exercise.name} equipment={exercise.equipment} size={imageSize} radius={12} animate />
        ) : null}
        <View style={{ flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' }}>
          <Text style={[text.title, { fontSize: desktop ? 24 : 20 }]}>{exercise.name}</Text>
          <Text style={text.dim}>
            {exercise.muscle} · {exercise.equipment}
            {exercise.is_custom ? ' · Custom' : ''}
          </Text>
          <Button
            label="Form video"
            icon="logo-youtube"
            small
            onPress={() => Linking.openURL(formVideoUrl(exercise.name))}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          />
        </View>
      </View>

      {media ? <Text style={[text.body, { color: C.textDim }]}>{media.description}</Text> : null}

      <SectionTitle title="Records" />
      <Card style={styles.records}>
        <Record label="Heaviest" value={rec.bestWeight ? `${fmtWeight(rec.bestWeight.weight)} kg` : '—'} sub={rec.bestWeight ? `× ${rec.bestWeight.reps}` : undefined} />
        <View style={styles.recordLine} />
        <Record label="Est. 1RM" value={rec.best1RM ? `${fmtWeight(rec.best1RM.value)} kg` : '—'} sub={rec.best1RM ? fmtSet(rec.best1RM.weight, rec.best1RM.reps) : undefined} />
        <View style={styles.recordLine} />
        <Record label="Best session" value={rec.bestVolume ? fmtVolume(rec.bestVolume.value) : '—'} />
      </Card>

      {media ? (
        <>
          <SectionTitle title="How to do it" />
          <View style={{ gap: S.sm }}>
            {media.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <Text style={[text.body, { flex: 1 }]}>{step}</Text>
              </View>
            ))}
          </View>

          {media.tips.length ? (
            <>
              <SectionTitle title="Tips" />
              <View style={{ gap: S.sm }}>
                {media.tips.map((tip, i) => (
                  <View key={i} style={styles.step}>
                    <Ionicons name="sparkles-outline" size={13} color={C.accent} style={{ marginTop: 3, width: 16 }} />
                    <Text style={[text.body, { flex: 1, color: C.textDim }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      <SectionTitle title={`History${sessions.length ? ` · ${sessions.length}` : ''}`} />
      {sessions.length === 0 ? (
        <Text style={text.faint}>Not logged yet. Finished workouts with this exercise show up here.</Text>
      ) : (
        <ListCard>
          {sessions.map((s, i) => (
            <ListRow key={s.workout_id} last={i === sessions.length - 1} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 92 }}>
                <Text style={text.strong} numberOfLines={1}>
                  {s.workout_name}
                </Text>
                <Text style={text.faint}>{fmtDate(s.date)}</Text>
              </View>
              <Text style={[text.dim, { flex: 1 }]}>{s.sets.map((set) => fmtSet(set.weight, set.reps)).join('   ')}</Text>
            </ListRow>
          ))}
        </ListCard>
      )}

      {media ? (
        <Pressable onPress={() => Linking.openURL(REPDB_URL)} accessibilityRole="link" style={{ marginTop: S.lg }}>
          <Text style={text.faint}>
            Exercise data by <Text style={{ color: C.textDim }}>RepDB (repdb.co)</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Record({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={text.faint}>{label}</Text>
      <Text style={text.num} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={text.faint}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: S.lg, alignItems: 'center', marginBottom: S.xs },
  records: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md },
  recordLine: { width: 1, alignSelf: 'stretch', backgroundColor: C.border },
  step: { flexDirection: 'row', gap: S.sm, alignItems: 'flex-start' },
  stepNum: { width: 16, color: C.accent, fontFamily: F.semi, fontSize: 13, lineHeight: 20 },
});
