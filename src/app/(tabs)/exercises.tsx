import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseDetail } from '@/components/exercise-detail';
import { ExerciseSearch } from '@/components/exercise-search';
import { Empty, PageHeader } from '@/components/ui';
import { listExercises } from '@/lib/db';
import { C, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function ExercisesTab() {
  const desktop = useIsDesktop();
  const insets = useSafeAreaInsets();
  const [exercises] = useFocusData(listExercises);
  const [selected, setSelected] = useState<number | null>(null);

  const search = (
    <ExerciseSearch
      exercises={exercises ?? []}
      selectedId={desktop ? selected ?? exercises?.[0]?.id : null}
      padding={desktop ? 24 : S.lg}
      header={<PageHeader title="Exercises" sub={exercises ? `${exercises.length} machines and exercises` : undefined} />}
      onPick={(ex) =>
        desktop ? setSelected(ex.id) : router.push({ pathname: '/exercise/[id]', params: { id: String(ex.id) } })
      }
      onCreate={(query) => router.push({ pathname: '/exercise-new', params: { name: query } })}
    />
  );

  if (!desktop) return <View style={{ flex: 1, paddingTop: insets.top }}>{search}</View>;

  // Desktop: library on the left, details of the selected exercise on the right (like Hevy's web app).
  const shown = selected ?? exercises?.[0]?.id ?? null;
  return (
    <View style={styles.split}>
      <View style={styles.listPane}>{search}</View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailPane}>
        {shown != null ? <ExerciseDetail exerciseId={shown} /> : <Empty icon="barbell-outline" title="Pick an exercise" />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row' },
  listPane: { width: 380, borderRightWidth: 1, borderRightColor: C.border },
  detailPane: { padding: 40, maxWidth: 760, width: '100%' },
});
