// Food log, water, your own foods and recipes, and nutrition goals (SQLite).

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  allBlsFoods,
  blsFood,
  BUILTIN_FOODS,
  BUILTIN_RECIPES,
  builtinFood,
  totalOf,
  type FoodItem,
  type Serving,
} from './foods';
import { computeGoals, per100Of, scale, sum, type BodyProfile, type Goals, type Nutrients } from './nutrition';
import type { OffProduct } from './off';
import type { Meal } from './recipes';

export const FOOD_SCHEMA = `
  CREATE TABLE foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,              -- 'product' (Open Food Facts) or 'custom'
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    barcode TEXT UNIQUE,
    servings TEXT NOT NULL DEFAULT '[]',
    nutrients TEXT NOT NULL,         -- JSON, per 100 g
    created_at INTEGER NOT NULL
  );
  CREATE TABLE user_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    meal TEXT NOT NULL,
    servings INTEGER NOT NULL DEFAULT 1,
    ingredients TEXT NOT NULL,       -- JSON [{ref, name, g}]
    steps TEXT NOT NULL DEFAULT '',
    nutrients TEXT NOT NULL,         -- JSON, per 100 g
    total_g REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE food_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    meal TEXT NOT NULL,
    ref TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    grams REAL NOT NULL,
    amount TEXT NOT NULL,
    nutrients TEXT NOT NULL,         -- JSON, totals for this entry
    created_at INTEGER NOT NULL
  );
  CREATE INDEX food_log_day ON food_log (day);
  CREATE TABLE water_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    ml INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX water_log_day ON water_log (day);
`;

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

// ── Your own foods and scanned products ─────────────────────────────────

type FoodRow = {
  id: number;
  kind: 'product' | 'custom';
  name: string;
  brand: string;
  barcode: string | null;
  servings: string;
  nutrients: string;
  image: string | null;
};

function foodItem(r: FoodRow, useCount = 0): FoodItem {
  return {
    ref: `p:${r.id}`,
    source: r.kind,
    name: r.name,
    brand: r.brand,
    category: r.kind === 'product' ? 'Product' : 'My food',
    words: '',
    per100: parse<Nutrients>(r.nutrients, {}),
    servings: parse<Serving[]>(r.servings, []),
    barcode: r.barcode ?? undefined,
    image: r.image ?? undefined,
    emoji: r.kind === 'product' ? '🛒' : '🍽️',
    useCount,
  };
}

type RecipeRow = {
  id: number;
  name: string;
  meal: Meal;
  servings: number;
  ingredients: string;
  steps: string;
  nutrients: string;
  total_g: number;
  image: string | null;
};

function recipeItem(r: RecipeRow, useCount = 0): FoodItem {
  const ingredients = parse<{ ref: string; name: string; g: number }[]>(r.ingredients, []);
  return {
    ref: `u:${r.id}`,
    source: 'my-recipe',
    name: r.name,
    brand: '',
    category: 'My recipe',
    words: '',
    ingredientWords: ingredients.map((i) => i.name).join(' '),
    per100: parse<Nutrients>(r.nutrients, {}),
    servings: [{ label: '1 serving', g: Math.round(r.total_g / Math.max(1, r.servings)) }],
    recipe: {
      meal: r.meal,
      minutes: null,
      servings: r.servings,
      totalG: r.total_g,
      ingredients,
      steps: r.steps ? r.steps.split('\n').filter(Boolean) : [],
    },
    image: r.image ?? undefined,
    emoji: '🍲',
    useCount,
  };
}

/** How often each item was logged, for ranking search results. */
async function useCounts(db: SQLiteDatabase): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{ ref: string; n: number }>('SELECT ref, COUNT(*) AS n FROM food_log GROUP BY ref');
  return new Map(rows.map((r) => [r.ref, r.n]));
}

