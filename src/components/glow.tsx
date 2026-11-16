import { LinearGradient } from 'expo-linear-gradient';

/** Soft cyan light at the top of a screen. Purely decorative. */
export function Glow({ height = 280, strength = 0.1 }: { height?: number; strength?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[`rgba(34,211,238,${strength})`, 'rgba(34,211,238,0.03)', 'rgba(34,211,238,0)']}
      locations={[0, 0.45, 1]}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
    />
  );
}
