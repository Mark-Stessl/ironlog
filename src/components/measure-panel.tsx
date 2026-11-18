import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LineChart } from '@/components/line-chart';
import { Card, text } from '@/components/ui';
import { addMeasurement, type Measurement } from '@/lib/db';
import { notify } from '@/lib/dialog';
import { parseNum } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { fmtChange, fmtMeasure, validMeasure, type MeasureKind } from '@/lib/measures';
import { C, F, R, S } from '@/lib/theme';

/** Latest value, change, chart over time and a field to log a new value. */
export function MeasurePanel({
  kind,
  entries,
  onChange,
  chartHeight = 170,
}: {
  kind: MeasureKind;
  entries: Measurement[];
  onChange: () => void;
  chartHeight?: number;
}) {
  const db = useSQLiteContext();
  const [value, setValue] = useState('');
  const last = entries[entries.length - 1];
  const first = entries[0];
  const prev = entries[entries.length - 2];

  const save = async () => {
    const v = parseNum(value);
    if (v == null) return;
    if (!validMeasure(v, kind.unit)) {
      notify(
        'That looks off',
        `${fmtMeasure(v, kind.unit)} seems unlikely for ${kind.label.toLowerCase()}. Check for a typo.`,
        kind.icon,
      );
      return;
    }
    await addMeasurement(db, kind.key, v);
    haptic.success();
    setValue('');
    onChange();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={text.faint}>{kind.label}</Text>
          {last ? (
            <Animated.Text key={last.id} entering={FadeIn.duration(250)} style={styles.value}>
              {fmtMeasure(last.value, kind.unit)}
            </Animated.Text>
          ) : (
            <Text style={[styles.value, { color: C.textFaint }]}>—</Text>
          )}
          {last && prev ? (
            <Text style={styles.change}>
              {fmtChange(last.value - prev.value, kind.unit)} since last time
              {entries.length > 2 ? `  ·  ${fmtChange(last.value - first.value, kind.unit)} overall` : ''}
            </Text>
          ) : (
            <Text style={styles.change}>{kind.hint ?? 'Log a value to start your history.'}</Text>
          )}
        </View>
        <View style={styles.icon}>
          <Ionicons name={kind.icon} size={18} color={C.accent} />
        </View>
      </View>

      {entries.length > 1 ? (
        <LineChart
          points={entries.map((e) => ({ t: e.measured_at, v: e.value }))}
          height={chartHeight}
          format={(v) => fmtMeasure(v, kind.unit)}
        />
      ) : null}

      <View style={styles.logRow}>
        <View style={styles.inputWrap}>
          <TextInput
            value={value}
            onChangeText={setValue}
            onSubmitEditing={save}
            placeholder={last ? String(last.value) : kind.unit === 'kg' ? '75' : kind.unit === '%' ? '18' : '40'}
            placeholderTextColor={C.textFaint}
            keyboardType="decimal-pad"
            returnKeyType="done"
            accessibilityLabel={`New ${kind.label.toLowerCase()} in ${kind.unit}`}
            style={styles.input}
          />
          <Text style={styles.unit}>{kind.unit}</Text>
        </View>
        <Pressable
          onPress={save}
          disabled={parseNum(value) == null}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.logButton,
            parseNum(value) == null && { opacity: 0.4 },
            pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
          ]}>
          <Ionicons name="add" size={16} color={C.onAccent} />
          <Text style={styles.logLabel}>Log today</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: S.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  value: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 28,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  change: { color: C.textDim, fontFamily: F.medium, fontSize: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logRow: { flexDirection: 'row', gap: S.sm },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.bg,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
    height: 40,
    outlineStyle: 'none',
  } as never,
  unit: { color: C.textFaint, fontFamily: F.medium, fontSize: 13 },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  logLabel: { color: C.onAccent, fontFamily: F.semi, fontSize: 13 },
});
