import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { text } from '@/components/ui';
import { fmtWeight } from '@/lib/format';
import type { Region } from '@/lib/muscles';
import { REGION_LABEL, topRegions } from '@/lib/stats';
import { C, F, S } from '@/lib/theme';

/** "Chest ███████ 9 sets" rows for the most trained areas. */
export function MuscleBars({ regions, count = 6 }: { regions: Partial<Record<Region, number>>; count?: number }) {
  const top = topRegions(regions, count);
  const max = top[0]?.sets ?? 0;
  if (!top.length) return <Text style={text.faint}>No sets logged.</Text>;
  return (
    <View style={{ gap: 8 }}>
      {top.map((t, i) => (
        <Animated.View key={t.region} entering={FadeIn.delay(i * 60).duration(300)} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {REGION_LABEL[t.region]}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.max(6, (t.sets / max) * 100)}%`, opacity: 0.45 + 0.55 * (t.sets / max) },
              ]}
            />
          </View>
          <Text style={styles.value}>
            {fmtWeight(t.sets)} {t.sets === 1 ? 'set' : 'sets'}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  name: { width: 92, color: C.text, fontFamily: F.medium, fontSize: 13 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.cardHi, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.accent },
  value: {
    width: 64,
    textAlign: 'right',
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
