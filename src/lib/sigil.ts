// Workout sigils: every finished workout grows its own emblem from its data.
// The same workout always gives the same sigil. Pure functions (tested in
// tests/logic.test.ts); components/sigil.tsx draws the shapes.

export type SigilInput = {
  id: number;
  started_at: number;
  finished_at: number | null;
  exercises: { name: string; muscle: string; sets: { weight: number | null; reps: number | null }[] }[];
  /** Records broken in this workout: they turn into gold. */
  records: number;
};

export type SigilShape =
  | { kind: 'path'; d: string; fill: string; opacity: number; stroke?: string; strokeWidth?: number }
  | {
      kind: 'circle';
      cx: number;
      cy: number;
      r: number;
      fill: string;
      opacity: number;
      stroke?: string;
      strokeWidth?: number;
    };

export type Sigil = { shapes: SigilShape[]; colors: string[]; gold: boolean };

/** Colour per muscle group. */
export const MUSCLE_COLOR: Record<string, string> = {
  Chest: '#22D3EE',
  Back: '#A78BFA',
  Shoulders: '#F59E0B',
  Biceps: '#F472B6',
  Triceps: '#FB7185',
  Forearms: '#F9A8D4',
  Quads: '#34D399',
  Hamstrings: '#10B981',
  Glutes: '#6EE7B7',
  Calves: '#A7F3D0',
  Core: '#FACC15',
  Cardio: '#F87171',
};
const GOLD = '#E9BE58';
const C0 = 100; // centre of the 200 × 200 drawing

/** Small fast seeded random numbers (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const pt = (angle: number, radius: number) => [r2(C0 + Math.cos(angle) * radius), r2(C0 + Math.sin(angle) * radius)];

/** A leaf from the centre out to `radius`, `width` radians wide. */
function petal(angle: number, radius: number, width: number, inner: number) {
  const [x0, y0] = pt(angle, inner);
  const [x1, y1] = pt(angle, radius);
  const [ca, cb] = [pt(angle - width, radius * 0.62), pt(angle + width, radius * 0.62)];
  return `M${x0} ${y0} Q${ca[0]} ${ca[1]} ${x1} ${y1} Q${cb[0]} ${cb[1]} ${x0} ${y0}Z`;
}

export function buildSigil(w: SigilInput): Sigil {
  const rand = rng(w.id * 9973 + Math.floor(w.started_at / 1000));
  const exercises = w.exercises
    .map((e) => ({
      ...e,
      sets: e.sets.filter((s) => (s.reps ?? 0) > 0 || (s.weight ?? 0) > 0),
    }))
    .filter((e) => e.sets.length);
  const vol = (e: (typeof exercises)[number]) =>
    e.sets.reduce((sum, s) => sum + Math.max(1, s.weight ?? 0) * Math.max(1, s.reps ?? 1), 0);
  const volumes = exercises.map(vol);
  const maxVol = Math.max(1, ...volumes);
  const allSets = exercises.flatMap((e) => e.sets.map(() => e.muscle));
  const colors = [...new Set(exercises.map((e) => MUSCLE_COLOR[e.muscle] ?? '#93A1AA'))];
  const gold = w.records > 0;

  const shapes: SigilShape[] = [];
  // Backdrop disc with a faint ring.
  shapes.push({
    kind: 'circle',
    cx: C0,
    cy: C0,
    r: 97,
    fill: '#0B1216',
    opacity: 1,
    stroke: gold ? GOLD : '#22303A',
    strokeWidth: gold ? 1.6 : 1,
  });

  // Symmetry: 5–9 folds, from the seed and how varied the workout was.
  const folds = 5 + ((exercises.length + Math.floor(rand() * 5)) % 5);
  const spin = rand() * Math.PI * 2;

  // One layer of petals per exercise: the more volume, the longer the petals.
  exercises.forEach((e, i) => {
    const color = MUSCLE_COLOR[e.muscle] ?? '#93A1AA';
    const share = volumes[i] / maxVol;
    const radius = 34 + 50 * Math.sqrt(share) - i * 2;
    const width = 0.12 + 0.22 * rand() + 0.04 * Math.min(e.sets.length, 6);
    const offset = spin + (i * Math.PI) / folds + rand() * 0.3;
    for (let k = 0; k < folds; k++) {
      const a = offset + (k * 2 * Math.PI) / folds;
      shapes.push({
        kind: 'path',
        d: petal(a, radius, width, 6 + (i % 3) * 3),
        fill: color,
        opacity: 0.2 + 0.25 * share,
      });
      shapes.push({
        kind: 'path',
        d: petal(a, radius * 0.92, width * 0.35, 8),
        fill: 'none',
        opacity: 0.85,
        stroke: color,
        strokeWidth: 0.9,
      });
    }
  });

  // A ring of dots: one per set, coloured by its exercise.
  const dots = allSets.slice(0, 60);
  dots.forEach((muscle, i) => {
    const a = spin + (i * 2 * Math.PI) / Math.max(dots.length, 1);
    const [x, y] = pt(a, 90);
    shapes.push({ kind: 'circle', cx: x, cy: y, r: 2.1, fill: MUSCLE_COLOR[muscle] ?? '#93A1AA', opacity: 0.95 });
  });

  // Records: gold sparks between the dots.
  for (let i = 0; i < Math.min(w.records, 8); i++) {
    const a = spin + Math.PI / folds + (i * 2 * Math.PI) / Math.min(w.records, 8);
    const [x, y] = pt(a, 78);
    const s = 5;
    shapes.push({
      kind: 'path',
      d: `M${x} ${r2(y - s)} L${r2(x + s * 0.3)} ${r2(y - s * 0.3)} L${r2(x + s)} ${y} L${r2(x + s * 0.3)} ${r2(y + s * 0.3)} L${x} ${r2(y + s)} L${r2(x - s * 0.3)} ${r2(y + s * 0.3)} L${r2(x - s)} ${y} L${r2(x - s * 0.3)} ${r2(y - s * 0.3)}Z`,
      fill: GOLD,
      opacity: 1,
    });
  }

  // Centre: grows with how long you trained.
  const minutes = w.finished_at ? (w.finished_at - w.started_at) / 60_000 : 30;
  const core = 6 + Math.min(10, minutes / 9);
  shapes.push({
    kind: 'circle',
    cx: C0,
    cy: C0,
    r: core + 4,
    fill: 'none',
    opacity: 0.6,
    stroke: gold ? GOLD : '#E8EEF1',
    strokeWidth: 1,
  });
  shapes.push({ kind: 'circle', cx: C0, cy: C0, r: core, fill: gold ? GOLD : (colors[0] ?? '#22D3EE'), opacity: 0.95 });

  return { shapes, colors, gold };
}

