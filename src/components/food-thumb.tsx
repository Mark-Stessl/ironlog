import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import type { FoodItem } from '@/lib/foods';
import { RECIPE_PHOTOS } from '@/lib/recipe-photos';
import { C } from '@/lib/theme';

export type ThumbData = { ref: string; image?: string; emoji?: string };

/** The bundled photo of a built-in recipe, or the item's own photo. */
export function photoSource(t: ThumbData): ImageSourcePropType | null {
  if (t.ref.startsWith('r:')) {
    const p = RECIPE_PHOTOS[t.ref.slice(2)];
    if (p) return p.source;
  }
  return t.image ? { uri: t.image } : null;
}

/** Square photo, or the food's emoji when there is no photo. */
export function FoodThumb({ item, size = 40, radius = 10 }: { item: ThumbData | FoodItem; size?: number; radius?: number }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : photoSource(item);
  const box = { width: size, height: size, borderRadius: radius };
  if (src) {
    return (
      <View style={[styles.box, box]}>
        <Image source={src} style={box} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      </View>
    );
  }
  return (
    <View style={[styles.box, styles.emojiBox, box]}>
      {item.emoji ? (
        <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.7 }} allowFontScaling={false}>
          {item.emoji}
        </Text>
      ) : (
        <Ionicons name="restaurant-outline" size={size * 0.42} color={C.textDim} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: C.cardHi },
  emojiBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
});