/** Everything that can be logged: built-in foods and recipes, your products, foods and recipes. */
export async function allFoodItems(db: SQLiteDatabase): Promise<FoodItem[]> {
  const counts = await useCounts(db);
  const foods = await db.getAllAsync<FoodRow>('SELECT * FROM foods ORDER BY created_at DESC');
  const recipes = await db.getAllAsync<RecipeRow>('SELECT * FROM user_recipes ORDER BY created_at DESC');
  const withCount = (f: FoodItem) => ({ ...f, useCount: counts.get(f.ref) ?? 0 });
  return [
    ...recipes.map((r) => recipeItem(r, counts.get(`u:${r.id}`) ?? 0)),
    ...foods.map((r) => foodItem(r, counts.get(`p:${r.id}`) ?? 0)),
    ...BUILTIN_RECIPES.map(withCount),
    ...BUILTIN_FOODS.map(withCount),
    ...allBlsFoods().map((f) => (counts.has(f.ref) ? withCount(f) : f)),
  ];
}

export async function getFoodItem(db: SQLiteDatabase, ref: string): Promise<FoodItem | null> {
  const [kind, id] = [ref.slice(0, 1), ref.slice(2)];
  if (kind === 'f') return builtinFood(id) ?? null;
  if (kind === 'b') return blsFood(id) ?? null;
  if (kind === 'r') return BUILTIN_RECIPES.find((r) => r.ref === ref) ?? null;
  if (kind === 'p') {
    const r = await db.getFirstAsync<FoodRow>('SELECT * FROM foods WHERE id = ?', Number(id));
    return r ? foodItem(r) : null;
  }
  if (kind === 'u') {
    const r = await db.getFirstAsync<RecipeRow>('SELECT * FROM user_recipes WHERE id = ?', Number(id));
    return r ? recipeItem(r) : null;
  }
  return null;
}

export async function foodByBarcode(db: SQLiteDatabase, barcode: string): Promise<FoodItem | null> {
  const r = await db.getFirstAsync<FoodRow>('SELECT * FROM foods WHERE barcode = ?', barcode.trim());
  return r ? foodItem(r) : null;
}

/** Stores an Open Food Facts product on the device (or updates it). Returns its ref. */
export async function saveProduct(db: SQLiteDatabase, p: OffProduct): Promise<string> {
  const servings: Serving[] = p.servingG ? [{ label: p.servingLabel ?? `1 serving`, g: p.servingG }] : [];
  await db.runAsync(
    `INSERT INTO foods (kind, name, brand, barcode, servings, nutrients, image, created_at) VALUES ('product', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(barcode) DO UPDATE SET name = excluded.name, brand = excluded.brand,
       servings = excluded.servings, nutrients = excluded.nutrients,
       image = CASE WHEN foods.image LIKE 'data:%' THEN foods.image ELSE COALESCE(excluded.image, foods.image) END`,
    p.name,
    p.brand,
    p.barcode,
    JSON.stringify(servings),
    JSON.stringify(p.per100),
    p.image ?? null,
    Date.now(),
  );
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM foods WHERE barcode = ?', p.barcode);
  return `p:${row!.id}`;
}

export type CustomFood = {
  name: string;
  brand: string;
  barcode: string | null;
  per100: Nutrients;
  serving: Serving | null;
  /** Your own photo as a data URI. */
  image?: string | null;
};

export async function createCustomFood(db: SQLiteDatabase, f: CustomFood): Promise<string> {
  const r = await db.runAsync(
    `INSERT INTO foods (kind, name, brand, barcode, servings, nutrients, image, created_at) VALUES ('custom', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(barcode) DO UPDATE SET kind = 'custom', name = excluded.name, brand = excluded.brand,
       servings = excluded.servings, nutrients = excluded.nutrients, image = COALESCE(excluded.image, foods.image)`,
    f.name.trim(),
    f.brand.trim(),
    f.barcode?.trim() || null,
    JSON.stringify(f.serving ? [f.serving] : []),
    JSON.stringify(f.per100),
    f.image ?? null,
    Date.now(),
  );
  if (f.barcode?.trim()) {
    const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM foods WHERE barcode = ?', f.barcode.trim());
    return `p:${row!.id}`;
  }
  return `p:${r.lastInsertRowId}`;
}

