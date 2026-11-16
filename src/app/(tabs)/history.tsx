import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Empty, ListCard, ListRow, Page, PageHeader, text } from '@/components/ui';
import { listFinishedWorkouts } from '@/lib/db';
import { fmtDate, fmtDurationShort, fmtVolume } from '@/lib/format';
import { C, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function HistoryTab() {
  const [workouts] = useFocusData(listFinishedWorkouts);
  const list = workouts ?? [];

  return (
    <Page topInset>
      <PageHeader title="History" sub={workouts ? `${list.length} ${list.length === 1 ? 'workout' : 'workouts'}` : undefined} />
      {workouts && list.length === 0 ? (
        <Empty icon="time-outline" title="No workouts yet" hint="Finished workouts show up here." />
      ) : (
        <ListCard>
          {list.map((w, i) => {
            const end = w.finished_at ?? w.started_at;
            return (
              <ListRow
                key={w.id}
                last={i === list.length - 1}
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(w.id) } })}
                style={{ alignItems: 'flex-start', paddingVertical: S.md }}>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
                    <Text style={[text.strong, { flexShrink: 1 }]} numberOfLines={1}>
                      {w.name}
                    </Text>
                    <Text style={text.faint}>{fmtDate(end)}</Text>
                  </View>
                  {w.exercise_names ? (
                    <Text style={text.faint} numberOfLines={1}>
                      {w.exercise_names}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Text style={[text.dim, { color: C.text, fontVariant: ['tabular-nums'] }]}>{fmtVolume(w.volume)}</Text>
                  <Text style={text.faint}>
                    {fmtDurationShort(end - w.started_at)} · {w.set_count} sets
                  </Text>
                </View>
              </ListRow>
            );
          })}
        </ListCard>
      )}
    </Page>
  );
}
