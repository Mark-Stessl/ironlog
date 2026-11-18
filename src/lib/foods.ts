// One shape for everything that can be eaten: BLS foods, scanned or searched
// products, your own foods, built-in recipes and your own recipes.

import blsData from './bls-data.json';
import foodData from './food-data.json';
import { per100Of, scale, sum, type Nutrients } from './nutrition';
import { RECIPES, type Meal, type Recipe } from './recipes';
import { editDistance, normalize } from './search';

export type Serving = { label: string; g: number };

export type RecipeInfo = {
  meal: Meal;
  minutes: number | null;
  servings: number;
  totalG: number;
  ingredients: { ref: string; name: string; g: number; note?: string }[];
  steps: string[];
};

export type FoodSource = 'bls' | 'product' | 'custom' | 'recipe' | 'my-recipe';

export type FoodItem = {
  /** f:<key> everyday food, b:<code> other BLS food, p:<id> product or own food, r:<key> built-in recipe, u:<id> own recipe */
  ref: string;
  source: FoodSource;
  name: string;
  /** Original German name (BLS foods). */
  altName?: string;
  /** Everyday foods with portion sizes rank above the long tail of the database. */
  everyday?: boolean;
  brand: string;
  category: string;
  words: string;
  /** Ingredient names of a recipe: found by search, but ranked below direct matches. */
  ingredientWords?: string;
  per100: Nutrients;
  /** The first one is the default amount. */
  servings: Serving[];
  barcode?: string;
  recipe?: RecipeInfo;
  useCount: number;
};

type RawFood = {
  key: string;
  code: string;
  name: string;
  words: string;
  category: string;
  servings: Serving[];
  n: Nutrients;
};

/** Everyday foods with portion sizes, from BLS 4.0. */
export const BUILTIN_FOODS: FoodItem[] = (foodData as RawFood[]).map((f) => ({
  ref: `f:${f.key}`,
  source: 'bls',
  name: f.name,
  brand: '',
  category: f.category,
  words: f.words,
  per100: f.n,
  servings: f.servings,
  everyday: true,
  useCount: 0,
}));

// The rest of the BLS: [code, English name, German name, Austrian words, ...values in this order]
const BLS_KEYS: (keyof Nutrients)[] = [
  'kcal',
  'protein',
  'fat',
  'carbs',
  'fiber',
  'sugar',
  'satFat',
  'salt',
  'potassium',
  'calcium',
  'magnesium',
  'iron',
  'zinc',
  'vitC',
  'vitD',
  'vitB12',
];

const BLS_GROUP: Record<string, string> = {
  B: 'Bread',
  C: 'Grains & cereals',
  D: 'Baked goods',
  E: 'Pasta & eggs',
  F: 'Fruit',
  G: 'Vegetables',
  H: 'Legumes, nuts & seeds',
  K: 'Potatoes & mushrooms',
  M: 'Dairy',
  N: 'Drinks',
  P: 'Alcoholic drinks',
  Q: 'Fats & oils',
  R: 'Sauces & spices',
  S: 'Sweets',
  T: 'Fish & seafood',
  U: 'Meat',
  V: 'Poultry & game',
  W: 'Sausages & cold cuts',
  X: 'Dishes',
  Y: 'Dishes',
};

type BlsRow = [string, string, string, string, ...(number | null)[]];

let blsFoods: FoodItem[] | null = null;

/** About 7,000 more foods and dishes from BLS 4.0, built on first use. */
export function allBlsFoods(): FoodItem[] {
  if (blsFoods) return blsFoods;
  blsFoods = (blsData as unknown as BlsRow[]).map((r) => {
    const per100: Nutrients = {};
    BLS_KEYS.forEach((k, i) => {
      const v = r[4 + i];
      if (typeof v === 'number') per100[k] = v;
    });
    return {
      ref: `b:${r[0]}`,
      source: 'bls' as const,
      name: r[1],
      altName: r[2],
      brand: '',
      category: BLS_GROUP[r[0][0]] ?? 'Food',
      words: `${r[2]} ${r[3]}`,
      per100,
      servings: [],
      useCount: 0,
    };
  });
  return blsFoods;
}

export function blsFood(code: string): FoodItem | undefined {
  return allBlsFoods().find((f) => f.ref === `b:${code}`);
}

const byKey = new Map(BUILTIN_FOODS.map((f) => [f.ref.slice(2), f]));

export function builtinFood(key: string): FoodItem | undefined {
  return byKey.get(key);
}

/** Total nutrients and weight of a list of ingredients. */
export function totalOf(parts: { per100: Nutrients; g: number }[]): { n: Nutrients; g: number } {
  return { n: sum(parts.map((p) => scale(p.per100, p.g))), g: parts.reduce((s, p) => s + p.g, 0) };
}

