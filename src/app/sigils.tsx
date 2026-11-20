import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { SigilView } from '@/components/sigil';
import { Chip, Empty, Page, PageHeader, text } from '@/components/ui';
import { recordRows, sigilRows } from '@/lib/db';
import { fmtAgo } from '@/lib/format';
import { recordBook } from '@/lib/records';
import { buildSigil, sigilInputs } from '@/lib/sigil';
import { C, F, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

/** Every workout's sigil, newest first. */
export default function SigilsScreen() {
  const { width } = useWindowDimensions();
  const [onlyGold, setOnlyGold] = useState(false);
  const [list] = useFocusData(async (db) => {
    const [rows, recs] = await Promise.all([sigilRows(db), recordRows(db)]);
    const counts = new Map<number, number>();
    for (const e of recordBook(recs).events) counts.set(e.workout_id, (counts.get(e.workout_id) ?? 0) + 1);
    return sigilInputs(rows, counts).map((w) => ({ ...w, sigil: buildSigil(w) }));
  });
  if (!list) return <Page maxWidth={900}>{null}</Page>;

  const shown = onlyGold ? list.filter((w) => w.sigil.gold) : list;
  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  const inner = Math.min(width, 900) - S.lg * 2;
  const size = Math.floor((inner - (columns - 1) * S.md) / columns);

  return (
    <Page maxWidth={900}>
      <PageHeader title="Your sigils" sub="Every workout grows its own. Gold ones had a record." />
      {list.length === 0 ? (
        <Empty icon="sparkles-outline" title="No sigils yet" hint="Finish a workout and its sigil appears here." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Chip label={`All ${list.length}`} active={!onlyGold} onPress={() => setOnlyGold(false)} />
            <Chip
              label={`With records ${list.filter((w) => w.sigil.gold).length}`}
              active={onlyGold}
              onPress={() => setOnlyGold(true)}
            />
          </View>
          <View style={styles.grid}>
            {shown.map((w, i) => (
              <Animated.View key={w.id} entering={FadeIn.delay(Math.min(i, 20) * 25).duration(250)}>
                <Pressable
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(w.id) } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.name}, ${fmtAgo(w.finished_at ?? w.started_at)}`}
                  style={({ pressed }) => [{ width: size, alignItems: 'center', gap: 4 }, pressed && { opacity: 0.7 }]}>
                  <SigilView sigil={w.sigil} size={size} />
                  <Text style={[styles.name, w.sigil.gold && { color: C.gold }]} numberOfLines={1}>
                    {w.name}
                  </Text>
                  <Text style={text.faint}>{fmtAgo(w.finished_at ?? w.started_at)}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md, marginTop: S.md },
  name: { color: C.text, fontFamily: F.semi, fontSize: 13, maxWidth: '100%' },
});
