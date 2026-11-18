import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, Text, View } from 'react-native';

import { MeasurePanel } from '@/components/measure-panel';
import { Empty, IconButton, ListCard, ListRow, Page, PageHeader, SectionTitle, text } from '@/components/ui';
import { deleteMeasurement, listMeasurements, type Measurement } from '@/lib/db';
import { confirm } from '@/lib/dialog';
import { fmtChange, fmtMeasure, measureKind } from '@/lib/measures';
import { C, F } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function MeasureScreen() {
  const { kind: key } = useLocalSearchParams<{ kind: string }>();
  const kind = measureKind(key);
  const db = useSQLiteContext();
  const [entries, reload] = useFocusData((d) => listMeasurements(d, kind.key), kind.key);

  const remove = async (m: Measurement) => {
    const ok = await confirm({
      title: 'Delete this entry?',
      message: `${fmtMeasure(m.value, kind.unit)} on ${fmtDay(m.measured_at)}`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteMeasurement(db, m.id);
    reload();
  };

  const newestFirst = [...(entries ?? [])].reverse();

  return (
    <Page maxWidth={720}>
      <PageHeader title={kind.label} sub={kind.hint} />
      {entries ? (
        <>
          <MeasurePanel kind={kind} entries={entries} onChange={reload} chartHeight={200} />
          <SectionTitle title="History" />
          {newestFirst.length ? (
            <ListCard>
              {newestFirst.map((m, i) => {
                const before = newestFirst[i + 1];
                return (
                  <ListRow key={m.id} last={i === newestFirst.length - 1}>
                    <View style={{ flex: 1 }}>
                      <Text style={text.body}>{fmtDay(m.measured_at)}</Text>
                      {before ? <Text style={text.faint}>{fmtChange(m.value - before.value, kind.unit)}</Text> : null}
                    </View>
                    <Text style={styles.value}>{fmtMeasure(m.value, kind.unit)}</Text>
                    <IconButton
                      icon="trash-outline"
                      label="Delete entry"
                      size={15}
                      color={C.textFaint}
                      onPress={() => remove(m)}
                    />
                  </ListRow>
                );
              })}
            </ListCard>
          ) : (
            <Empty icon={kind.icon} title="No entries yet" hint="Your history shows up here." />
          )}
        </>
      ) : null}
    </Page>
  );
}

function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  value: {
    color: C.text,
    fontFamily: F.displaySemi,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
});
