import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { pickPhoto } from '@/lib/photo';
import { C, F, R, S } from '@/lib/theme';

/** Optional photo for your own food or recipe. Stored only on this phone. */
export function PhotoField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const pick = async () => {
    const img = await pickPhoto();
    if (img) onChange(img);
  };
  if (!value) {
    return (
      <Pressable
        onPress={pick}
        accessibilityRole="button"
        style={({ pressed }) => [styles.empty, pressed && { opacity: 0.7 }]}>
        <Ionicons name="camera-outline" size={20} color={C.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Add photo</Text>
          <Text style={styles.hint}>Optional · stays on this phone</Text>
        </View>
      </Pressable>
    );
  }
  return (
    <Animated.View entering={FadeIn.duration(250)}>
      <Image source={{ uri: value }} style={styles.photo} resizeMode="cover" accessibilityLabel="Your photo" />
      <View style={styles.actions}>
        <Pressable onPress={pick} style={styles.action} accessibilityRole="button" accessibilityLabel="Change photo">
          <Ionicons name="camera-outline" size={15} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => onChange(null)}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="Remove photo">
          <Ionicons name="trash-outline" size={15} color="#fff" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.borderHi,
  },
  label: { color: C.text, fontFamily: F.semi, fontSize: 13 },
  hint: { color: C.textFaint, fontFamily: F.regular, fontSize: 12 },
  photo: { width: '100%', aspectRatio: 4 / 3, maxHeight: 280, borderRadius: R.lg, backgroundColor: C.cardHi },
  actions: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6 },
  action: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
