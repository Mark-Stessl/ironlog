import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BodyMap } from '@/components/body-map';
import { Button, Card, Chip, text } from '@/components/ui';
import { addExerciseToRoutine, addExerciseToWorkout, createExercise, type Track } from '@/lib/db';
import { notify } from '@/lib/dialog';
import { EQUIPMENT, MUSCLES } from '@/lib/exercise-data';
import { haptic } from '@/lib/haptics';
import { musclesFor } from '@/lib/muscles';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';

const TRACKS: { track: Track; label: string }[] = [
  { track: 'weight_reps', label: 'kg × reps' },
  { track: 'time_distance', label: 'Time + km' },
  { track: 'time_floors', label: 'Time + floors' },
];

/**
 * Modal: add your own exercise or a machine your gym has.
 * Opened from a workout or routine, the new exercise is added there right away.
 */
export default function NewExercise() {
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const params = useLocalSearchParams<{ name?: string; workoutId?: string; routineId?: string; close?: string }>();
  const [name, setName] = useState(params.name ?? '');
  const [muscle, setMuscle] = useState<string>('Chest');
  const [also, setAlso] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string>('Machine');
  const [track, setTrack] = useState<Track>('weight_reps');
  const target = params.workoutId ? 'workout' : params.routineId ? 'routine' : null;

  const toggleAlso = (m: string) => setAlso((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]));

  const save = async () => {
    if (!name.trim()) {
      notify('Give it a name', 'For example "Hammer Strength row" or "Cable lateral raise".', 'create-outline');
      return;
    }
    const id = await createExercise(db, name, muscle, equipment, also, track);
    if (params.workoutId) await addExerciseToWorkout(db, Number(params.workoutId), id);
    if (params.routineId) await addExerciseToRoutine(db, Number(params.routineId), id);
    haptic.success();
    // From the "Add exercise" search, close that screen too.
    const close = Number(params.close ?? 1);
    if (close > 1 && router.canDismiss()) router.dismiss(close);
    else router.back();
  };

  const preview = musclesFor({ name: '', muscle, secondary: also.join(',') });

  const form = (
    <View style={{ gap: S.sm, flex: 1 }}>
      <Text style={[text.dim, { marginBottom: S.sm }]}>
        Can't find a machine or exercise? Add it here. It shows up in search like any other, with your history and
        records.
      </Text>

      <Text style={text.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Hammer Strength row"
        placeholderTextColor={C.textFaint}
        autoFocus
        returnKeyType="done"
        style={styles.input}
      />

      <Text style={[text.label, { marginTop: S.md }]}>Main muscle</Text>
      <View style={styles.wrap}>
        {MUSCLES.map((m) => (
          <Chip
            key={m}
            label={m}
            active={muscle === m}
            onPress={() => {
              setMuscle(m);
              setAlso((list) => list.filter((x) => x !== m));
              // Cardio is logged with time; switching back goes to kg and reps.
              if (m === 'Cardio' && track === 'weight_reps') setTrack('time_distance');
              if (m !== 'Cardio' && muscle === 'Cardio') setTrack('weight_reps');
            }}
          />
        ))}
      </View>

      <Text style={[text.label, { marginTop: S.md }]}>Also works (optional)</Text>
      <View style={styles.wrap}>
        {MUSCLES.filter((m) => m !== muscle).map((m) => (
          <Chip key={m} label={m} active={also.includes(m)} onPress={() => toggleAlso(m)} />
        ))}
      </View>

      <Text style={[text.label, { marginTop: S.md }]}>Equipment</Text>
      <View style={styles.wrap}>
        {EQUIPMENT.map((e) => (
          <Chip key={e} label={e} active={equipment === e} onPress={() => setEquipment(e)} />
        ))}
      </View>

      <Text style={[text.label, { marginTop: S.md }]}>Each set records</Text>
      <View style={styles.wrap}>
        {TRACKS.map((t) => (
          <Chip key={t.track} label={t.label} active={track === t.track} onPress={() => setTrack(t.track)} />
        ))}
      </View>

      <Button
        label={target ? `Create and add to ${target}` : 'Create exercise'}
        icon="checkmark"
        kind="primary"
        onPress={save}
        style={{ marginTop: S.xl, alignSelf: desktop ? 'flex-start' : 'stretch' }}
      />
    </View>
  );

  const map = (
    <Card style={[{ paddingVertical: S.lg }, desktop && { width: 280 }]}>
      <Text style={[text.label, { marginBottom: S.md }]}>Preview</Text>
      <BodyMap muscles={preview} height={desktop ? 280 : 240} />
    </Card>
  );

  return (
    <ScrollView contentContainerStyle={[styles.page, desktop && { maxWidth: 860 }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Create exercise' }} />
      {desktop ? (
        <View style={{ flexDirection: 'row', gap: S.xl, alignItems: 'flex-start' }}>
          {form}
          {map}
        </View>
      ) : (
        <>
          {form}
          {map}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: S.lg, gap: S.lg, width: '100%', maxWidth: 560, alignSelf: 'center', paddingBottom: 48 },
  input: {
    height: 44,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.card,
    color: C.text,
    fontSize: 15,
    fontFamily: F.medium,
    paddingHorizontal: S.md,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