export async function deleteFood(db: SQLiteDatabase, ref: string): Promise<void> {
  if (ref.startsWith('p:')) await db.runAsync('DELETE FROM foods WHERE id = ?', Number(ref.slice(2)));
  if (ref.startsWith('u:')) await db.runAsync('DELETE FROM user_recipes WHERE id = ?', Number(ref.slice(2)));
  await db.runAsync('DELETE FROM favorites WHERE ref = ?', ref);
}

export type NewRecipe = {
  name: string;
  meal: Meal;
  servings: number;
  ingredients: { item: FoodItem; g: number }[];
  steps: string;
  image?: string | null;
};

/** Saves your own recipe. Nutrition is calculated from the ingredients. */
export async function createRecipe(db: SQLiteDatabase, r: NewRecipe): Promise<string> {
  const total = totalOf(r.ingredients.map((i) => ({ per100: i.item.per100, g: i.g })));
  const res = await db.runAsync(
    'INSERT INTO user_recipes (name, meal, servings, ingredients, steps, nutrients, total_g, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    r.name.trim(),
    r.meal,
    Math.max(1, Math.round(r.servings)),
    JSON.stringify(r.ingredients.map((i) => ({ ref: i.item.ref, name: i.item.name, g: i.g }))),
    r.steps.trim(),
    JSON.stringify(per100Of(total.n, total.g)),
    total.g,
    r.image ?? null,
    Date.now(),
  );
  return `u:${res.lastInsertRowId}`;
}

/** Sets or removes your own photo on a product, own food or own recipe. */
export async function setFoodImage(db: SQLiteDatabase, ref: string, image: string | null): Promise<void> {
  const id = Number(ref.slice(2));
  if (ref.startsWith('p:')) await db.runAsync('UPDATE foods SET image = ? WHERE id = ?', image, id);
  if (ref.startsWith('u:')) await db.runAsync('UPDATE user_recipes SET image = ? WHERE id = ?', image, id);
}

export type Thumb = { image?: string; emoji?: string };

/** Photo or emoji for each logged ref (for the day's list). */
export async function thumbsFor(db: SQLiteDatabase, refs: string[]): Promise<Map<string, Thumb>> {
  const out = new Map<string, Thumb>();
  const ids = (prefix: string) => [...new Set(refs.filter((r) => r.startsWith(prefix)).map((r) => Number(r.slice(2))))];
  const p = ids('p:');
  if (p.length) {
    const rows = await db.getAllAsync<{ id: number; kind: string; image: string | null }>(
      `SELECT id, kind, image FROM foods WHERE id IN (${p.map(() => '?').join(',')})`,
      ...p,
    );
    for (const r of rows)
      out.set(`p:${r.id}`, { image: r.image ?? undefined, emoji: r.kind === 'product' ? '🛒' : '🍽️' });
  }
  const u = ids('u:');
  if (u.length) {
    const rows = await db.getAllAsync<{ id: number; image: string | null }>(
      `SELECT id, image FROM user_recipes WHERE id IN (${u.map(() => '?').join(',')})`,
      ...u,
    );
    for (const r of rows) out.set(`u:${r.id}`, { image: r.image ?? undefined, emoji: '🍲' });
  }
  for (const ref of refs) {
    if (out.has(ref)) continue;
    if (ref.startsWith('f:')) out.set(ref, { emoji: builtinFood(ref.slice(2))?.emoji });
    else if (ref.startsWith('b:')) out.set(ref, { emoji: blsFood(ref.slice(2))?.emoji });
  }
  return out;
}

// ── Meal photos ─────────────────────────────────────────────────────────

export async function dayMealPhotos(db: SQLiteDatabase, day: string): Promise<Partial<Record<Meal, string>>> {
  const rows = await db.getAllAsync<{ meal: Meal; image: string }>(
    'SELECT meal, image FROM meal_photos WHERE day = ?',
    day,
  );
  return Object.fromEntries(rows.map((r) => [r.meal, r.image]));
}

