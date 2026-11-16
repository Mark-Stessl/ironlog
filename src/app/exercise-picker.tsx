import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ExerciseSearch } from '@/components/exercise-search';
import { Button } from '@/components/ui';
import { addExerciseToRoutine, addExerciseToWorkout, listExercises, type Exercise } from '@/lib/db';
import { S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

/** Modal: pick an exercise to add to a running workout or to a routine. */
export default function ExercisePicker() {
  const db = useSQLiteContext();
  const { workoutId, routineId } = useLocalSearchParams<{ workoutId?: string; routineId?: string }>();
  const [exercises] = useFocusData(listExercises);

  const pick = async (ex: Exercise) => {
    if (workoutId) await addExerciseToWorkout(db, Number(workoutId), ex.id);
    else if (routineId) await addExerciseToRoutine(db, Number(routineId), ex.id);
    router.back();
  };

  return (
    <ExerciseSearch
      exercises={exercises ?? []}
      onPick={pick}
      autoFocus
      pickIcon="add"
      footer={(query) => (
        <Button
          label={query ? `Create "${query}"` : 'Create custom exercise'}
          icon="add"
          kind="ghost"
          onPress={() => router.push({ pathname: '/exercise-new', params: { name: query } })}
          style={{ marginTop: S.md, alignSelf: 'flex-start' }}
        />
      )}
    />
  );
}
