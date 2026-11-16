import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F, R, S, useIsDesktop } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Pressable state incl. mouse hover (react-native-web reports `hovered`). */
type PressState = PressableStateCallbackType & { hovered?: boolean };

// ── Text ────────────────────────────────────────────────────────────────

export const text = StyleSheet.create({
  title: { color: C.text, fontFamily: F.display, fontSize: 24, letterSpacing: -0.6 },
  h2: { color: C.text, fontFamily: F.displaySemi, fontSize: 16, letterSpacing: -0.2 },
  body: { color: C.text, fontFamily: F.regular, fontSize: 14, lineHeight: 20 },
  strong: { color: C.text, fontFamily: F.semi, fontSize: 14 },
  dim: { color: C.textDim, fontFamily: F.regular, fontSize: 13 },
  faint: { color: C.textFaint, fontFamily: F.regular, fontSize: 12 },
  label: {
    color: C.textFaint,
    fontFamily: F.semi,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  num: { color: C.text, fontFamily: F.displaySemi, fontSize: 16, fontVariant: ['tabular-nums'] },
});

// ── Layout ──────────────────────────────────────────────────────────────

/** Scrollable page with Nightshelf-like padding; wider on desktop. */
export function Page({
  children,
  maxWidth = 760,
  scroll = true,
  topInset = false,
  contentStyle,
}: {
  children: ReactNode;
  maxWidth?: number;
  scroll?: boolean;
  /** Pad for the status bar (pages without a navigation header). */
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const desktop = useIsDesktop();
  const insets = useSafeAreaInsets(); // tab pages have no header, so keep clear of the status bar
  const inner = (
    <View
      style={[
        { width: '100%', maxWidth, alignSelf: 'center', gap: S.md },
        desktop
          ? { paddingHorizontal: 40, paddingTop: 32 + insets.top, paddingBottom: 64 }
          : { padding: S.lg, paddingTop: S.lg + (topInset ? insets.top : 0), paddingBottom: 48 },
        contentStyle,
      ]}>
      {children}
    </View>
  );
  if (!scroll) return <View style={{ flex: 1 }}>{inner}</View>;
  return (
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
      {inner}
    </ScrollView>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={styles.pageHead}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={text.title} numberOfLines={1}>
          {title}
        </Text>
        {sub ? <Text style={[text.dim, { marginTop: 2 }]}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={text.label}>{title}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A group of rows on one surface, separated by hairlines. */
export function ListCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.listCard, style]}>{children}</View>;
}

export function ListRow({
  children,
  onPress,
  active,
  last,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  active?: boolean;
  last?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={(s: PressState) => [
        styles.listRow,
        !last && styles.listRowLine,
        (s.hovered || s.pressed) && onPress ? { backgroundColor: C.cardHi } : null,
        active && { backgroundColor: C.accentDim },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

// ── Controls ────────────────────────────────────────────────────────────

export function Button({
  label,
  onPress,
  icon,
  kind = 'secondary',
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
  const fg =
    kind === 'primary' ? C.onAccent : kind === 'danger' ? C.danger : kind === 'ghost' ? C.textDim : C.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={(s: PressState) => [
        styles.button,
        small && styles.buttonSmall,
        kind === 'primary' && { backgroundColor: C.accent, borderColor: C.accent },
        kind === 'secondary' && { backgroundColor: C.card, borderColor: C.borderHi },
        (kind === 'ghost' || kind === 'danger') && { backgroundColor: 'transparent', borderColor: 'transparent' },
        s.hovered && kind === 'secondary' && { borderColor: C.accentLine, backgroundColor: C.cardHi },
        s.hovered && kind === 'ghost' && { backgroundColor: C.card },
        s.hovered && kind === 'danger' && { backgroundColor: 'rgba(248,113,113,0.08)' },
        s.hovered && kind === 'primary' && { opacity: 0.9 },
        s.pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={small ? 14 : 16} color={fg} /> : null}
      <Text style={[styles.buttonLabel, small && { fontSize: 12 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color = C.textDim,
  size = 18,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(s: PressState) => [styles.iconButton, (s.hovered || s.pressed) && { backgroundColor: C.cardHi }]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={(s: PressState) => [
        styles.chip,
        s.hovered && !active && { borderColor: C.borderHi },
        active && { backgroundColor: C.accentDim, borderColor: C.accentLine },
      ]}>
      <Text style={[styles.chipLabel, active && { color: C.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={22} color={C.textFaint} />
      <Text style={[text.strong, { color: C.textDim, textAlign: 'center' }]}>{title}</Text>
      {hint ? <Text style={[text.faint, { textAlign: 'center' }]}>{hint}</Text> : null}
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
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        marginRight: Platform.OS === 'web' ? 12 : 0,
      })}>
      {icon ? <Ionicons name={icon} size={20} color={color} /> : null}
      {label && !icon ? <Text style={{ color, fontSize: 14, fontFamily: F.semi }}>{label}</Text> : null}
    </Pressable>
  );
}

/** Small "label / value" pair for stats rows. */
export function Stat({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={text.faint}>{label}</Text>
      {children ?? <Text style={text.num}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  pageHead: { flexDirection: 'row', alignItems: 'flex-end', gap: S.md, marginBottom: S.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: S.lg,
    minHeight: 28,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  listCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 10, paddingHorizontal: S.md },
  listRowLine: { borderBottomWidth: 1, borderBottomColor: C.border },
  button: {
    height: 36,
    borderRadius: R.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonSmall: { height: 30, paddingHorizontal: 10, borderRadius: R.sm },
  buttonLabel: { fontSize: 13, fontFamily: F.medium },
  iconButton: { width: 30, height: 30, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  chip: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
  },
  chipLabel: { color: C.textDim, fontSize: 12, fontFamily: F.medium },
  empty: { alignItems: 'center', paddingVertical: S.xl, paddingHorizontal: S.xl, gap: 6 },
});
