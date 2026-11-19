import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlateCalculator, PlateHint } from '@/components/plate-calculator';
import { fmtWeight, parseNum } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { C, F, R, S } from '@/lib/theme';

/** The field the keypad is typing into. */
export type PadTarget = {
  key: string;
  label: string;
  value: string;
  decimal: boolean;
  onChange: (v: string) => void;
  /** Moves to the next field (kg -> reps); leave out on the last one. */
  next?: () => void;
  /** Runs when Done is pressed on the last field (ticks the set off). */
  onDone?: () => void;
  /** A barbell weight: the keypad shows the plates for each side as you type. */
  plates?: boolean;
};

type Pad = { open: (t: PadTarget) => void; close: () => void; activeKey: string | null; enabled: boolean };
const PadContext = createContext<Pad>({ open: () => {}, close: () => {}, activeKey: null, enabled: false });
export const useNumberPad = () => useContext(PadContext);

/** Phones get the keypad; computers keep typing into normal fields. */
function wantsPad(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}

/** Keeps a number tidy: digits, at most one decimal point, no leading zeros. */
export function cleanNumber(s: string, decimal: boolean): string {
  let t = s.replace(',', '.').replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');
  if (decimal) {
    const i = t.indexOf('.');
    if (i >= 0)
      t =
        t.slice(0, i + 1) +
        t
          .slice(i + 1)
          .replace(/\./g, '')
          .slice(0, 2);
  }
  t = t.replace(/^0+(?=\d)/, '');
  return t.slice(0, decimal ? 7 : 4);
}

/**
 * Wrap a screen with this to get a numbers-only keypad that slides up from the
 * bottom (like Hevy): 0-9, a decimal point for kg, delete, -1 / +1 and Next.
 */
export function NumberPadProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<PadTarget | null>(null);
  // The first key after opening a field replaces its value, like selecting the text.
  const [fresh, setFresh] = useState(true);
  const enabled = wantsPad();

  const open = (t: PadTarget) => {
    setTarget(t);
    setFresh(true);
  };
  const close = () => setTarget(null);

  const update = (v: string) => {
    if (!target) return;
    setTarget({ ...target, value: v });
    target.onChange(v);
  };
  const press = (k: string) => {
    if (!target) return;
    haptic.tap();
    if (k === 'del') {
      setFresh(false);
      return update(target.value.slice(0, -1));
    }
    if (k === '+' || k === '-') {
      const n = Number(target.value || '0') + (k === '+' ? 1 : -1);
      setFresh(false);
      return update(cleanNumber(String(Math.max(0, Math.round(n * 100) / 100)), target.decimal));
    }
    const base = fresh ? '' : target.value;
    setFresh(false);
    update(cleanNumber(base + k, target.decimal));
  };

  return (
    <PadContext.Provider value={{ open, close, activeKey: target?.key ?? null, enabled }}>
      {children}
      {target ? <Keys target={target} onKey={press} onSet={update} onClose={close} /> : null}
    </PadContext.Provider>
  );
}

