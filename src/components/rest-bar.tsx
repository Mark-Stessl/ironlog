import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fmtDuration } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { askForReminders, reminderState, scheduleRestReminder, type ReminderState } from '@/lib/rest-reminder';
import { C, F, R, S } from '@/lib/theme';

/** Countdown shown at the bottom of the workout after ticking off a set. */
export function RestBar({
  endAt,
  total,
  bottomInset,
  label,
  onAdjust,
  onDone,
}: {
  endAt: number;
  total: number;
  bottomInset: number;
  /** Exercise you're resting for, used in the reminder text. */
  label?: string;
  onAdjust: (deltaMs: number) => void;
  onDone: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [go, setGo] = useState(false);
  const finished = useRef(false);
  const remaining = endAt - now;

  // Smooth progress line: animate from where we are to empty over the time left.
  const progress = useSharedValue(Math.min(1, Math.max(0, (endAt - Date.now()) / total)));
  const goAnim = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    const left = Math.max(0, endAt - Date.now());
    progress.value = Math.min(1, left / total);
    progress.value = withTiming(0, { duration: left, easing: Easing.linear });
    return () => cancelAnimation(progress);
  }, [endAt, total, progress]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Reminder for when you switch to another app during the break.
  const [reminders, setReminders] = useState<ReminderState>(() => reminderState());
  useEffect(() => {
    let cancel: (() => void) | null = null;
    let gone = false;
    const body = label ? `Time for your next set of ${label}.` : 'Time for your next set.';
    scheduleRestReminder(Math.max(0, endAt - Date.now()) / 1000, body).then((c) => {
      if (gone) c();
      else cancel = c;
    });
    return () => {
      gone = true;
      cancel?.();
    };
  }, [endAt, label, reminders]);

  const lastSeconds = remaining > 0 && remaining <= 3500;
  useEffect(() => {
    pulse.value = lastSeconds
      ? withRepeat(withSequence(withTiming(1.12, { duration: 180 }), withTiming(1, { duration: 320 })), -1)
      : withTiming(1, { duration: 150 });
  }, [lastSeconds, pulse]);

  // Time's up: flash green for a moment, then close.
  useEffect(() => {
    if (remaining > 0 || finished.current) return;
    finished.current = true;
    haptic.success();
    setGo(true);
    goAnim.value = withTiming(1, { duration: 250 });
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [remaining, onDone, goAnim]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const barStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(goAnim.value, [0, 1], [C.borderHi, 'rgba(52,199,123,0.6)']),
    backgroundColor: interpolateColor(goAnim.value, [0, 1], [C.cardHi, '#0F2A1D']),
  }));
  const timeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={[styles.wrap, { bottom: bottomInset + S.md }]} pointerEvents="box-none">
      <Animated.View
        entering={FadeInDown.springify().damping(15)}
        exiting={FadeOutDown.duration(200)}
        style={[styles.bar, barStyle]}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fill]} />
        </View>
        {go ? (
          <View style={[styles.row, { justifyContent: 'center' }]}>
            <Ionicons name="flash" size={16} color={C.good} />
            <Text style={[styles.time, { color: C.good, fontSize: 16 }]}>Time for your next set</Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Text style={styles.label}>Rest</Text>
            <Animated.Text style={[styles.time, lastSeconds && { color: C.accent }, timeStyle]}>
              {fmtDuration(Math.max(0, remaining))}
            </Animated.Text>
            <View style={{ flex: 1 }} />
            {reminders === 'ask' ? (
              <Pressable
                onPress={async () => {
                  await askForReminders();
                  setReminders(reminderState());
                }}
                style={styles.btn}
                accessibilityLabel="Notify me when the rest is over, even in another app">
                <Ionicons name="notifications-outline" size={14} color={C.accent} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => onAdjust(-15000)} style={styles.btn} accessibilityLabel="15 seconds less rest">
              <Text style={styles.btnText}>−15</Text>
            </Pressable>
            <Pressable onPress={() => onAdjust(15000)} style={styles.btn} accessibilityLabel="15 seconds more rest">
              <Text style={styles.btnText}>+15</Text>
            </Pressable>
            <Pressable
              onPress={onDone}
              style={[styles.btn, { backgroundColor: C.accent }]}
              accessibilityLabel="Skip rest">
              <Text style={[styles.btnText, { color: C.onAccent }]}>Skip</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: S.lg },
  bar: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: R.lg,
    overflow: 'hidden',
  },
  track: { height: 2, backgroundColor: C.border },
  fill: { height: 2, backgroundColor: C.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
    minHeight: 46,
  },
  label: { color: C.textDim, fontSize: 12, fontFamily: F.medium, marginRight: 4 },
  time: { color: C.text, fontSize: 18, fontFamily: F.displaySemi, fontVariant: ['tabular-nums'] },
  btn: {
    minWidth: 44,
    height: 30,
    borderRadius: R.sm,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  btnText: { color: C.text, fontSize: 12, fontFamily: F.semi },
});
