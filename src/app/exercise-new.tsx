import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Chip, text } from '@/components/ui';
import { createExercise } from '@/lib/db';
import { EQUIPMENT, MUSCLES } from '@/lib/exercise-data';
import { C, R, S } from '@/lib/theme';

/** Modal: add your own exercise or a machine your gym has. */
export default function NewExercise() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ name?: string }>();
  const [name, setName] = useState(params.name ?? '');
  const [muscle, setMuscle] = useState<string>('Chest');
  const [equipment, setEquipment] = useState<string>('Machine');

  const save = async () => {
    if (!name.trim()) return;
    await createExercise(db, name, muscle, equipment);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={text.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Hammer Strength Row"
        placeholderTextColor={C.textFaint}
        autoFocus
        style={styles.input}
      />

      <Text style={[text.label, { marginTop: S.lg }]}>Muscle</Text>
      <View style={styles.wrap}>
        {MUSCLES.map((m) => (
          <Chip key={m} label={m} active={muscle === m} onPress={() => setMuscle(m)} />
        ))}
      </View>

      <Text style={[text.label, { marginTop: S.lg }]}>Equipment</Text>
      <View style={styles.wrap}>
        {EQUIPMENT.map((e) => (
          <Chip key={e} label={e} active={equipment === e} onPress={() => setEquipment(e)} />
        ))}
      </View>

      <Button label="Save Exercise" onPress={save} style={{ marginTop: S.xl, opacity: name.trim() ? 1 : 0.4 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: S.lg, gap: S.sm },
  input: {
    height: 48,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    color: C.text,
    fontSize: 16,
    paddingHorizontal: S.md,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
});