function Keys({
  target,
  onKey,
  onSet,
  onClose,
}: {
  target: PadTarget;
  onKey: (k: string) => void;
  onSet: (v: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [plates, setPlates] = useState(false);

  // Pull the keypad down to put it away.
  const drop = useSharedValue(0);
  const swipe = usePanGesture({
    activeOffsetY: [-10000, 10],
    failOffsetX: [-20, 20],
    runOnJS: true,
    onUpdate: (e) => {
      drop.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      if (drop.value > 70 || e.velocityY > 700) {
        drop.value = withTiming(420, { duration: 160 });
        setTimeout(onClose, 150);
      } else drop.value = withSpring(0, { damping: 20, stiffness: 260 });
    },
  });
  const dropStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));
  const rows: [string, string, string][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [target.decimal ? '.' : '', '0', 'del'],
  ];
  const side: { k: string; label?: string; icon?: 'remove' | 'add'; accent?: boolean }[] = [
    { k: '-', icon: 'remove', label: '1' },
    { k: '+', icon: 'add', label: '1' },
  ];
  return (
    <GestureDetector gesture={swipe} touchAction="none">
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(220)}
        exiting={SlideOutDown.duration(160)}
        style={[styles.pad, { paddingBottom: Math.max(insets.bottom, 10) + BOTTOM_GAP }, dropStyle]}>
        <View style={styles.grabber} />
        <View style={styles.bar}>
          <Text style={styles.barLabel} numberOfLines={1}>
            {target.label}
          </Text>
          {target.plates ? <PlateHint kg={parseNum(target.value)} onOpen={() => setPlates(true)} /> : null}
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Hide keypad" style={styles.hide}>
            <Ionicons name="chevron-down" size={20} color={C.textDim} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          <View style={{ flex: 3, gap: 6 }}>
            {rows.map((r, i) => (
              <View key={i} style={styles.row}>
                {r.map((k, j) =>
                  k ? (
                    <Key key={j} onPress={() => onKey(k)} label={k === 'del' ? 'Delete' : k}>
                      {k === 'del' ? (
                        <Ionicons name="backspace-outline" size={22} color={C.text} />
                      ) : (
                        <Text style={styles.keyText}>{k}</Text>
                      )}
                    </Key>
                  ) : (
                    <View key={j} style={{ flex: 1 }} />
                  ),
                )}
              </View>
            ))}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {side.map((s) => (
              <Key key={s.k} onPress={() => onKey(s.k)} label={s.k === '+' ? 'Plus 1' : 'Minus 1'} muted>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={s.icon!} size={16} color={C.text} />
                  <Text style={[styles.keyText, { fontSize: 17 }]}>{s.label}</Text>
                </View>
              </Key>
            ))}
            <Key
              onPress={() => {
                haptic.tap();
                if (target.next) return target.next();
                onClose();
                target.onDone?.();
              }}
              label={target.next ? 'Next field' : 'Done'}
              accent
              tall>
              <Text style={[styles.keyText, { color: C.onAccent, fontSize: 15 }]}>{target.next ? 'Next' : 'Done'}</Text>
            </Key>
          </View>
        </View>
        {plates ? (
          <PlateCalculator
            initial={parseNum(target.value)}
            onClose={() => setPlates(false)}
            onUse={(kg) => {
              setPlates(false);
              onSet(fmtWeight(kg));
            }}
          />
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

function Key({
  children,
  onPress,
  label,
  muted,
  accent,
  tall,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  muted?: boolean;
  accent?: boolean;
  tall?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.key,
        muted && styles.keyMuted,
        accent && styles.keyAccent,
        tall && { flex: 2 },
        pressed && { opacity: 0.6, transform: [{ scale: 0.96 }] },
      ]}>
      {children}
    </Pressable>
  );
}

/**
 * Extra room under the keys on phones, so a tap on the bottom row never lands on
 * the iPhone's swipe-home bar (the web app can't tell where that bar is).
 */
const BOTTOM_GAP = Platform.OS === 'web' ? 34 : 6;

/** Space to keep at the bottom of a page while the keypad is open. */
export const PAD_HEIGHT = 300 + BOTTOM_GAP;

const styles = StyleSheet.create({
  pad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    paddingHorizontal: S.sm,
    paddingTop: 6,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderColor: C.borderHi,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: C.borderHi, marginBottom: 2 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.sm, height: 36 },
  barLabel: { flex: 1, color: C.textDim, fontFamily: F.semi, fontSize: 13 },
  hide: { width: 36, height: 30, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', gap: 6, maxWidth: 520, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 6 },
  key: {
    flex: 1,
    height: 50,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardHi,
  },
  keyMuted: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  keyAccent: { backgroundColor: C.accent, height: undefined },
  keyText: { color: C.text, fontFamily: F.displaySemi, fontSize: 22 },
});
