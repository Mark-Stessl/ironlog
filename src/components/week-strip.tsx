import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { C, F, S } from '@/lib/theme';

const DAY = 24 * 60 * 60 * 1000;
const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}

/** Weeks in a row (up to now) with at least one workout. This week counts once it has one. */
export function weekStreak(finishedAt: number[], now = Date.now()): number {
  const weeks = new Set(finishedAt.map(startOfWeek));
  let week = startOfWeek(now);
  if (!weeks.has(week)) week = startOfWeek(week - DAY); // this week isn't over yet
  let streak = 0;
  while (weeks.has(week)) {
    streak++;
    week = startOfWeek(week - DAY);
  }
  return streak;
}

/** Monday–Sunday of the current week; days you trained light up. */
export function WeekStrip({ finishedAt, now = Date.now() }: { finishedAt: number[]; now?: number }) {
  const monday = startOfWeek(now);
  const today = new Date(now).setHours(0, 0, 0, 0);
  const trained = new Set(finishedAt.map((t) => new Date(t).setHours(0, 0, 0, 0)));
  const streak = weekStreak(finishedAt, now);

  return (
    <View style={styles.wrap}>
      <View style={styles.days}>
        {LABELS.map((label, i) => {
          const day = new Date(monday + i * DAY + 12 * 60 * 60 * 1000).setHours(0, 0, 0, 0); // DST-safe
          const done = trained.has(day);
          const isToday = day === today;
          return (
            <View key={i} style={styles.day}>
              <Text style={[styles.label, isToday && { color: C.text }]}>{label}</Text>
              <View style={[styles.dot, isToday && styles.dotToday, day > today && { opacity: 0.6 }]}>
                {done ? (
                  <Animated.View
                    entering={ZoomIn.delay(i * 50)
                      .springify()
                      .damping(10)}
                    style={styles.dotDone}>
                    <Ionicons name="checkmark" size={12} color={C.onAccent} />
                  </Animated.View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      {streak > 0 ? (
        <View style={styles.streak}>
          <Ionicons name="flame" size={14} color={C.gold} />
          <Text style={styles.streakText}>
            {streak} {streak === 1 ? 'week' : 'weeks'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  days: { flexDirection: 'row', gap: 6 },
  day: { alignItems: 'center', gap: 4 },
  label: { color: C.textFaint, fontFamily: F.medium, fontSize: 10 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotToday: { borderColor: C.accentLine },
  dotDone: {
    position: 'absolute',
    top: -1,
    left: -1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(233,190,88,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(233,190,88,0.30)',
  },
  streakText: { color: C.gold, fontFamily: F.semi, fontSize: 12 },
});
