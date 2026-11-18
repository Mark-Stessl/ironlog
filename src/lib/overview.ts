// Overall stats for the profile: eating and body weight over a period.
// Pure functions, tested in tests/logic.test.ts.
import type { Goals, Nutrients } from './nutrition';

export type NutritionSummary = {
  /** Days with anything logged. */
  days: number;
  /** Averages per logged day. */
  kcal: number;
  protein: number;
  /** Average water per day with water logged, in ml. */
  waterMl: number;
  /** Days with calories within ±10 % of the goal. */
  onTarget: number;
  /** Days that reached the protein goal. */
  proteinDays: number;
};

export function nutritionSummary(
  totals: Map<string, Nutrients>,
  water: Map<string, number>,
  goals: Pick<Goals, 'kcal' | 'protein'>,
): NutritionSummary {
  const days = [...totals.values()].filter((n) => (n.kcal ?? 0) > 0);
  const avg = (f: (n: Nutrients) => number) => (days.length ? days.reduce((s, n) => s + f(n), 0) / days.length : 0);
  const sips = [...water.values()].filter((ml) => ml > 0);
  return {
    days: days.length,
    kcal: avg((n) => n.kcal ?? 0),
    protein: avg((n) => n.protein ?? 0),
    waterMl: sips.length ? sips.reduce((s, ml) => s + ml, 0) / sips.length : 0,
    onTarget: days.filter((n) => Math.abs((n.kcal ?? 0) - goals.kcal) <= goals.kcal * 0.1).length,
    proteinDays: days.filter((n) => (n.protein ?? 0) >= goals.protein).length,
  };
}

/**
 * Weight change within [from, to): the last weigh-in in the period minus the
 * last one before it (or the first in the period if there's none before).
 * Null when there aren't two weigh-ins to compare.
 */
export function weightChange(
  list: { value: number; measured_at: number }[],
  from: number,
  to: number,
): { now: number; change: number } | null {
  const sorted = [...list].sort((a, b) => a.measured_at - b.measured_at);
  const inside = sorted.filter((m) => m.measured_at >= from && m.measured_at < to);
  if (!inside.length) return null;
  const before = sorted.filter((m) => m.measured_at < from).at(-1) ?? (inside.length > 1 ? inside[0] : null);
  const last = inside[inside.length - 1];
  if (!before) return null;
  return { now: last.value, change: Math.round((last.value - before.value) * 10) / 10 };
}
