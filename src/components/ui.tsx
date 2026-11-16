import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, S } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Button({
  label,
  onPress,
  icon,
  kind = 'primary',
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const bg = kind === 'primary' ? C.accent : kind === 'secondary' ? C.cardHi : 'transparent';
  const fg = kind === 'primary' ? C.onAccent : kind === 'danger' ? C.danger : kind === 'ghost' ? C.accent : C.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: pressed ? 0.7 : 1 },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={[styles.buttonLabel, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && { backgroundColor: C.accentDim, borderColor: C.accent }]}>
      <Text style={[styles.chipLabel, active && { color: C.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={C.textFaint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

export function HeaderButton({
  icon,
  label,
  onPress,
  color = C.accent,
}: {
  icon?: IconName;
  label?: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label ?? icon}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, marginRight: Platform.OS === 'web' ? 12 : 0 })}>
      {icon ? <Ionicons name={icon} size={22} color={color} /> : null}
      {label && !icon ? <Text style={{ color, fontSize: 16, fontWeight: '700' }}>{label}</Text> : null}
    </Pressable>
  );
}

export const text = StyleSheet.create({
  h1: { color: C.text, fontSize: 26, fontWeight: '800' },
  h2: { color: C.text, fontSize: 18, fontWeight: '700' },
  body: { color: C.text, fontSize: 16 },
  dim: { color: C.textDim, fontSize: 14 },
  faint: { color: C.textFaint, fontSize: 12 },
  label: { color: C.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: S.md, borderRadius: R.sm },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  chip: {
    paddingHorizontal: S.md,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    justifyContent: 'center',
  },
  chipLabel: { color: C.textDim, fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  empty: { alignItems: 'center', paddingVertical: S.xxl, paddingHorizontal: S.xl, gap: S.sm },
  emptyTitle: { color: C.textDim, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyHint: { color: C.textFaint, fontSize: 14, textAlign: 'center' },
});
