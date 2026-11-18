import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { foodByBarcode, saveProduct } from '@/lib/food-db';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { isBarcode, lookupBarcode, OffError } from '@/lib/off';
import { C, F, R, S } from '@/lib/theme';

type State =
  | { kind: 'scanning' }
  | { kind: 'looking'; code: string }
  | { kind: 'missing'; code: string }
  | { kind: 'error'; message: string };

export default function ScanScreen() {
  const { meal, day } = useLocalSearchParams<{ meal?: string; day?: string }>();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const [manual, setManual] = useState('');
  const [noCamera, setNoCamera] = useState(false);
  const busy = useRef(false);

  const handle = async (raw: string) => {
    const code = raw.replace(/\D/g, '');
    if (busy.current || !isBarcode(code)) return;
    busy.current = true;
    haptic.tap();
    sound.play('scan');
    setState({ kind: 'looking', code });
    try {
      // Already on this phone? No need to ask the internet.
      const local = await foodByBarcode(db, code);
      const ref = local?.ref ?? (await lookupBarcode(code).then((p) => (p ? saveProduct(db, p) : null)));
      if (ref) {
        haptic.success();
        router.replace({ pathname: '/food/[ref]', params: { ref, meal: meal ?? '', day: day ?? '' } });
        return;
      }
      setState({ kind: 'missing', code });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof OffError ? e.message : 'Lookup failed. Try again.' });
    } finally {
      busy.current = false;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ title: 'Scan barcode' }} />
      <BarcodeScanner onCode={handle} paused={state.kind !== 'scanning'} onAvailability={(ok) => setNoCamera(!ok)} />

      {/* Viewfinder (hidden when the camera can't be used, so it doesn't cover the scanner's message) */}
      {noCamera ? null : (
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.frame, state.kind === 'looking' && { borderColor: C.accent }]} />
          <Text style={styles.hint}>Point the camera at the barcode</Text>
        </View>
      )}

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, S.lg) }]}>
        {state.kind === 'looking' ? (
          <Animated.View entering={FadeIn} style={styles.status}>
            <ActivityIndicator color={C.accent} />
            <Text style={styles.statusText}>Looking up {state.code}…</Text>
          </Animated.View>
        ) : state.kind === 'missing' ? (
          <Animated.View entering={FadeIn} style={{ gap: S.sm }}>
            <Text style={styles.statusText}>Barcode {state.code} isn't on Open Food Facts yet.</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: '/food-new',
                    params: { barcode: state.code, meal: meal ?? '', day: day ?? '' },
                  })
                }
                style={[styles.button, styles.primary]}
                accessibilityRole="button">
                <Ionicons name="create-outline" size={16} color={C.onAccent} />
                <Text style={[styles.buttonText, { color: C.onAccent }]}>Add it yourself</Text>
              </Pressable>
              <Pressable
                onPress={() => setState({ kind: 'scanning' })}
                style={styles.button}
                accessibilityRole="button">
                <Text style={styles.buttonText}>Scan again</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : state.kind === 'error' ? (
          <Animated.View entering={FadeIn} style={{ gap: S.sm }}>
            <Text style={[styles.statusText, { color: C.gold }]}>{state.message}</Text>
            <Pressable onPress={() => setState({ kind: 'scanning' })} style={styles.button} accessibilityRole="button">
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <View style={styles.manual}>
          <Ionicons name="keypad-outline" size={16} color={C.textFaint} />
          <TextInput
            value={manual}
            onChangeText={(t) => setManual(t.replace(/\D/g, ''))}
            onSubmitEditing={() => handle(manual)}
            placeholder="Or type the barcode number"
            placeholderTextColor={C.textFaint}
            keyboardType="number-pad"
            returnKeyType="search"
            maxLength={14}
            accessibilityLabel="Barcode number"
            style={styles.manualInput}
          />
          <Pressable
            onPress={() => handle(manual)}
            disabled={!isBarcode(manual)}
            accessibilityRole="button"
            accessibilityLabel="Look up barcode"
            style={[styles.go, !isBarcode(manual) && { opacity: 0.35 }]}>
            <Ionicons name="arrow-forward" size={16} color={C.onAccent} />
          </Pressable>
        </View>
        <Text style={styles.credit}>Product data from Open Food Facts · free and open</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 170,
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.md,
  },
  frame: {
    width: '78%',
    maxWidth: 360,
    height: 150,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  hint: {
    color: '#fff',
    fontFamily: F.medium,
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: S.md,
    padding: S.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  statusText: { color: C.text, fontFamily: F.medium, fontSize: 14 },
  row: { flexDirection: 'row', gap: S.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: S.lg,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.card,
  },
  primary: { flex: 1, backgroundColor: C.accent, borderColor: C.accent },
  buttonText: { color: C.text, fontFamily: F.semi, fontSize: 13 },
  manual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 44,
    paddingLeft: S.md,
    paddingRight: 4,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.card,
  },
  manualInput: { flex: 1, minWidth: 0, color: C.text, fontFamily: F.medium, fontSize: 15, paddingVertical: 0 },
  go: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  credit: { color: C.textFaint, fontFamily: F.regular, fontSize: 11, textAlign: 'center' },
});