export async function setMealPhoto(db: SQLiteDatabase, day: string, meal: Meal, image: string | null): Promise<void> {
  if (image)
    await db.runAsync(
      'INSERT INTO meal_photos (day, meal, image, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(day, meal) DO UPDATE SET image = excluded.image',
      day,
      meal,
      image,
      Date.now(),
    );
  else await db.runAsync('DELETE FROM meal_photos WHERE day = ? AND meal = ?', day, meal);
}

// ── Food log ────────────────────────────────────────────────────────────

export type LogEntry = {
  id: number;
  day: string;
  meal: Meal;
  ref: string;
  name: string;
  brand: string;
  grams: number;
  amount: string;
  n: Nutrients;
  created_at: number;
};

type LogRow = Omit<LogEntry, 'n'> & { nutrients: string };

const toEntry = (r: LogRow): LogEntry => ({ ...r, n: parse<Nutrients>(r.nutrients, {}) });

export async function logFood(
  db: SQLiteDatabase,
  e: { day: string; meal: Meal; item: FoodItem; grams: number; amount: string },
): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO food_log (day, meal, ref, name, brand, grams, amount, nutrients, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    e.day,
    e.meal,
    e.item.ref,
    e.item.name,
    e.item.brand,
    e.grams,
    e.amount,
    JSON.stringify(scale(e.item.per100, e.grams)),
    Date.now(),
  );
  return r.lastInsertRowId;
}

export async function updateLogAmount(
  db: SQLiteDatabase,
  id: number,
  item: FoodItem,
  grams: number,
  amount: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE food_log SET grams = ?, amount = ?, nutrients = ? WHERE id = ?',
    grams,
    amount,
    JSON.stringify(scale(item.per100, grams)),
    id,
  );
}

export async function deleteLogEntry(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM food_log WHERE id = ?', id);
}

/** Puts a removed entry back exactly as it was (same id, so it keeps its place in the meal). */
export async function restoreLogEntry(db: SQLiteDatabase, e: LogEntry): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO food_log (id, day, meal, ref, name, brand, grams, amount, nutrients, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    e.id,
    e.day,
    e.meal,
    e.ref,
    e.name,
    e.brand,
    e.grams,
    e.amount,
    JSON.stringify(e.n),
    e.created_at,
  );
}

export async function getLogEntry(db: SQLiteDatabase, id: number): Promise<LogEntry | null> {
  const r = await db.getFirstAsync<LogRow>('SELECT * FROM food_log WHERE id = ?', id);
  return r ? toEntry(r) : null;
}

export async function dayLog(db: SQLiteDatabase, day: string): Promise<LogEntry[]> {
  const rows = await db.getAllAsync<LogRow>('SELECT * FROM food_log WHERE day = ? ORDER BY created_at, id', day);
  return rows.map(toEntry);
}

/** Totals per day for a range of day keys (inclusive). */
export async function dailyTotals(db: SQLiteDatabase, from: string, to: string): Promise<Map<string, Nutrients>> {
  const rows = await db.getAllAsync<{ day: string; nutrients: string }>(
    'SELECT day, nutrients FROM food_log WHERE day >= ? AND day <= ?',
    from,
    to,
  );
  const out = new Map<string, Nutrients[]>();
  for (const r of rows) out.set(r.day, [...(out.get(r.day) ?? []), parse<Nutrients>(r.nutrients, {})]);
  return new Map([...out].map(([d, list]) => [d, sum(list)]));
}

/** Items logged recently, newest first, without duplicates. */
export async function recentRefs(db: SQLiteDatabase, meal: Meal | null, limit = 12): Promise<string[]> {
  const rows = await db.getAllAsync<{ ref: string }>(
    `SELECT ref, MAX(created_at) AS t FROM food_log ${meal ? 'WHERE meal = ?' : ''} GROUP BY ref ORDER BY t DESC LIMIT ?`,
    ...(meal ? [meal, limit] : [limit]),
  );
  return rows.map((r) => r.ref);
}

