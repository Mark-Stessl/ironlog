import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MeasurePanel } from '@/components/measure-panel';
import { ListCard, ListRow, Page, PageHeader, SectionTitle, text } from '@/components/ui';
import { latestMeasurements, listMeasurements } from '@/lib/db';
import { fmtChange, fmtMeasure, MEASURES, WEIGHT } from '@/lib/measures';
import { C, F, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function MeasuresScreen() {
  const [data, reload] = useFocusData(async (db) => ({
    weight: await listMeasurements(db, WEIGHT.key),
    latest: await latestMeasurements(db),
  }));

  return (
    <Page maxWidth={720}>
      <PageHeader title="Measures" sub="Body weight and anything else you want to track" />
      {data ? (
        <>
          <MeasurePanel kind={WEIGHT} entries={data.weight} onChange={reload} />
          {data.weight.length ? (
            <ListCard>
              <ListRow
                last
                onPress={() =>
                  router.push({
                    pathname: '/measure/[kind]',
                    params: { kind: WEIGHT.key },
                  })
                }>
                <Ionicons name="time-outline" size={16} color={C.textDim} />
                <Text style={[text.body, { flex: 1 }]}>Weight history</Text>
                <Text style={text.faint}>{data.weight.length} entries</Text>
                <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
              </ListRow>
            </ListCard>
          ) : null}

          <SectionTitle title="Body measurements" />
          <ListCard>
            {MEASURES.filter((m) => m.key !== WEIGHT.key).map((m, i, all) => {
              const l = data.latest[m.key];
              return (
                <ListRow
                  key={m.key}
                  last={i === all.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: '/measure/[kind]',
                      params: { kind: m.key },
                    })
                  }>
                  <View style={styles.icon}>
                    <Ionicons name={m.icon} size={14} color={l ? C.accent : C.textFaint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={text.body}>{m.label}</Text>
                    {l?.prev != null ? <Text style={text.faint}>{fmtChange(l.value - l.prev, m.unit)}</Text> : null}
                  </View>
                  {l ? (
                    <Text style={styles.value}>{fmtMeasure(l.value, m.unit)}</Text>
                  ) : (
                    <Text style={[text.faint, { color: C.accent }]}>Add</Text>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
                </ListRow>
              );
            })}
          </ListCard>
          <Text style={[text.faint, { marginTop: S.xs }]}>
            All optional. Measure at the same time of day, like in the morning before breakfast, for the cleanest trend.
          </Text>
        </>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: C.text,
    fontFamily: F.displaySemi,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
});