/** The sigil as an SVG document (for saving or sharing as an image). */
export function sigilSvg(s: Sigil, size: number, caption?: { title: string; sub: string }): string {
  const h = caption ? size * 1.28 : size;
  const body = s.shapes
    .map((sh) => {
      const common = `fill="${sh.fill}" fill-opacity="${sh.opacity}"${sh.stroke ? ` stroke="${sh.stroke}" stroke-width="${sh.strokeWidth ?? 1}" stroke-opacity="${sh.opacity}"` : ''}`;
      return sh.kind === 'path'
        ? `<path d="${sh.d}" ${common}/>`
        : `<circle cx="${sh.cx}" cy="${sh.cy}" r="${sh.r}" ${common}/>`;
    })
    .join('');
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const text = caption
    ? `<text x="${size / 2}" y="${size * 1.1}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${size * 0.065}" fill="#E8EEF1">${esc(caption.title)}</text>` +
      `<text x="${size / 2}" y="${size * 1.18}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size * 0.042}" fill="#93A1AA">${esc(caption.sub)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}"><rect width="${size}" height="${h}" fill="#070B0D"/><g transform="scale(${size / 200})">${body}</g>${text}</svg>`;
}

/** One row per working set of finished workouts (see db.sigilRows). */
export type SigilRow = {
  workout_id: number;
  workout_name: string;
  started_at: number;
  finished_at: number;
  exercise: string;
  muscle: string;
  weight: number | null;
  reps: number | null;
};

/** Groups set rows into one sigil input per workout (newest first, like the rows). */
export function sigilInputs(rows: SigilRow[], records: Map<number, number>) {
  const out = new Map<number, SigilInput & { name: string }>();
  for (const r of rows) {
    let w = out.get(r.workout_id);
    if (!w) {
      w = {
        id: r.workout_id,
        name: r.workout_name,
        started_at: r.started_at,
        finished_at: r.finished_at,
        exercises: [],
        records: records.get(r.workout_id) ?? 0,
      };
      out.set(r.workout_id, w);
    }
    let ex = w.exercises[w.exercises.length - 1];
    if (!ex || ex.name !== r.exercise) {
      ex = { name: r.exercise, muscle: r.muscle, sets: [] };
      w.exercises.push(ex);
    }
    ex.sets.push({ weight: r.weight, reps: r.reps });
  }
  return [...out.values()];
}