/** Copies a whole day's meal to another day, e.g. "same breakfast as yesterday". */
export async function copyMeal(db: SQLiteDatabase, fromDay: string, toDay: string, meal: Meal): Promise<number> {
  const rows = await db.getAllAsync<LogRow>('SELECT * FROM food_log WHERE day = ? AND meal = ?', fromDay, meal);
  for (const r of rows) {
    await db.runAsync(
      'INSERT INTO food_log (day, meal, ref, name, brand, grams, amount, nutrients, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      toDay,
      meal,
      r.ref,
      r.name,
      r.brand,
      r.grams,
      r.amount,
      r.nutrients,
      Date.now(),
    );
  }
  return rows.length;
}

// ── Favourites and saved meals ───────────────────────────────────────────

export async function favoriteRefs(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ ref: string }>('SELECT ref FROM favorites ORDER BY created_at DESC');
  return rows.map((r) => r.ref);
}

export async function isFavorite(db: SQLiteDatabase, ref: string): Promise<boolean> {
  return !!(await db.getFirstAsync('SELECT 1 FROM favorites WHERE ref = ?', ref));
}

export async function setFavorite(db: SQLiteDatabase, ref: string, on: boolean): Promise<void> {
  if (on) await db.runAsync('INSERT OR IGNORE INTO favorites (ref, created_at) VALUES (?, ?)', ref, Date.now());
  else await db.runAsync('DELETE FROM favorites WHERE ref = ?', ref);
}

export type SavedItem = { ref: string; name: string; brand: string; grams: number; amount: string; n: Nutrients };
export type SavedMeal = { id: number; name: string; meal: Meal; items: SavedItem[]; total: Nutrients; usedAt: number };

/** "Oats + Skyr shake", "Oats, Banana + 2 more" */
export function savedMealName(names: string[]): string {
  const short = names.map((n) => n.split(',')[0].trim());
  if (short.length <= 2) return short.join(' + ');
  return `${short[0]}, ${short[1]} + ${short.length - 2} more`;
}

const signature = (items: { ref: string; grams: number }[]) =>
  items
    .map((i) => `${i.ref}@${Math.round(i.grams)}`)
    .sort()
    .join('|');

/**
 * Saves what's logged for a meal on a day as a usual meal. If the same foods in the
 * same amounts are already saved, that one is returned instead of a copy.
 */
export async function saveMeal(
  db: SQLiteDatabase,
  day: string,
  meal: Meal,
): Promise<{ meal: SavedMeal; existed: boolean } | null> {
  const entries = (await dayLog(db, day)).filter((e) => e.meal === meal);
  if (!entries.length) return null;
  const items: SavedItem[] = entries.map((e) => ({
    ref: e.ref,
    name: e.name,
    brand: e.brand,
    grams: e.grams,
    amount: e.amount,
    n: e.n,
  }));
  const same = (await savedMeals(db)).find((m) => m.meal === meal && signature(m.items) === signature(items));
  if (same) return { meal: same, existed: true };
  const now = Date.now();
  const r = await db.runAsync(
    'INSERT INTO saved_meals (name, meal, items, created_at, used_at) VALUES (?, ?, ?, ?, ?)',
    savedMealName(items.map((i) => i.name)),
    meal,
    JSON.stringify(items),
    now,
    now,
  );
  const saved = (await savedMeals(db)).find((m) => m.id === r.lastInsertRowId)!;
  return { meal: saved, existed: false };
}

/** All saved meals, the ones for `meal` first, then most recently used. */
export async function savedMeals(db: SQLiteDatabase, meal?: Meal): Promise<SavedMeal[]> {
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    meal: Meal;
    items: string;
    created_at: number;
    used_at: number | null;
  }>('SELECT * FROM saved_meals ORDER BY COALESCE(used_at, created_at) DESC');
  const list = rows.map((r) => {
    const items = parse<SavedItem[]>(r.items, []);
    return {
      id: r.id,
      name: r.name,
      meal: r.meal,
      items,
      total: sum(items.map((i) => i.n)),
      usedAt: r.used_at ?? r.created_at,
    };
  });
  return meal ? [...list.filter((m) => m.meal === meal), ...list.filter((m) => m.meal !== meal)] : list;
}

