// Nutrients, official reference values and personal goals.
//
// Sources:
// - EU Regulation 1169/2011, Annex XIII: reference intakes (energy, fat, saturates,
//   carbohydrate, sugars, protein, salt) and nutrient reference values (vitamins, minerals).
// - EFSA dietary reference values (2010): fat 20-35 % of energy, carbohydrates 45-60 %,
//   dietary fibre 25 g/day, total water 2.5 L (men) / 2.0 L (women), 70-80 % of it from drinks.
// - EFSA dietary reference values for energy (2013): resting energy x physical activity level
//   (PAL 1.4 / 1.6 / 1.8 / 2.0); resting energy from the Henry (Oxford) equations.
// - ISSN position stand on protein and exercise (2017): 1.4-2.0 g per kg body weight.

export type NutrientKey =
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'sugar'
  | 'fat'
  | 'satFat'
  | 'fiber'
  | 'salt'
  | 'potassium'
  | 'calcium'
  | 'magnesium'
  | 'iron'
  | 'zinc'
  | 'vitC'
  | 'vitD'
  | 'vitB12';

/** Amounts per 100 g (foods) or totals (a logged entry, a day). Missing = unknown. */
export type Nutrients = Partial<Record<NutrientKey, number>>;

export type NutrientInfo = { key: NutrientKey; label: string; unit: 'kcal' | 'g' | 'mg' | 'µg' };

export const NUTRIENTS: Record<NutrientKey, NutrientInfo> = {
  kcal: { key: 'kcal', label: 'Calories', unit: 'kcal' },
  protein: { key: 'protein', label: 'Protein', unit: 'g' },
  carbs: { key: 'carbs', label: 'Carbs', unit: 'g' },
  sugar: { key: 'sugar', label: 'Sugar', unit: 'g' },
  fat: { key: 'fat', label: 'Fat', unit: 'g' },
  satFat: { key: 'satFat', label: 'Saturated fat', unit: 'g' },
  fiber: { key: 'fiber', label: 'Fibre', unit: 'g' },
  salt: { key: 'salt', label: 'Salt', unit: 'g' },
  potassium: { key: 'potassium', label: 'Potassium', unit: 'mg' },
  calcium: { key: 'calcium', label: 'Calcium', unit: 'mg' },
  magnesium: { key: 'magnesium', label: 'Magnesium', unit: 'mg' },
  iron: { key: 'iron', label: 'Iron', unit: 'mg' },
  zinc: { key: 'zinc', label: 'Zinc', unit: 'mg' },
  vitC: { key: 'vitC', label: 'Vitamin C', unit: 'mg' },
  vitD: { key: 'vitD', label: 'Vitamin D', unit: 'µg' },
  vitB12: { key: 'vitB12', label: 'Vitamin B12', unit: 'µg' },
};

/** Nutrients to reach (fibre) and to stay under (sugar, saturated fat, salt). */
export const DETAILS: { key: NutrientKey; limit: boolean }[] = [
  { key: 'fiber', limit: false },
  { key: 'sugar', limit: true },
  { key: 'satFat', limit: true },
  { key: 'salt', limit: true },
];

export const MICROS: NutrientKey[] = ['vitC', 'vitD', 'vitB12', 'calcium', 'iron', 'magnesium', 'potassium', 'zinc'];

/** EU reference intakes for an average adult (Regulation 1169/2011, Annex XIII). */
export const EU_REFERENCE: Record<NutrientKey, number> = {
  kcal: 2000,
  fat: 70,
  satFat: 20,
  carbs: 260,
  sugar: 90,
  protein: 50,
  salt: 6,
  fiber: 25, // EFSA adequate intake
  vitC: 80,
  vitD: 5,
  vitB12: 2.5,
  calcium: 800,
  iron: 14,
  magnesium: 375,
  potassium: 2000,
  zinc: 10,
};

// ── Arithmetic ──────────────────────────────────────────────────────────

export function scale(per100: Nutrients, grams: number): Nutrients {
  const out: Nutrients = {};
  for (const k of Object.keys(per100) as NutrientKey[]) {
    const v = per100[k];
    if (v != null) out[k] = (v * grams) / 100;
  }
  return out;
}

/** Per-100 g values from a total and its weight. */
export function per100Of(total: Nutrients, grams: number): Nutrients {
  return grams > 0 ? scale(total, (100 * 100) / grams) : {};
}

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const out: Nutrients = { ...a };
  for (const k of Object.keys(b) as NutrientKey[]) {
    const v = b[k];
    if (v != null) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce<Nutrients>((acc, n) => add(acc, n), {});
}

