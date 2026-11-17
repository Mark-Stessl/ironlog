import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { fmtWeight } from '@/lib/format';
import { C, F } from '@/lib/theme';

/**
 * Spider / radar chart: one axis per muscle group, the shape grows outward
 * where you trained more. Optionally draws a previous period as a dashed outline.
 */
export function RadarChart<K extends string>({
  axes,
  values,
  compare,
  size = 300,
}: {
  axes: readonly K[];
  values: Record<K, number>;
  compare?: Record<K, number>;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const progress = useGrow(JSON.stringify(values), reduced ? 0 : 900);

  const c = size / 2;
  const radius = size * 0.33;
  const max = Math.max(1, ...axes.map((a) => values[a]), ...(compare ? axes.map((a) => compare[a]) : []));
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
  const at = (i: number, r: number) => [c + Math.cos(angle(i)) * r, c + Math.sin(angle(i)) * r] as const;
  const shape = (v: Record<K, number>, k = 1) => axes.map((a, i) => at(i, (v[a] / max) * radius * k).join(',')).join(' ');

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} accessibilityLabel={axes.map((a) => `${a}: ${setsLabel(values[a])}`).join(', ')}>
        {/* grid */}
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <Polygon
            key={k}
            points={axes.map((_, i) => at(i, radius * k).join(',')).join(' ')}
            fill={k === 1 ? 'rgba(255,255,255,0.015)' : 'none'}
            stroke={C.border}
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = at(i, radius);
          return <Line key={i} x1={c} y1={c} x2={x} y2={y} stroke={C.border} strokeWidth={1} />;
        })}

        {compare ? (
          <Polygon points={shape(compare)} fill="none" stroke={C.textFaint} strokeWidth={1.5} strokeDasharray="4 4" />
        ) : null}

        <Polygon
          points={shape(values, progress)}
          fill="rgba(34,211,238,0.22)"
          stroke={C.accent}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {axes.map((a, i) => {
          const [x, y] = at(i, (values[a] / max) * radius * progress);
          return values[a] > 0 ? <Circle key={a} cx={x} cy={y} r={3.5} fill={C.accent} stroke={C.bg} strokeWidth={1.5} /> : null;
        })}

        {/* labels outside the shape */}
        {axes.map((a, i) => {
          const [x, y] = at(i, radius + 26);
          const cos = Math.cos(angle(i));
          const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
          const dx = Math.abs(cos) < 0.2 ? 0 : cos > 0 ? -10 : 10;
          return (
            <G key={a}>
              <SvgText x={x + dx} y={y - 2} fill={C.text} fontSize={12} fontFamily={F.semi} textAnchor={anchor}>
                {a}
              </SvgText>
              <SvgText x={x + dx} y={y + 13} fill={C.textDim} fontSize={11} fontFamily={F.medium} textAnchor={anchor}>
                {setsLabel(values[a])}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/** 0 → 1 with an ease-out over `duration` ms, restarting whenever `key` changes. */
function useGrow(key: string, duration: number): number {
  const [p, setP] = useState(duration ? 0 : 1);
  const frame = useRef(0);
  useEffect(() => {
    if (!duration) {
      setP(1);
      return;
    }
    let start = 0;
    setP(0);
    const tick = (now: number) => {
      if (!start) start = now;
      const k = Math.min(1, (now - start) / duration);
      setP(1 - Math.pow(1 - k, 3));
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [key, duration]);
  return p;
}

function setsLabel(n: number) {
  const v = Math.round(n * 10) / 10;
  return `${fmtWeight(v)} ${v === 1 ? 'set' : 'sets'}`;
}
