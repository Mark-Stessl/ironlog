import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { shareSvgImage } from '@/lib/share-image';
import { buildSigil, sigilSvg, type Sigil, type SigilInput } from '@/lib/sigil';
import { C, F, R, S } from '@/lib/theme';

/** Draws a workout sigil (see lib/sigil.ts). */
export function SigilView({ sigil, size }: { sigil: Sigil; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel="Workout sigil">
      {sigil.shapes.map((s, i) =>
        s.kind === 'path' ? (
          <Path
            key={i}
            d={s.d}
            fill={s.fill}
            fillOpacity={s.opacity}
            stroke={s.stroke}
            strokeWidth={s.strokeWidth}
            strokeOpacity={s.stroke ? s.opacity : undefined}
          />
        ) : (
          <Circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill={s.fill}
            fillOpacity={s.opacity}
            stroke={s.stroke}
            strokeWidth={s.strokeWidth}
            strokeOpacity={s.stroke ? s.opacity : undefined}
          />
        ),
      )}
    </Svg>
  );
}

/** Summary card: the workout's sigil, with Share and a link to all of them. */
export function SigilCard({
  input,
  title,
  sub,
  grow,
}: {
  input: SigilInput;
  title: string;
  sub: string;
  /** Animate it growing in (just finished). */
  grow?: boolean;
}) {
  const sigil = buildSigil(input);
  const [shareState, setShareState] = useState<string | null>(null);
  const share = async () => {
    const res = await shareSvgImage(
      sigilSvg(sigil, 1080, { title, sub }),
      `ironlog-sigil-${input.id}`,
      `${title} · Ironlog`,
    );
    setShareState(res === 'saved' ? 'Saved as a picture' : res === 'failed' ? "Couldn't share it" : null);
  };
  return (
    <View style={styles.card}>
      <Animated.View
        entering={grow ? ZoomIn.delay(300).springify().damping(11) : FadeIn.duration(300)}
        style={styles.halo}>
        <SigilView sigil={sigil} size={156} />
      </Animated.View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={styles.kicker}>Your sigil</Text>
        <Text style={styles.text}>
          Grown from this workout: {sigil.gold ? 'gold for your records, ' : ''}petals for each exercise, a dot for
          every set.
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={share}
            accessibilityRole="button"
            accessibilityLabel="Share sigil"
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}>
            <Ionicons name="share-outline" size={15} color={C.onAccent} />
            <Text style={styles.buttonText}>Share</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/sigils')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}>
            <Text style={styles.linkText}>All sigils</Text>
          </Pressable>
        </View>
        {shareState ? <Text style={styles.note}>{shareState}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  halo: { borderRadius: 80 },
  kicker: { color: C.accent, fontFamily: F.semi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  text: { color: C.textDim, fontFamily: F.regular, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: 4 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: C.accent,
  },
  buttonText: { color: C.onAccent, fontFamily: F.semi, fontSize: 14 },
  link: { height: 34, paddingHorizontal: 8, justifyContent: 'center' },
  linkText: { color: C.accent, fontFamily: F.semi, fontSize: 14 },
  note: { color: C.textFaint, fontFamily: F.regular, fontSize: 12 },
});
