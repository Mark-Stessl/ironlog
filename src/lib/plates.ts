// Plate calculator: which plates go on each side of the bar. Pure, tested in tests/logic.test.ts.

/** Standard gym plates in kg, heaviest first. */
export const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
export const BAR_OPTIONS = [20, 15, 10] as const;

/** Competition colours, so the drawing looks like the plates in the gym. */
export const PLATE_COLOR: Record<number, string> = {
  25: '#E5484D',
  20: '#3B82F6',
  15: '#EAB308',
  10: '#22C55E',
  5: '#E6EEF0',
  2.5: '#3F4A50',
  1.25: '#A3B1B6',
};

export type PlateResult = {
  /** Plates for ONE side, heaviest first. */
  perSide: number[];
  /** What the bar weighs with these plates. */
  total: number;
  exact: boolean;
  /** Nearest weights you can actually load around the target (when not exact). */
  below: number;
  above: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Greedy works for these plate sizes: each one is "made of" the smaller ones. */
function load(perSideKg: number, plates: number[]): number[] {
  const out: number[] = [];
  let left = round(perSideKg);
  for (const p of plates) {
    while (left + 1e-9 >= p) {
      out.push(p);
      left = round(left - p);
    }
  }
  return out;
}

export function platesFor(target: number, bar = 20, available: readonly number[] = ALL_PLATES): PlateResult {
  const plates = [...available].sort((a, b) => b - a);
  if (!plates.length || target <= bar) {
    return { perSide: [], total: bar, exact: Math.abs(target - bar) < 1e-9, below: bar, above: bar };
  }
  const perSide = load((target - bar) / 2, plates);
  const total = round(bar + 2 * perSide.reduce((s, p) => s + p, 0));
  const smallest = plates[plates.length - 1];
  const exact = Math.abs(total - target) < 1e-9;
  return { perSide, total, exact, below: total, above: exact ? total : round(total + 2 * smallest) };
}

/** "20 + 10 + 1.25" */
export function describePlates(perSide: number[]): string {
  return perSide.map(String).join(' + ');
}
