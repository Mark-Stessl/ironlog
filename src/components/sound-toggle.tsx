import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Slider } from '@/components/slider';
import { Button, IconButton, text, type IconName } from '@/components/ui';
import { setSetting } from '@/lib/db';
import { sound, type SoundName } from '@/lib/sound';
import { C, F, S } from '@/lib/theme';

const PREVIEWS: { name: SoundName; label: string; icon: IconName }[][] = [
  [
    { name: 'record', label: 'Record', icon: 'trophy-outline' },
    { name: 'rest', label: 'Rest over', icon: 'timer-outline' },
    { name: 'complete', label: 'Finish', icon: 'flag-outline' },
  ],
  [
    { name: 'foodAdd', label: 'Add food', icon: 'restaurant-outline' },
    { name: 'water', label: 'Water', icon: 'water-outline' },
    { name: 'foodGoal', label: 'Goal', icon: 'checkmark-circle-outline' },
  ],
];

/** Speaker button that opens the sound settings: on/off, volume and previews (all remembered). */
export function SoundToggle() {
  const db = useSQLiteContext();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(sound.isEnabled());
  const [volume, setVolume] = useState(sound.getVolume());
  useEffect(() => sound.subscribe(setOn), []);
  const lastPreview = useRef(0);

  const icon =
    !on || volume === 0 ? 'volume-mute-outline' : volume < 0.4 ? 'volume-low-outline' : 'volume-medium-outline';

  const changeVolume = (v: number) => {
    setVolume(v);
    sound.setVolume(v);
  };
  const saveVolume = (v: number) => {
    setSetting(db, 'sound_volume', v.toFixed(2));
    // A short preview at the new level (not more than every half second).
    if (on && Date.now() - lastPreview.current > 500) {
      lastPreview.current = Date.now();
      sound.play('rest');
    }
  };
  const toggle = (next: boolean) => {
    sound.setEnabled(next);
    setSetting(db, 'sound', next ? '1' : '0');
  };

  return (
    <>
      <IconButton
        icon={icon}
        label="Sound settings"
        color={on ? C.textDim : C.textFaint}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <View style={styles.root}>
          <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
            <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View entering={ZoomIn.springify().damping(18).stiffness(260)} style={styles.card}>
            <View style={styles.head}>
              <View style={styles.icon}>
                <Ionicons name="musical-notes-outline" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.title, { fontSize: 18 }]}>Sound effects</Text>
                <Text style={text.faint}>Workouts and food, all soft. Plays along with your music.</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={text.strong}>Sounds</Text>
              <Switch
                value={on}
                onValueChange={toggle}
                trackColor={{ false: C.cardHi, true: C.accent }}
                thumbColor="#FFFFFF"
                {...({ activeThumbColor: '#FFFFFF' } as object)}
              />
            </View>

            <View style={[{ gap: 4 }, !on && { opacity: 0.4 }]} pointerEvents={on ? 'auto' : 'none'}>
              <View style={styles.row}>
                <Text style={text.strong}>Volume</Text>
                <Text style={styles.percent}>{Math.round(volume * 100)}%</Text>
              </View>
              <View style={styles.sliderRow}>
                <Ionicons name="volume-low-outline" size={16} color={C.textFaint} />
                <View style={{ flex: 1 }}>
                  <Slider value={volume} onChange={changeVolume} onRelease={saveVolume} label="Sound effects volume" />
                </View>
                <Ionicons name="volume-high-outline" size={16} color={C.textFaint} />
              </View>

              <Text style={[text.label, { marginTop: S.md, marginBottom: 6 }]}>Preview</Text>
              {PREVIEWS.map((row, i) => (
                <View key={i} style={[styles.previews, i > 0 && { marginTop: 6 }]}>
                  {row.map((p) => (
                    <Button
                      key={p.name}
                      label={p.label}
                      icon={p.icon}
                      small
                      onPress={() => sound.play(p.name)}
                      style={{ flex: 1 }}
                    />
                  ))}
                </View>
              ))}
            </View>

            <Button label="Done" kind="primary" onPress={() => setOpen(false)} style={{ marginTop: S.lg }} />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.lg },
  backdrop: { flex: 1, backgroundColor: 'rgba(3,6,8,0.72)' },
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
  head: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start', marginBottom: S.sm },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  percent: { color: C.accent, fontFamily: F.semi, fontSize: 13, fontVariant: ['tabular-nums'] },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previews: { flexDirection: 'row', gap: S.sm },
});
