import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { fmtVolume } from '@/lib/format';
import { fmtDelta, type Race } from '@/lib/race';
import { C, F, R, S } from '@/lib/theme';

const SPRING = { damping: 18, stiffness: 140 };

/**
 * You against last time: two bars (you in cyan, last time as a grey ghost) and how
 * far ahead or behind you are. `total` compares against last time's whole workout.
 */
export function RaceBar({ race, total, compact }: { race: Race; total?: boolean; compact?: boolean }) {
  const ghost = total ? race.ghostTotal : race.ghost;
  if (!ghost) return null;
  const delta = race.you / ghost - 1;
  const max = Math.max(race.you, ghost, 1);
  const ahead = Math.round(delta * 100) > 0;
  const behind = Math.round(delta * 100) < 0;
  const color = ahead ? C.good : behind ? '#F5A524' : C.textDim;

  const youStyle = useAnimatedStyle(() => ({ width: withSpring(`${(race.you / max) * 100}%`, SPRING) }));
  const ghostStyle = useAnimatedStyle(() => ({ width: withSpring(`${(ghost / max) * 100}%`, SPRING) }));

  const title = total
    ? ahead
      ? `${fmtDelta(delta)} more than last time`
      : behind
        ? `${fmtDelta(delta)} compared with last time`
        : 'Same as last time'
    : ahead
      ? `${fmtDelta(delta)} ahead of last time`
      : behind
        ? `${fmtDelta(delta)} behind last time`
        : 'Level with last time';

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      style={[styles.box, compact && styles.compact]}
      accessibilityLabel={`${title}. You ${fmtVolume(race.you)}, last time ${fmtVolume(ghost)}`}>
      <View style={styles.head}>
        <Ionicons name={ahead ? 'trending-up' : behind ? 'trending-down' : 'remove'} size={16} color={color} />
        <Text style={[styles.title, { color }]}>{title}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.who}>You</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { backgroundColor: C.accent }, youStyle]} />
        </View>
        <Text style={styles.num}>{fmtVolume(race.you)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.who}>Last</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, styles.ghost, ghostStyle]} />
        </View>
        <Text style={[styles.num, { color: C.textFaint }]}>{fmtVolume(ghost)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    gap: 6,
    padding: S.md,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  compact: { padding: 10, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title: { fontFamily: F.semi, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  who: { width: 34, color: C.textDim, fontFamily: F.medium, fontSize: 12 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.bg, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  ghost: { backgroundColor: C.borderHi },
  num: {
    width: 64,
    textAlign: 'right',
    color: C.text,
    fontFamily: F.semi,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
