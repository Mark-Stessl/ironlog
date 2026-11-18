import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { text } from '@/components/ui';
import {
  DETAILS,
  energySplit,
  fmtNutrient,
  MICROS,
  NUTRIENTS,
  type Goals,
  type NutrientKey,
  type Nutrients,
} from '@/lib/nutrition';
import { C, F, S } from '@/lib/theme';
import { useTween } from '@/lib/use-tween';

/** Macro colours, validated for contrast and colour-blind separation on the dark card. */
export const MACRO_COLOR = { protein: '#0EA5C6', carbs: '#B8861F', fat: '#8B5CF6' } as const;

// ── Calorie ring ────────────────────────────────────────────────────────

export function CalorieRing({ eaten, goal, size = 172 }: { eaten: number; goal: number; size?: number }) {
  const shown = useTween(eaten);
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = goal > 0 ? shown / goal : 0;
  const over = eaten > goal;
  const left = Math.round(goal - shown);
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={`${Math.round(eaten)} of ${goal} kilocalories eaten`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.cardHi} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? C.gold : C.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * Math.min(1, p)} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {p > 1 ? (
          // Second lap: how far over the goal.
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#F59E0B"
            strokeWidth={stroke - 6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * Math.min(1, p - 1)} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={[styles.ringValue, over && { color: C.gold }]}>{Math.abs(left).toLocaleString('en-US')}</Text>
        <Text style={text.faint}>{over ? 'kcal over' : 'kcal left'}</Text>
      </View>
    </View>
  );
}

// ── Macro bars ──────────────────────────────────────────────────────────

function Bar({ value, goal, color, limit }: { value: number; goal: number; color: string; limit?: boolean }) {
  const shown = useTween(value);
  const p = goal > 0 ? shown / goal : 0;
  const over = limit && value > goal;
  return (
    <View style={styles.track}>
      <View
        style={[styles.fill, { width: `${Math.min(100, p * 100)}%`, backgroundColor: over ? C.gold : color }]}
      />
    </View>
  );
}

export function MacroBars({ n, goals }: { n: Nutrients; goals: Goals }) {
  const rows: { key: 'protein' | 'carbs' | 'fat'; label: string }[] = [
    { key: 'protein', label: 'Protein' },
    { key: 'carbs', label: 'Carbs' },
    { key: 'fat', label: 'Fat' },
  ];
  return (
    <View style={{ gap: 12, flex: 1, minWidth: 0 }}>
      {rows.map((r) => {
        const v = n[r.key] ?? 0;
        const g = goals[r.key];
        return (
          <View key={r.key} style={{ gap: 5 }}>
            <View style={styles.barHead}>
              <View style={[styles.dot, { backgroundColor: MACRO_COLOR[r.key] }]} />
              <Text style={styles.barLabel}>{r.label}</Text>
              <Text style={styles.barValue}>
                <Text style={{ color: C.text }}>{Math.round(v)}</Text> / {g} g
              </Text>
            </View>
            <Bar value={v} goal={g} color={MACRO_COLOR[r.key]} />
          </View>
        );
      })}
    </View>
  );
}

