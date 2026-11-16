import { useLocalSearchParams } from 'expo-router';

import { ExerciseDetail } from '@/components/exercise-detail';
import { Page } from '@/components/ui';

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Page maxWidth={720}>
      <ExerciseDetail exerciseId={Number(id)} />
    </Page>
  );
}
