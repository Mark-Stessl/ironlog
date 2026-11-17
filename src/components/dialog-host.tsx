import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Button, text } from '@/components/ui';
import { registerDialogHost, type DialogOptions } from '@/lib/dialog';
import { C, F, R, S } from '@/lib/theme';

type Open = DialogOptions & { id: number; resolve: (result: boolean | string) => void };

const TONE = {
  default: { color: C.accent, bg: C.accentDim, border: C.accentLine },
  success: { color: C.good, bg: 'rgba(52,199,123,0.12)', border: 'rgba(52,199,123,0.45)' },
  danger: { color: C.danger, bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.40)' },
  gold: { color: C.gold, bg: 'rgba(233,190,88,0.12)', border: 'rgba(233,190,88,0.45)' },
} as const;

/** Shows the cards requested through `confirm()` / `notify()` in lib/dialog. Mount once. */
export function DialogHost() {
  const [open, setOpen] = useState<Open | null>(null);

  useEffect(() => {
    let id = 0;
    return registerDialogHost((req) => setOpen({ ...req, id: ++id }));
  }, []);

  const close = (result: boolean | string) => {
    if (!open) return;
    open.resolve(result);
    setOpen(null);
  };

  // Keyboard on desktop: Enter confirms, Escape cancels.
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter' && !open.choices) close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;
  const tone = TONE[open.tone ?? 'default'];
  const single = !open.cancelLabel;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
        <Pressable
          style={styles.backdrop}
          onPress={() => close(false)}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          key={open.id}
          entering={ZoomIn.springify().damping(18).stiffness(260)}
          style={styles.card}
          accessibilityRole="alert"
          accessibilityViewIsModal>
          <View style={[styles.icon, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Ionicons
              name={open.icon ?? (open.tone === 'danger' ? 'warning-outline' : 'information')}
              size={20}
              color={tone.color}
            />
          </View>
          <Text style={[text.title, { fontSize: 19 }]}>{open.title}</Text>
          {open.message ? <Text style={[text.body, { color: C.textDim }]}>{open.message}</Text> : null}

          {open.details?.length ? (
            <View style={styles.details}>
              {open.details.map((d, i) => (
                <View key={d.label} style={[styles.detail, i > 0 && styles.detailLine]}>
                  <Text style={text.faint}>{d.label}</Text>
                  <Text style={styles.detailValue}>{d.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {open.items?.length ? (
            <View style={{ gap: 6, marginTop: 2 }}>
              {open.items.map((item, i) => (
                <Animated.View
                  key={i}
                  entering={FadeIn.delay(80 + i * 70).duration(220)}
                  style={[styles.item, { borderColor: open.tone === 'gold' ? tone.border : C.border }]}>
                  <Ionicons name={item.icon ?? 'trophy'} size={15} color={tone.color} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={text.strong}>{item.title}</Text>
                    {item.detail ? <Text style={text.faint}>{item.detail}</Text> : null}
                  </View>
                </Animated.View>
              ))}
            </View>
          ) : null}

          {open.note ? (
            <View style={styles.note}>
              <Ionicons name="alert-circle-outline" size={15} color={C.gold} />
              <Text style={[text.dim, { color: C.gold, flex: 1 }]}>{open.note}</Text>
            </View>
          ) : null}

          {open.choices ? (
            <View style={{ gap: S.sm, marginTop: S.sm }}>
              {open.choices.map((c) => (
                <Button
                  key={c.value}
                  label={c.label}
                  icon={c.icon}
                  kind={c.primary ? 'primary' : 'secondary'}
                  onPress={() => close(c.value)}
                />
              ))}
              <Button label={open.cancelLabel ?? 'Cancel'} kind="ghost" onPress={() => close(false)} />
            </View>
          ) : (
            <View style={styles.actions}>
              {!single ? (
                <Button label={open.cancelLabel!} kind="secondary" onPress={() => close(false)} style={{ flex: 1 }} />
              ) : null}
              <Button
                label={open.confirmLabel}
                kind="primary"
                onPress={() => close(true)}
                style={[
                  { flex: 1 },
                  open.tone === 'danger' && { backgroundColor: C.danger, borderColor: C.danger },
                  open.tone === 'success' && { backgroundColor: C.good, borderColor: C.good },
                  open.tone === 'gold' && { backgroundColor: C.gold, borderColor: C.gold },
                ]}
              />
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,6,8,0.72)' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: S.lg },
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
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  details: {
    flexDirection: 'row',
    marginTop: 4,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  detail: { flex: 1, gap: 2, paddingVertical: 10, paddingHorizontal: S.md },
  detailLine: { borderLeftWidth: 1, borderLeftColor: C.border },
  detailValue: { color: C.text, fontFamily: F.displaySemi, fontSize: 15, fontVariant: ['tabular-nums'] },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: R.md,
    backgroundColor: 'rgba(233,190,88,0.08)',
  },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: S.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    backgroundColor: C.bg,
  },
});