/** Share of today's energy from protein, carbs and fat. */
export function EnergySplit({ n }: { n: Nutrients }) {
  const s = energySplit(n);
  const parts = [
    { key: 'protein' as const, label: 'Protein', v: s.protein },
    { key: 'carbs' as const, label: 'Carbs', v: s.carbs },
    { key: 'fat' as const, label: 'Fat', v: s.fat },
  ];
  if (!parts.some((p) => p.v > 0)) return null;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.split}>
        {parts
          .filter((p) => p.v > 0)
          .map((p) => (
            <View key={p.key} style={{ flex: p.v, height: 8, borderRadius: 4, backgroundColor: MACRO_COLOR[p.key] }} />
          ))}
      </View>
      <View style={styles.splitLegend}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: MACRO_COLOR[p.key] }]} />
            <Text style={text.faint}>
              {p.label} {Math.round(p.v * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Fibre, sugar, saturated fat, salt ───────────────────────────────────

export function DetailBars({ n, goals }: { n: Nutrients; goals: Goals }) {
  return (
    <View style={{ gap: 12 }}>
      {DETAILS.map(({ key, limit }) => {
        const v = n[key] ?? 0;
        const g = goals[key];
        const over = limit && v > g;
        return (
          <View key={key} style={{ gap: 5 }}>
            <View style={styles.barHead}>
              <Text style={styles.barLabel}>{NUTRIENTS[key].label}</Text>
              {over ? <Ionicons name="alert-circle" size={13} color={C.gold} /> : null}
              <Text style={[styles.barValue, over && { color: C.gold }]}>
                <Text style={{ color: over ? C.gold : C.text }}>{fmtNutrient(key, v).replace(/ g$/, '')}</Text>
                {limit ? ' / max ' : ' / '}
                {fmtNutrient(key, g)}
              </Text>
            </View>
            <Bar value={v} goal={g} color={limit ? '#5E7B8A' : C.good} limit={limit} />
          </View>
        );
      })}
    </View>
  );
}

// ── Vitamins and minerals ───────────────────────────────────────────────

export function MicroBars({ n, goals }: { n: Nutrients; goals: Goals }) {
  return (
    <View style={styles.micros}>
      {MICROS.map((key: NutrientKey) => {
        const v = n[key] ?? 0;
        const g = goals[key];
        const pct = g ? Math.round((v / g) * 100) : 0;
        return (
          <View key={key} style={styles.micro} accessibilityLabel={`${NUTRIENTS[key].label}: ${pct} percent of daily value`}>
            <View style={styles.barHead}>
              <Text style={styles.microLabel} numberOfLines={1}>
                {NUTRIENTS[key].label}
              </Text>
              <Text style={[styles.microPct, pct >= 100 && { color: C.good }]}>{pct}%</Text>
            </View>
            <Bar value={Math.min(v, g)} goal={g} color={pct >= 100 ? C.good : C.accent} />
            <Text style={styles.microAmount}>
              {fmtNutrient(key, v)} of {fmtNutrient(key, g)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Last 7 days ─────────────────────────────────────────────────────────

export function WeekBars({
  days,
  goal,
  selected,
  onSelect,
}: {
  days: { day: string; label: string; kcal: number }[];
  goal: number;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const h = 120;
  const max = Math.max(goal * 1.15, ...days.map((d) => d.kcal), 1);
  const y = (v: number) => h - (v / max) * h;
  const slot = width / Math.max(1, days.length);
  const barW = Math.min(26, slot * 0.55);
  const sel = days.find((d) => d.day === selected);
  return (
    <View>
      <View style={{ height: h + 22 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={h}>
            <Line x1={0} x2={width} y1={y(goal)} y2={y(goal)} stroke={C.textFaint} strokeDasharray="4 4" strokeWidth={1} />
            {days.map((d, i) => {
              const bh = Math.max(d.kcal > 0 ? 4 : 0, h - y(d.kcal));
              const on = d.day === selected;
              return (
                <Rect
                  key={d.day}
                  x={i * slot + (slot - barW) / 2}
                  y={h - bh}
                  width={barW}
                  height={bh}
                  rx={4}
                  fill={d.kcal > goal ? C.gold : C.accent}
                  opacity={on ? 1 : 0.45}
                />
              );
            })}
          </Svg>
        ) : null}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {days.map((d) => (
            <Pressable
              key={d.day}
              onPress={() => onSelect(d.day)}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}: ${Math.round(d.kcal)} kilocalories`}
              style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
              <Text style={[styles.weekDay, d.day === selected && { color: C.text }]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.weekFoot}>
        <Text style={text.faint}>
          <Text style={{ color: C.text, fontFamily: F.semi }}>{Math.round(sel?.kcal ?? 0).toLocaleString('en-US')}</Text>{' '}
          kcal on {sel?.label ?? ''}
        </Text>
        <View style={styles.legendItem}>
          <View style={styles.goalSwatch} />
          <Text style={text.faint}>Goal {goal.toLocaleString('en-US')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringValue: { color: C.text, fontFamily: F.display, fontSize: 30, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: C.cardHi, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  barHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel: { flex: 1, color: C.text, fontFamily: F.medium, fontSize: 13 },
  barValue: { color: C.textDim, fontFamily: F.medium, fontSize: 12, fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  split: { flexDirection: 'row', gap: 2, borderRadius: 4, overflow: 'hidden' },
  splitLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  micros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: S.lg, rowGap: 14 },
  micro: { flexBasis: '45%', flexGrow: 1, gap: 4 },
  microLabel: { flex: 1, color: C.text, fontFamily: F.medium, fontSize: 13 },
  microPct: { color: C.textDim, fontFamily: F.semi, fontSize: 12, fontVariant: ['tabular-nums'] },
  microAmount: { color: C.textFaint, fontFamily: F.regular, fontSize: 11, fontVariant: ['tabular-nums'] },
  weekDay: { color: C.textFaint, fontFamily: F.medium, fontSize: 11 },
  weekFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: S.sm },
  goalSwatch: { width: 14, height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.textFaint },
});

