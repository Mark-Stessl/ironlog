import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fmtDuration } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { C, R, S } from '@/lib/theme';

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
    <View style={[styles.bar, { paddingBottom: bottomInset + S.md }]}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <Pressable onPress={() => onAdjust(-15000)} style={styles.btn} accessibilityLabel="15 seconds less rest">
          <Text style={styles.btnText}>−15</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.label}>Rest</Text>
          <Text style={styles.time}>{fmtDuration(Math.max(0, remaining))}</Text>
        </View>
        <Pressable onPress={() => onAdjust(15000)} style={styles.btn} accessibilityLabel="15 seconds more rest">
          <Text style={styles.btnText}>+15</Text>
        </Pressable>
        <Pressable onPress={onDone} style={[styles.btn, { backgroundColor: C.accent }]} accessibilityLabel="Skip rest">
          <Text style={[styles.btnText, { color: C.onAccent }]}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: S.lg,
    paddingTop: S.md,
    gap: S.md,
  },
  track: { height: 4, borderRadius: 2, backgroundColor: C.cardHi, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: C.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  btn: {
    minWidth: 56,
    height: 44,
    borderRadius: R.sm,
    backgroundColor: C.cardHi,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.md,
  },
  btnText: { color: C.text, fontSize: 15, fontWeight: '700' },
  label: { color: C.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  time: { color: C.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