/** Energy from macros (EU conversion factors) when a product only lists kJ or nothing. */
export function kcalFromMacros(n: Nutrients): number {
  return (n.protein ?? 0) * 4 + (n.carbs ?? 0) * 4 + (n.fat ?? 0) * 9;
}

// ── Formatting ──────────────────────────────────────────────────────────

/** "12 g", "0.4 g", "85 mg", "2.1 µg", "540 kcal" */
export function fmtAmount(v: number | undefined, unit: NutrientInfo['unit']): string {
  if (v == null) return '–';
  if (unit === 'kcal') return `${Math.round(v)} kcal`;
  const r = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${r.toLocaleString('en-US')} ${unit}`;
}

export function fmtNutrient(key: NutrientKey, v: number | undefined): string {
  return fmtAmount(v, NUTRIENTS[key].unit);
}

// ── Goals ───────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female';
export type Aim = 'lose' | 'maintain' | 'gain';

export type BodyProfile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  /** EFSA physical activity level: 1.4 sedentary, 1.6 moderately active, 1.8 active, 2.0 very active. */
  pal: number;
  aim: Aim;
  /** Grams of protein per kg body weight (ISSN: 1.4-2.0 for people who train). */
  proteinPerKg: number;
};

export const PAL_OPTIONS = [
  { value: 1.4, label: 'Mostly sitting', hint: 'Office job, little walking' },
  { value: 1.6, label: 'Moderately active', hint: 'Some walking, training 2-3x a week' },
  { value: 1.8, label: 'Active', hint: 'On your feet a lot, training 4-5x a week' },
  { value: 2.0, label: 'Very active', hint: 'Physical job or daily hard training' },
];

export const AIM_OPTIONS: { value: Aim; label: string; kcal: number }[] = [
  { value: 'lose', label: 'Lose fat', kcal: -500 },
  { value: 'maintain', label: 'Maintain', kcal: 0 },
  { value: 'gain', label: 'Build muscle', kcal: 300 },
];

export type Goals = Record<NutrientKey, number> & { waterMl: number };

/** Resting energy (kcal/day) with the Henry (Oxford) equations, weight in kg and height in cm. */
export function restingEnergy(p: Pick<BodyProfile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const { sex, age, heightCm: h, weightKg: w } = p;
  if (sex === 'male') {
    if (age < 30) return 14.4 * w + 3.13 * h + 113;
    if (age < 60) return 11.4 * w + 5.41 * h - 137;
    return 11.4 * w + 5.41 * h - 256;
  }
  if (age < 30) return 10.4 * w + 6.15 * h - 282;
  if (age < 60) return 8.18 * w + 5.02 * h - 11.6;
  return 8.52 * w + 4.21 * h + 10.7;
}

/** Daily goals. Without a body profile the EU reference intakes are used. */
export function computeGoals(p: BodyProfile | null): Goals {
  const base = { ...EU_REFERENCE };
  if (!p) return { ...base, waterMl: 2000 };
  const aim = AIM_OPTIONS.find((a) => a.value === p.aim)?.kcal ?? 0;
  const kcal = Math.round((restingEnergy(p) * p.pal + aim) / 10) * 10;
  const protein = Math.round(p.weightKg * p.proteinPerKg);
  const fat = Math.round((kcal * 0.3) / 9); // 30 % of energy, middle of EFSA's 20-35 %
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  // EFSA total water: 2.5 L men, 2.0 L women; about 80 % of it from drinks.
  const waterMl = p.sex === 'male' ? 2000 : 1600;
  return {
    ...base,
    kcal,
    protein,
    fat,
    carbs,
    // Limits scale with energy like the EU reference (20 g saturates and 90 g sugars per 2000 kcal).
    satFat: Math.round((kcal / 2000) * 20),
    sugar: Math.round((kcal / 2000) * 90),
    waterMl,
  };
}

/** Share of energy from protein, carbs and fat (0..1 each). */
export function energySplit(n: Nutrients): { protein: number; carbs: number; fat: number } {
  const p = (n.protein ?? 0) * 4;
  const c = (n.carbs ?? 0) * 4;
  const f = (n.fat ?? 0) * 9;
  const t = p + c + f;
  if (!t) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: p / t, carbs: c / t, fat: f / t };
}
