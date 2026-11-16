import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { getMedia, imageUrl } from '@/lib/exercise-media';
import { C } from '@/lib/theme';

/**
 * Illustration of an exercise. With `animate`, it switches between the start
 * and the peak pose, like a slow GIF. Falls back to an icon for exercises
 * without a picture (custom ones, or if the image can't load).
 */
export function ExerciseImage({
  name,
  equipment,
  size,
  animate = false,
  radius,
}: {
  name: string;
  equipment: string;
  size: number;
  animate?: boolean;
  radius?: number;
}) {
  const media = getMedia(name);
  const frames = media?.frames ?? [];
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!animate || frames.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), 900);
    return () => clearInterval(t);
  }, [animate, frames.length]);

  const box = { width: size, height: size, borderRadius: radius ?? size / 4 };

  if (!frames.length || failed) {
    return (
      <View style={[styles.fallback, box]}>
        <Ionicons name={iconFor(equipment)} size={Math.round(size * 0.45)} color={C.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.frame, box]}>
      {/* All frames stay mounted so switching never flashes while loading. */}
      {frames.map((f, i) => (
        <Image
          key={f}
          source={{ uri: imageUrl(f) }}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          style={[StyleSheet.absoluteFill, { opacity: i === frame ? 1 : 0 }]}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

export function iconFor(equipment: string) {
  switch (equipment) {
    case 'Machine':
    case 'Smith Machine':
      return 'hardware-chip-outline' as const;
    case 'Cable':
      return 'git-pull-request-outline' as const;
    case 'Bodyweight':
      return 'body-outline' as const;
    default:
      return 'barbell-outline' as const;
  }
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#DCEFF8' },
  fallback: { backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center' },
});
