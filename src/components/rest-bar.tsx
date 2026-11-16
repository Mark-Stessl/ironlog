import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fmtDuration } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { C, F, R, S } from '@/lib/theme';

/** Countdown shown at the bottom of the workout after ticking off a set. */
export function RestBar({
  endAt,
  total,
  bottomInset,
  onAdjust,
  onDone,
}: {
  endAt: number;
  total: number;
  bottomInset: number;
  onAdjust: (deltaMs: number) => void;
  onDone: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = endAt - now;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      haptic.success();
      onDone();
    }
  }, [remaining, onDone]);

  const progress = Math.min(1, Math.max(0, remaining / total));

  return (
    <View style={[styles.wrap, { bottom: bottomInset + S.md }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Rest</Text>
          <Text style={styles.time}>{fmtDuration(Math.max(0, remaining))}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => onAdjust(-15000)} style={styles.btn} accessibilityLabel="15 seconds less rest">
            <Text style={styles.btnText}>−15</Text>
          </Pressable>
          <Pressable onPress={() => onAdjust(15000)} style={styles.btn} accessibilityLabel="15 seconds more rest">
            <Text style={styles.btnText}>+15</Text>
          </Pressable>
          <Pressable onPress={onDone} style={[styles.btn, { backgroundColor: C.accent }]} accessibilityLabel="Skip rest">
            <Text style={[styles.btnText, { color: C.onAccent }]}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: S.lg },
  bar: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: C.cardHi,
    borderWidth: 1,
    borderColor: C.borderHi,
    borderRadius: R.lg,
    overflow: 'hidden',
  },
  track: { height: 2, backgroundColor: C.border },
  fill: { height: 2, backgroundColor: C.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: S.sm, paddingHorizontal: S.md },
  label: { color: C.textDim, fontSize: 12, fontFamily: F.medium, marginRight: 4 },
  time: { color: C.text, fontSize: 18, fontFamily: F.displaySemi, fontVariant: ['tabular-nums'] },
  btn: {
    minWidth: 44,
    height: 30,
    borderRadius: R.sm,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  btnText: { color: C.text, fontSize: 12, fontFamily: F.semi },
});
