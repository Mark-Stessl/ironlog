import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ExerciseSearch } from '@/components/exercise-search';
import { addExerciseToRoutine, addExerciseToWorkout, listExercises, type Exercise } from '@/lib/db';
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
      onCreate={(query) =>
        router.push({
          pathname: '/exercise-new',
          params: { name: query, workoutId: workoutId ?? '', routineId: routineId ?? '', close: '2' },
        })
      }
    />
  );
}