/** Logs every food of a saved meal. Returns the new log entry ids (for Undo). */
export async function logSavedMeal(db: SQLiteDatabase, id: number, day: string, meal: Meal): Promise<number[]> {
  const saved = (await savedMeals(db)).find((m) => m.id === id);
  if (!saved) return [];
  const ids: number[] = [];
  const now = Date.now();
  for (const [i, it] of saved.items.entries()) {
    const r = await db.runAsync(
      'INSERT INTO food_log (day, meal, ref, name, brand, grams, amount, nutrients, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      day,
      meal,
      it.ref,
      it.name,
      it.brand,
      it.grams,
      it.amount,
      JSON.stringify(it.n),
      now + i,
    );
    ids.push(r.lastInsertRowId);
  }
  await db.runAsync('UPDATE saved_meals SET used_at = ? WHERE id = ?', now, id);
  return ids;
}

export async function deleteSavedMeal(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM saved_meals WHERE id = ?', id);
}

export async function deleteLogEntries(db: SQLiteDatabase, ids: number[]): Promise<void> {
  for (const id of ids) await db.runAsync('DELETE FROM food_log WHERE id = ?', id);
}

// ── Water ───────────────────────────────────────────────────────────────

export async function addWater(db: SQLiteDatabase, day: string, ml: number): Promise<void> {
  await db.runAsync('INSERT INTO water_log (day, ml, created_at) VALUES (?, ?, ?)', day, Math.round(ml), Date.now());
}

/** Removes the last glass of the day. */
export async function undoWater(db: SQLiteDatabase, day: string): Promise<void> {
  await db.runAsync(
    'DELETE FROM water_log WHERE id = (SELECT id FROM water_log WHERE day = ? ORDER BY created_at DESC, id DESC LIMIT 1)',
    day,
  );
}

export async function dayWater(db: SQLiteDatabase, day: string): Promise<number> {
  const r = await db.getFirstAsync<{ ml: number | null }>('SELECT SUM(ml) AS ml FROM water_log WHERE day = ?', day);
  return r?.ml ?? 0;
}

export async function waterBetween(db: SQLiteDatabase, from: string, to: string): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{ day: string; ml: number }>(
    'SELECT day, SUM(ml) AS ml FROM water_log WHERE day >= ? AND day <= ? GROUP BY day',
    from,
    to,
  );
  return new Map(rows.map((r) => [r.day, r.ml]));
}

// ── Goals ───────────────────────────────────────────────────────────────

export type GoalSettings = {
  profile: BodyProfile | null;
  /** Numbers the user set by hand; they win over the calculated ones. */
  custom: Partial<Goals>;
};

export async function getGoalSettings(db: SQLiteDatabase): Promise<GoalSettings> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'nutrition_goals'");
  const s = row ? parse<Partial<GoalSettings>>(row.value, {}) : {};
  return { profile: s.profile ?? null, custom: s.custom ?? {} };
}

export async function setGoalSettings(db: SQLiteDatabase, s: GoalSettings): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES ('nutrition_goals', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    JSON.stringify(s),
  );
}

export function goalsFrom(s: GoalSettings): Goals {
  return { ...computeGoals(s.profile), ...s.custom };
}

/** Sets a new calorie goal by hand; fat stays at 30 % of energy, carbs fill the rest. */
export function withKcalGoal(s: GoalSettings, kcal: number): GoalSettings {
  const protein = goalsFrom(s).protein;
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { ...s, custom: { ...s.custom, kcal, fat, carbs } };
}

export async function getGoals(db: SQLiteDatabase): Promise<Goals> {
  return goalsFrom(await getGoalSettings(db));
}
