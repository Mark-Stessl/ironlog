import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, ZoomIn } from 'react-native-reanimated';

import { text } from '@/components/ui';
import { getSetting, setSetting } from '@/lib/db';
import { fmtWeight, parseNum } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { ALL_PLATES, BAR_OPTIONS, describePlates, PLATE_COLOR, platesFor } from '@/lib/plates';
import { C, F, R, S } from '@/lib/theme';

/** Barbell exercises get the plate calculator. */
export function usesBarbell(equipment: string, name: string): boolean {
  return /barbell/i.test(equipment) || /\(barbell\)|ez bar/i.test(name);
}

/** Plate button for an exercise card; opens the calculator with `weight` filled in. */
export function PlateButton({ weight }: { weight: number | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Plate calculator"
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
        <Ionicons name="disc-outline" size={15} color={C.accent} />
        <Text style={styles.buttonText}>Plates</Text>
      </Pressable>
      {open ? <PlateCalculator initial={weight} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PlateCalculator({ initial, onClose }: { initial: number | null; onClose: () => void }) {
  const db = useSQLiteContext();
  const [weightText, setWeightText] = useState(initial ? fmtWeight(initial) : '60');
  const [bar, setBar] = useState(20);
  const [have, setHave] = useState<number[]>([...ALL_PLATES]);

  // Bar and plates you have are remembered.
  useEffect(() => {
    (async () => {
      setBar(Number(await getSetting(db, 'plate_bar', '20')) || 20);
      const saved = await getSetting(db, 'plate_set', '');
      if (saved)
        setHave(
          saved
            .split(',')
            .map(Number)
            .filter((n) => ALL_PLATES.includes(n as never)),
        );
    })();
  }, [db]);

  const target = parseNum(weightText) ?? 0;
  const r = platesFor(target, bar, have);
  const step = (d: number) => {
    haptic.tap();
    setWeightText(fmtWeight(Math.max(0, Math.round((target + d) * 100) / 100)));
  };
  const pickBar = (b: number) => {
    setBar(b);
    setSetting(db, 'plate_bar', String(b));
  };
  const togglePlate = (p: number) => {
    const next = have.includes(p) ? have.filter((x) => x !== p) : [...have, p];
    if (!next.length) return;
    setHave(next);
    setSetting(db, 'plate_set', next.join(','));
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View entering={ZoomIn.springify().damping(18).stiffness(260)} style={styles.card}>
          <View style={styles.head}>
            <Text style={[text.title, { fontSize: 18, flex: 1 }]}>Plate calculator</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={C.textDim} />
            </Pressable>
          </View>

          <View style={styles.weightRow}>
            <Pressable onPress={() => step(-2.5)} style={styles.stepBtn} accessibilityLabel="2.5 kg less">
              <Ionicons name="remove" size={20} color={C.text} />
            </Pressable>
            <View style={styles.weightBox}>
              <TextInput
                value={weightText}
                onChangeText={setWeightText}
                keyboardType="decimal-pad"
                selectTextOnFocus
                accessibilityLabel="Total weight in kg"
                style={styles.weightInput}
              />
              <Text style={styles.kg}>kg</Text>
            </View>
            <Pressable onPress={() => step(2.5)} style={styles.stepBtn} accessibilityLabel="2.5 kg more">
              <Ionicons name="add" size={20} color={C.text} />
            </Pressable>
          </View>

          <BarDrawing perSide={r.perSide} />

          <Animated.View layout={LinearTransition.duration(180)} style={styles.result}>
            {target <= bar ? (
              <Text style={text.strong}>Just the bar ({bar} kg)</Text>
            ) : (
              <>
                <Text style={styles.resultLabel}>Each side</Text>
                <Text style={styles.resultPlates}>{describePlates(r.perSide) || 'nothing'}</Text>
              </>
            )}
            {!r.exact && target > bar ? (
              <Text style={[text.faint, { color: C.gold }]}>
                {fmtWeight(target)} kg can't be loaded exactly. This is {fmtWeight(r.below)} kg; the next step up is{' '}
                {fmtWeight(r.above)} kg.
              </Text>
            ) : null}
          </Animated.View>

          <Text style={styles.sectionLabel}>Bar</Text>
          <View style={styles.chips}>
            {BAR_OPTIONS.map((b) => (
              <Pressable
                key={b}
                onPress={() => pickBar(b)}
                accessibilityRole="button"
                accessibilityState={{ selected: bar === b }}
                style={[styles.chip, bar === b && styles.chipOn]}>
                <Text style={[styles.chipText, bar === b && { color: C.text }]}>{b} kg</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionLabel}>Plates at your gym</Text>
          <View style={styles.chips}>
            {ALL_PLATES.map((p) => {
              const on = have.includes(p);
              return (
                <Pressable
                  key={p}
                  onPress={() => togglePlate(p)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${p} kg plates`}
                  style={[styles.chip, on && styles.chipOn]}>
                  <View style={[styles.dot, { backgroundColor: PLATE_COLOR[p], opacity: on ? 1 : 0.3 }]} />
                  <Text style={[styles.chipText, on && { color: C.text }]}>{p}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** One side of the bar, plates sized and coloured like real ones. */
function BarDrawing({ perSide }: { perSide: number[] }) {
  const height = (p: number) => (p >= 15 ? 92 : p === 10 ? 74 : p === 5 ? 58 : p === 2.5 ? 46 : 38);
  const width = (p: number) => (p >= 20 ? 16 : p >= 10 ? 13 : p >= 5 ? 10 : 8);
  return (
    <View style={styles.drawing} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.sleeveEnd} />
      <View style={styles.collar} />
      <View style={styles.plates}>
        {perSide.map((p, i) => (
          <Animated.View
            key={`${i}-${p}`}
            entering={ZoomIn.delay(i * 40)
              .springify()
              .damping(14)}
            style={{
              width: width(p),
              height: height(p),
              borderRadius: 4,
              backgroundColor: PLATE_COLOR[p],
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.35)',
            }}
          />
        ))}
      </View>
      <View style={styles.sleeve} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
  },
  buttonText: { color: C.accent, fontFamily: F.semi, fontSize: 12 },
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.lg },
  backdrop: { flex: 1, backgroundColor: 'rgba(3,6,8,0.72)' },
  card: {
    width: '100%',
    maxWidth: 400,
    gap: S.sm,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardHi,
  },
  weightBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    paddingTop: 6,
  },
  weightInput: {
    minWidth: 60,
    maxWidth: 140,
    color: C.text,
    fontFamily: F.display,
    fontSize: 28,
    textAlign: 'center',
    padding: 0,
  },
  kg: { color: C.textDim, fontFamily: F.medium, fontSize: 14 },
  drawing: { flexDirection: 'row', alignItems: 'center', height: 104, marginVertical: 4, paddingHorizontal: 4 },
  sleeveEnd: { width: 28, height: 10, borderRadius: 3, backgroundColor: '#8A979C' },
  collar: { width: 8, height: 26, borderRadius: 3, backgroundColor: '#B8C4C8', marginRight: 2 },
  plates: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sleeve: { flex: 1, height: 14, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8A979C' },
  result: {
    gap: 4,
    padding: S.md,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  resultLabel: { color: C.textFaint, fontFamily: F.medium, fontSize: 12 },
  resultPlates: { color: C.text, fontFamily: F.displaySemi, fontSize: 20, fontVariant: ['tabular-nums'] },
  sectionLabel: { color: C.textFaint, fontFamily: F.semi, fontSize: 11, letterSpacing: 0.6, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipOn: { borderColor: C.accentLine, backgroundColor: C.accentDim },
  chipText: { color: C.textDim, fontFamily: F.semi, fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
