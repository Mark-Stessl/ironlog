import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BodyMap, tiredColor } from '@/components/body-map';
import { Card, SectionTitle, text } from '@/components/ui';
import { recentMuscleSets, routinesWithExercises } from '@/lib/db';
import { fmtReadyIn, groupsOf, recovery, suggestRoutine, type GroupState } from '@/lib/recovery';
import { C, F, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

/**
 * The living muscle map: muscles glow after training and cool down over the next
 * days. Says what's fresh and which routine fits today.
 */
export function RecoveryCard() {
  const [data] = useFocusData(async (db) => {
    const [sets, routines] = await Promise.all([recentMuscleSets(db), routinesWithExercises(db)]);
    return { sets, routines: routines.map((r) => ({ ...r, groups: groupsOf(r.exercises) })) };
  });
  // Re-check every few minutes while the page is open: muscles keep cooling down.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  if (!data) return null;

  const state = recovery(data.sets, now);
  const fresh = state.groups.filter((g) => g.status === 'fresh').map((g) => g.group);
  const busy = state.groups.filter((g) => g.status !== 'fresh').sort((a, b) => b.fatigue - a.fatigue);
  const pick = suggestRoutine(data.routines, state);
  const allFresh = busy.length === 0;

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <SectionTitle title="Muscle recovery" right={<Text style={text.faint}>updates as you rest</Text>} />
      <Card style={{ gap: S.md }}>
        <View style={styles.top}>
          <View style={{ width: 150 }}>
            <BodyMap heat={state.regions} palette="tired" height={150} legend={false} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {allFresh ? (
              <>
                <Text style={text.strong}>Everything's fresh</Text>
                <Text style={text.faint}>No muscle is still tired from training. Go for whatever you like.</Text>
              </>
            ) : (
              busy.slice(0, 4).map((g) => <GroupLine key={g.group} g={g} />)
            )}
            {!allFresh && fresh.length ? (
              <Text style={[text.faint, { marginTop: 2 }]} numberOfLines={2}>
                <Text style={{ color: C.good, fontFamily: F.semi }}>Fresh: </Text>
                {fresh.join(', ')}
              </Text>
            ) : null}
          </View>
        </View>

        {pick ? (
          <Pressable
            onPress={() => router.push({ pathname: '/routine/[id]', params: { id: String(pick.id) } })}
            accessibilityRole="button"
            accessibilityLabel={`Suggested today: ${pick.name}`}
            style={({ pressed }) => [styles.suggest, pressed && { opacity: 0.85 }]}>
            <Ionicons name="sparkles" size={18} color={C.accent} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[text.strong, { color: C.accent }]} numberOfLines={1}>
                Today fits {pick.name}
              </Text>
              <Text style={text.faint} numberOfLines={1}>
                {pick.groups.slice(0, 2).join(' and ')} {pick.groups.length > 1 ? 'are' : 'is'} fresh
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.accent} />
          </Pressable>
        ) : !allFresh && fresh.length ? (
          <View style={styles.suggest}>
            <Ionicons name="sparkles" size={18} color={C.accent} />
            <Text style={[text.body, { flex: 1 }]}>
              Good day for <Text style={{ fontFamily: F.semi }}>{fresh.slice(0, 2).join(' or ')}</Text>
            </Text>
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

function GroupLine({ g }: { g: GroupState }) {
  return (
    <View style={styles.line} accessibilityLabel={`${g.group} ${g.status}, fresh ${fmtReadyIn(g.readyInH)}`}>
      <View style={[styles.dot, { backgroundColor: tiredColor(Math.max(0.3, g.fatigue)) }]} />
      <Text style={[text.body, { fontFamily: F.semi, width: 74 }]}>{g.group}</Text>
      <View style={styles.meter}>
        <View
          style={[
            styles.meterFill,
            { width: `${Math.round(g.fatigue * 100)}%`, backgroundColor: tiredColor(Math.max(0.3, g.fatigue)) },
          ]}
        />
      </View>
      <Text style={[text.faint, { width: 68, textAlign: 'right' }]} numberOfLines={1}>
        {g.readyInH < 36 ? `${g.readyInH} h` : `${Math.round(g.readyInH / 24)} days`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meter: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.bg, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
  },
});
