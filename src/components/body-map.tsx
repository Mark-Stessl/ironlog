import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

import { text } from '@/components/ui';
import { BACK, FRONT, type Figure } from '@/lib/body-shapes';
import type { MuscleMap, Region } from '@/lib/muscles';
import { C, F, S } from '@/lib/theme';

const BODY = '#141D22';
const IDLE = '#22303A';
const PRIMARY = C.accent;
const SECONDARY = 'rgba(34,211,238,0.38)';

/** Front and back figure with the worked muscles highlighted, plus a legend. */
export function BodyMap({ muscles, height = 220, legend = true }: { muscles: MuscleMap; height?: number; legend?: boolean }) {
  const primary = new Set<Region>(muscles.primary);
  const secondary = new Set<Region>(muscles.secondary);
  const fill = (r: string) => (primary.has(r as Region) ? PRIMARY : secondary.has(r as Region) ? SECONDARY : IDLE);
  // Crop to the figures (they span x 19–231, y 8–262 of the 250 × 270 drawing).
  const width = (height * 220) / 260;

  const figure = (f: Figure, x: number) => {
    const shapes = (set: Figure['half']) =>
      Object.entries(set).flatMap(([region, paths]) =>
        (paths ?? []).map((d, i) => <Path key={`${region}${i}`} d={d} fill={fill(region)} stroke={C.bg} strokeWidth={0.6} />),
      );
    const half = (
      <>
        <Path d={f.outline[0]} fill={BODY} />
        {shapes(f.half)}
      </>
    );
    return (
      <G transform={`translate(${x},0)`}>
        <Ellipse cx={f.head.cx} cy={f.head.cy} rx={f.head.rx} ry={f.head.ry} fill={BODY} />
        {half}
        <G transform="translate(120,0) scale(-1,1)">{half}</G>
        {shapes(f.center)}
      </G>
    );
  };

  return (
    <View style={{ gap: S.md }}>
      <View style={{ alignItems: 'center' }}>
        <Svg width={width} height={height} viewBox="15 6 220 260" accessibilityLabel={describe(muscles)}>
          {figure(FRONT, 0)}
          {figure(BACK, 130)}
        </Svg>
        <View style={[styles.captions, { width }]}>
          <Text style={styles.caption}>Front</Text>
          <Text style={styles.caption}>Back</Text>
        </View>
      </View>
      {legend ? (
        <View style={{ gap: 6 }}>
          {muscles.primaryLabels.length ? (
            <LegendRow color={PRIMARY} title="Primary" names={muscles.primaryLabels} />
          ) : null}
          {muscles.secondaryLabels.length ? (
            <LegendRow color={SECONDARY} title="Secondary" names={muscles.secondaryLabels} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function LegendRow({ color, title, names }: { color: string; title: string; names: string[] }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[text.faint, { width: 70 }]}>{title}</Text>
      <Text style={[text.dim, { flex: 1, color: C.text }]}>{names.join(', ')}</Text>
    </View>
  );
}

function describe(m: MuscleMap): string {
  const parts = [];
  if (m.primaryLabels.length) parts.push(`Mainly trains ${m.primaryLabels.join(', ')}`);
  if (m.secondaryLabels.length) parts.push(`also ${m.secondaryLabels.join(', ')}`);
  return parts.join('; ') || 'Body map';
}

const styles = StyleSheet.create({
  captions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  caption: { color: C.textFaint, fontFamily: F.medium, fontSize: 11 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  dot: { width: 10, height: 10, borderRadius: 3 },
});