function recipeItem(r: Recipe): FoodItem {
  const parts = r.ingredients.map((i) => {
    const f = byKey.get(i.food);
    if (!f) throw new Error(`Recipe ${r.key}: unknown food ${i.food}`);
    return { f, i };
  });
  const total = totalOf(parts.map(({ f, i }) => ({ per100: f.per100, g: i.g })));
  return {
    ref: `r:${r.key}`,
    source: 'recipe',
    name: r.name,
    brand: '',
    category: 'Recipe',
    words: r.tags ?? '',
    ingredientWords: parts.map(({ f }) => `${f.name} ${f.words}`).join(' '),
    per100: per100Of(total.n, total.g),
    servings: [{ label: '1 serving', g: Math.round(total.g / r.servings) }],
    recipe: {
      meal: r.meal,
      minutes: r.minutes,
      servings: r.servings,
      totalG: total.g,
      ingredients: parts.map(({ f, i }) => ({ ref: f.ref, name: f.name, g: i.g, note: i.note })),
      steps: r.steps,
    },
    useCount: 0,
  };
}

export const BUILTIN_RECIPES: FoodItem[] = RECIPES.map(recipeItem);

/** Nutrients for an amount in grams. */
export function nutrientsFor(item: FoodItem, grams: number): Nutrients {
  return scale(item.per100, grams);
}

/** "1 serving", "2 × 1 egg (M)", "150 g" */
export function amountLabel(serving: Serving | null, count: number, grams: number): string {
  if (!serving) return `${Math.round(grams)} g`;
  const c = Math.round(count * 100) / 100;
  return c === 1 ? serving.label : `${c} × ${serving.label}`;
}

type Entry = {
  f: FoodItem;
  name: string;
  nameWords: string[];
  phrases: string[];
  words: string[];
  extra: string[];
  category: string;
  brand: string[];
};

// Normalised words per item, built once per list (the list is rebuilt only when foods change).
const indexes = new WeakMap<FoodItem[], Entry[]>();

function indexOf(items: FoodItem[]): Entry[] {
  let idx = indexes.get(items);
  if (idx) return idx;
  idx = items.map((f) => {
    const name = normalize(f.name);
    const phrases = f.words.split(/\s+/).map(normalize).filter(Boolean);
    return {
      f,
      name,
      nameWords: name.split(' '),
      phrases,
      words: phrases.flatMap((p) => p.split(' ')),
      extra: f.ingredientWords ? normalize(f.ingredientWords).split(' ') : [],
      category: normalize(f.category),
      brand: normalize(f.brand).split(' ').filter(Boolean),
    };
  });
  indexes.set(items, idx);
  return idx;
}

function tokenScore(t: string, e: Entry, fuzzy: boolean): number {
  if (e.nameWords[0]?.startsWith(t)) return 100;
  if (e.nameWords.some((w) => w.startsWith(t))) return 80;
  if (e.phrases.some((p) => p.startsWith(t))) return 78;
  if (e.category.startsWith(t) || e.brand.some((w) => w.startsWith(t))) return 75;
  if (t.length >= 3) {
    if (e.nameWords.some((w) => w.includes(t))) return 40;
    if (e.words.some((w) => w.includes(t))) return 30;
  }
  if (fuzzy && t.length >= 4) {
    const max = t.length >= 7 ? 2 : 1;
    for (const w of e.nameWords.concat(e.words)) {
      if (Math.abs(w.length - t.length) <= w.length && editDistance(t, w.slice(0, t.length), max) <= max) return 20;
    }
  }
  return 0;
}

function ingredientScore(t: string, e: Entry): number {
  if (e.extra.some((w) => w.startsWith(t))) return 65;
  if (t.length >= 3 && e.extra.some((w) => w.includes(t))) return 30;
  return 0;
}

/** Search across foods and recipes, with German and Austrian names and typo tolerance. */
export function searchFoods(query: string, items: FoodItem[]): FoodItem[] {
  const q = normalize(query);
  if (!q) return [];
  // Exact and prefix matches first; typo guesses only when that finds nothing.
  const exact = run(q, items, false);
  return exact.length ? exact : run(q, items, true);
}

function run(q: string, items: FoodItem[], fuzzy: boolean): FoodItem[] {
  const tokens = q.split(' ');
  const scored: { f: FoodItem; score: number }[] = [];
  for (const e of indexOf(items)) {
    let total = 0;
    let viaIngredients = false;
    for (const t of tokens) {
      let s = tokenScore(t, e, fuzzy);
      if (!s && e.extra.length) {
        s = ingredientScore(t, e) * 0.5;
        if (s) viaIngredients = true;
      }
      if (!s) {
        total = 0;
        break;
      }
      total += s;
    }
    if (!total) continue;
    if (!viaIngredients) {
      if (tokens.length > 1 && e.name.startsWith(q)) total += 30;
      if (e.name === q) total += 50;
    }
    total += Math.min(e.f.useCount, 10) * 8;
    // Foods with portion sizes, your own foods and recipes come before the long tail of the database.
    if (e.f.source !== 'bls' || e.f.everyday) total += 12;
    scored.push({ f: e.f, score: total });
  }
  const isRecipe = (f: FoodItem) => (f.recipe ? 1 : 0);
  scored.sort((a, b) => b.score - a.score || isRecipe(a.f) - isRecipe(b.f) || a.f.name.length - b.f.name.length);
  return scored.map((s) => s.f);
}

/** Cheap check whether a query looks like it means a specific item already in the list. */
export function hasExact(query: string, items: FoodItem[]): boolean {
  const q = normalize(query);
  return items.some((f) => normalize(f.name) === q);
}

