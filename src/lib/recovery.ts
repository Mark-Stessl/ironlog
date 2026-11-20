// "Living muscle map": how tired each muscle still is. Every working set loads the
// muscles it trains (secondary ones half as much), and that load fades away over
// the following days. Pure functions, tested in tests/logic.test.ts.
import { musclesFor, type Region } from './muscles';

/** Load fades to about a third after 30 h, a tenth after 3 days. */
const TAU_H = 30;
/** How many fresh sets make a muscle "fully" tired (the curve flattens out). */
const SCALE = 4;
/** Below this a muscle counts as fresh. */
export const FRESH = 0.25;

export type RecoverySet = { name: string; muscle: string; secondary?: string; date: number };

export type Group = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Core' | 'Legs';

/** Body map regions grouped the way you'd talk about them. */
export const GROUP_REGIONS: Record<Group, Region[]> = {
  Chest: ['chest'],
  Back: ['lats', 'upperBack', 'traps', 'lowerBack', 'rotatorCuff'],
  Shoulders: ['frontDelts', 'sideDelts', 'rearDelts'],
  Arms: ['biceps', 'triceps', 'forearms'],
  Core: ['abs', 'obliques', 'serratus'],
  Legs: ['quads', 'hamstrings', 'glutes', 'sideGlutes', 'adductors', 'calves', 'shins', 'hipFlexors'],
};

export type GroupState = {
  group: Group;
  /** 0 = fresh, 1 = wrecked. */
  fatigue: number;
  status: 'tired' | 'recovering' | 'fresh';
  /** Hours until it counts as fresh again (0 when it already is). */
  readyInH: number;
};

export type Recovery = {
  regions: Partial<Record<Region, number>>;
  groups: GroupState[];
};

const toFatigue = (load: number) => 1 - Math.exp(-load / SCALE);
const loadAt = (f: number) => -SCALE * Math.log(1 - Math.min(f, 0.999));

export function recovery(sets: RecoverySet[], now = Date.now()): Recovery {
  const load: Partial<Record<Region, number>> = {};
  const cache = new Map<string, ReturnType<typeof musclesFor>>();
  for (const s of sets) {
    const hours = (now - s.date) / 3_600_000;
    if (hours < 0 || hours > 24 * 8) continue;
    const key = `${s.name}|${s.muscle}|${s.secondary ?? ''}`;
    let m = cache.get(key);
    if (!m) {
      m = musclesFor(s);
      cache.set(key, m);
    }
    const fade = Math.exp(-hours / TAU_H);
    for (const r of m.primary) load[r] = (load[r] ?? 0) + fade;
    for (const r of m.secondary) load[r] = (load[r] ?? 0) + 0.5 * fade;
  }
  const regions: Partial<Record<Region, number>> = {};
  for (const [r, l] of Object.entries(load)) regions[r as Region] = toFatigue(l ?? 0);

  const freshLoad = loadAt(FRESH);
  const groups = (Object.keys(GROUP_REGIONS) as Group[]).map((group) => {
    const values = GROUP_REGIONS[group].map((r) => regions[r] ?? 0);
    const fatigue = Math.max(0, ...values);
    const l = loadAt(fatigue);
    return {
      group,
      fatigue,
      status: fatigue >= 0.6 ? 'tired' : fatigue >= FRESH ? 'recovering' : 'fresh',
      readyInH: fatigue >= FRESH ? Math.max(1, Math.ceil(TAU_H * Math.log(l / freshLoad))) : 0,
    } as GroupState;
  });
  return { regions, groups };
}

/** Groups an exercise list mainly trains (primary muscles), most-used first. */
export function groupsOf(exercises: { name: string; muscle: string; secondary?: string }[]): Group[] {
  const count = new Map<Group, number>();
  for (const ex of exercises) {
    const prim = musclesFor(ex).primary;
    for (const g of Object.keys(GROUP_REGIONS) as Group[])
      if (GROUP_REGIONS[g].some((r) => prim.includes(r))) count.set(g, (count.get(g) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

/**
 * The routine that fits best today: the one whose main muscles are freshest
 * (only if they're actually fresh enough).
 */
export function suggestRoutine<T extends { groups: Group[] }>(routines: T[], state: Recovery): T | null {
  const f = (g: Group) => state.groups.find((x) => x.group === g)?.fatigue ?? 0;
  let best: { r: T; score: number } | null = null;
  for (const r of routines) {
    // Its two main muscle groups both have to be fresh.
    const main = r.groups.slice(0, 2);
    if (!main.length || main.some((g) => f(g) >= FRESH)) continue;
    const score = main.reduce((sum, g) => sum + f(g), 0) / main.length;
    if (!best || score < best.score) best = { r, score };
  }
  return best?.r ?? null;
}

/** "about 20 h", "about 2 days". */
export function fmtReadyIn(h: number): string {
  if (h <= 1) return 'within the hour';
  if (h < 36) return `in about ${h} h`;
  return `in about ${Math.round(h / 24)} days`;
}
