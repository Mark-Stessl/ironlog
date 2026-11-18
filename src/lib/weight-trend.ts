// Weight trend and "does my calorie goal match reality?". Pure functions, tested
// in tests/logic.test.ts.
//
// Day-to-day weight jumps by 1-2 kg from water, salt and food in the gut, so the
// raw line hides the real direction. The trend is an exponential moving average
// (the "Hacker's Diet" method): each day moves it 10 % of the way towards the scale.
// With a few weeks of trend and food log, the real maintenance calories follow from
// energy balance: what you ate minus what the change in body mass stored or released.

/** Energy in 1 kg of body mass change. 7,700 kcal is the usual rule of thumb (mostly fat). */
export const KCAL_PER_KG = 7700;
const DAY = 86_400_000;

export type WeighIn = { value: number; measured_at: number };
export type TrendPoint = { t: number; v: number; trend: number };

/** Local midnight of a timestamp's day. */
function dayOf(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * The smoothed trend at every weigh-in day. Several weigh-ins on one day are
 * averaged; gaps of several days move the trend as much as that many days would.
 */
export function weightTrend(entries: WeighIn[], alpha = 0.1): TrendPoint[] {
  const byDay = new Map<number, number[]>();
  for (const e of entries) {
    const d = dayOf(e.measured_at);
    byDay.set(d, [...(byDay.get(d) ?? []), e.value]);
  }
  const days = [...byDay.entries()]
    .map(([t, vs]) => ({ t, v: vs.reduce((s, x) => s + x, 0) / vs.length }))
    .sort((a, b) => a.t - b.t);
  const out: TrendPoint[] = [];
  for (const d of days) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ ...d, trend: d.v });
      continue;
    }
    const gap = Math.max(1, Math.round((d.t - prev.t) / DAY));
    const a = 1 - Math.pow(1 - alpha, gap);
    out.push({ ...d, trend: prev.trend + a * (d.v - prev.trend) });
  }
  return out;
}

/** The trend on a given day, interpolated between weigh-ins. */
function trendAt(points: TrendPoint[], t: number): number {
  if (t <= points[0].t) return points[0].trend;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (t <= b.t) return a.trend + ((t - a.t) / (b.t - a.t)) * (b.trend - a.trend);
  }
  return points[points.length - 1].trend;
}

export type TrendRate = { kgPerWeek: number; days: number; from: number; to: number };

/**
 * How fast the trend moved over the last `window` days (or since the first
 * weigh-in, if that's shorter). Null with less than `minDays` of data.
 */
export function trendRate(points: TrendPoint[], window = 28, minDays = 14): TrendRate | null {
  if (points.length < 3) return null;
  const to = points[points.length - 1].t;
  const from = Math.max(points[0].t, to - window * DAY);
  const days = Math.round((to - from) / DAY);
  if (days < minDays) return null;
  const change = trendAt(points, to) - trendAt(points, from);
  return { kgPerWeek: (change / days) * 7, days, from, to };
}

export type EnergyCheck =
  | { kind: 'need-weight'; weighIns: number }
  | { kind: 'need-food'; loggedDays: number; days: number }
  | {
      kind: 'ok';
      kgPerWeek: number;
      days: number;
      avgIntake: number;
      /** Calories per day at which your weight would stay the same. */
      maintenance: number;
      /** What your goal should be for your aim, from your own numbers. */
      suggested: number;
      goal: number;
      /** How far the goal is from the suggestion; within ±150 counts as on track. */
      off: number;
    };

/**
 * Compares the weight trend with what you logged in the same days.
 * `intake` maps day keys to calories eaten; `dayKeyOf` turns a timestamp into a day key.
 */
export function energyCheck(opts: {
  entries: WeighIn[];
  intake: Map<string, number>;
  dayKeyOf: (t: number) => string;
  goal: number;
  /** Planned surplus or deficit: −500 to lose, 0 to maintain, +300 to gain. */
  aimKcal: number;
}): EnergyCheck {
  const points = weightTrend(opts.entries);
  const rate = trendRate(points);
  if (!rate) return { kind: 'need-weight', weighIns: points.length };
  let logged = 0;
  let kcal = 0;
  for (let t = rate.from + DAY / 2; t <= rate.to + DAY / 2; t += DAY) {
    const k = opts.intake.get(opts.dayKeyOf(t)) ?? 0;
    // Days with very little logged are almost always days you forgot to log.
    if (k >= 800) {
      logged++;
      kcal += k;
    }
  }
  const days = rate.days + 1;
  if (logged < 10 || logged / days < 0.6) return { kind: 'need-food', loggedDays: logged, days };
  const avgIntake = kcal / logged;
  const stored = (rate.kgPerWeek * KCAL_PER_KG) / 7; // kcal per day going into (or out of) body mass
  const maintenance = Math.round((avgIntake - stored) / 10) * 10;
  const suggested = Math.round((maintenance + opts.aimKcal) / 10) * 10;
  return {
    kind: 'ok',
    kgPerWeek: rate.kgPerWeek,
    days: rate.days,
    avgIntake,
    maintenance,
    suggested,
    goal: opts.goal,
    off: opts.goal - suggested,
  };
}
