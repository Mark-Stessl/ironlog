import { router } from 'expo-router';
import { View } from 'react-native';

import { ExerciseSearch } from '@/components/exercise-search';
import { Button } from '@/components/ui';
import { listExercises } from '@/lib/db';
import { S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function ExercisesTab() {
  const [exercises] = useFocusData(listExercises);

  return (
    <ExerciseSearch
      exercises={exercises ?? []}
      onPick={(ex) => router.push({ pathname: '/exercise/[id]', params: { id: String(ex.id) } })}
      footer={(query) => (
        <View style={{ marginTop: S.lg }}>
          <Button
            label={query ? `Create "${query}"` : 'Create Custom Exercise'}
            icon="add"
            kind="secondary"
            onPress={() => router.push({ pathname: '/exercise-new', params: { name: query } })}
          />
        </View>
      )}
    />
  );
}
