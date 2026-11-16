import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Card, Empty, text } from '@/components/ui';
import { listFinishedWorkouts } from '@/lib/db';
import { fmtDate, fmtDurationShort, fmtVolume } from '@/lib/format';
import { S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function HistoryTab() {
  const [workouts] = useFocusData(listFinishedWorkouts);

  return (
    <FlatList
      data={workouts ?? []}
      keyExtractor={(w) => String(w.id)}
      contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: S.xxl }}
      ListEmptyComponent={
        workouts ? (
          <Empty icon="calendar-outline" title="No workouts yet" hint="Finished workouts show up here." />
        ) : undefined
      }
      renderItem={({ item: w }) => (
        <Pressable onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(w.id) } })}>
          <Card style={{ gap: S.xs }}>
            <Text style={text.h2}>{w.name}</Text>
            <Text style={text.dim}>{fmtDate(w.finished_at ?? w.started_at)}</Text>
            <View style={{ flexDirection: 'row', gap: S.lg, marginTop: S.xs }}>
              <Stat label="Time" value={fmtDurationShort((w.finished_at ?? w.started_at) - w.started_at)} />
              <Stat label="Volume" value={fmtVolume(w.volume)} />
              <Stat label="Sets" value={String(w.set_count)} />
            </View>
            {w.exercise_names ? (
              <Text style={[text.dim, { marginTop: S.xs }]} numberOfLines={2}>
                {w.exercise_names}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      )}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={text.faint}>{label}</Text>
      <Text style={[text.body, { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}
