import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text } from 'react-native';

import { C, F } from '@/lib/theme';

/** Your profile picture, or your first letter on the app's gradient when there's none. */
export function Avatar({ photo, name, size }: { photo: string; name: string; size: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (photo)
    return (
      <Image
        source={{ uri: photo }}
        style={[round, styles.photo]}
        contentFit="cover"
        accessibilityLabel="Profile picture"
      />
    );
  const initial = (name.trim()[0] ?? '').toUpperCase();
  return (
    <LinearGradient
      colors={['#22D3EE', '#0E7490']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[round, styles.box]}>
      {initial ? (
        <Text style={[styles.letter, { fontSize: size * 0.44 }]}>{initial}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.4} color={C.onAccent} />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  photo: { borderWidth: 2, borderColor: C.accentLine, backgroundColor: C.cardHi },
  box: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: C.onAccent, fontFamily: F.display },
});
