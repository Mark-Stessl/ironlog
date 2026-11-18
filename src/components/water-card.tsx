import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Card, IconButton, text } from '@/components/ui';
import { C, F, R, S } from '@/lib/theme';
import { useTween } from '@/lib/use-tween';

const GLASS = 'M6 4 H58 L52 92 Q51.5 98 45 98 H19 Q12.5 98 12 92 Z';

/** A glass that fills up as you drink. */
function Glass({ fill }: { fill: number }) {
  const level = Math.max(0, Math.min(1, fill));
  const top = 98 - level * 92;
  return (
    <Svg width={58} height={92} viewBox="0 0 64 102">
      <Defs>
        <ClipPath id="glass">
          <Path d={GLASS} />
        </ClipPath>
        <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5EE3F7" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#0E7490" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={top} width={64} height={102} fill="url(#water)" clipPath="url(#glass)" />
      {level > 0.02 ? (
        <Path
          d={`M0 ${top} Q16 ${top - 3} 32 ${top} T64 ${top} V${top + 3} H0 Z`}
          fill="#A5F3FC"
          opacity={0.5}
          clipPath="url(#glass)"
        />
      ) : null}
      <Path d={GLASS} stroke={C.borderHi} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

function fmtL(ml: number) {
  return `${parseFloat((ml / 1000).toFixed(2))} L`;
}

export function WaterCard({
  ml,
  goal,
  onAdd,
  onUndo,
}: {
  ml: number;
  goal: number;
  onAdd: (ml: number) => void;
  onUndo: () => void;
}) {
  const shown = useTween(ml, 600);
  const done = ml >= goal;
  const glasses = Math.ceil(goal / 250);
  const full = Math.floor(ml / 250);
  return (
    <Card style={styles.card}>
      <Glass fill={goal ? shown / goal : 0} />
      <View style={{ flex: 1, minWidth: 0, gap: S.sm }}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={text.faint}>Water</Text>
            <Text style={styles.value}>
              {fmtL(ml)} <Text style={styles.of}>of {fmtL(goal)}</Text>
            </Text>
          </View>
          {done ? (
            <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.done}>
              <Ionicons name="checkmark" size={14} color={C.onAccent} />
            </Animated.View>
          ) : null}
          {ml > 0 ? <IconButton icon="arrow-undo-outline" label="Remove last drink" onPress={onUndo} size={16} /> : null}
        </View>
        <View style={styles.glasses} accessibilityLabel={`${full} of ${glasses} glasses`}>
          {Array.from({ length: glasses }, (_, i) => (
            <View key={i} style={[styles.pip, i < full && styles.pipOn]} />
          ))}
        </View>
        <View style={styles.buttons}>
          {[
            { ml: 250, label: 'Glass', icon: 'water-outline' as const },
            { ml: 500, label: 'Bottle', icon: 'flask-outline' as const },
          ].map((b) => (
            <Pressable
              key={b.ml}
              onPress={() => onAdd(b.ml)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${b.label.toLowerCase()}, ${b.ml} millilitres`}
              style={({ pressed }) => [styles.add, pressed && { transform: [{ scale: 0.95 }], opacity: 0.8 }]}>
              <Ionicons name={b.icon} size={14} color={C.accent} />
              <Text style={styles.addLabel}>+{b.ml} ml</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  value: { color: C.text, fontFamily: F.display, fontSize: 22, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  of: { color: C.textFaint, fontFamily: F.medium, fontSize: 13, letterSpacing: 0 },
  done: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glasses: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pip: { width: 14, height: 6, borderRadius: 3, backgroundColor: C.cardHi },
  pipOn: { backgroundColor: C.accent },
  buttons: { flexDirection: 'row', gap: S.sm },
  add: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
  },
  addLabel: { color: C.text, fontFamily: F.semi, fontSize: 13 },
});
