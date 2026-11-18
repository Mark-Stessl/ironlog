// One shape for everything that can be eaten: USDA foods, scanned or searched
// products, your own foods, built-in recipes and your own recipes.

import foodData from './food-data.json';
import { per100Of, scale, sum, type Nutrients } from './nutrition';
import { RECIPES, type Meal, type Recipe } from './recipes';
import { normalize, scoreExercise } from './search';

export type Serving = { label: string; g: number };

export type RecipeInfo = {
  meal: Meal;
  minutes: number | null;
  servings: number;
  totalG: number;
  ingredients: { ref: string; name: string; g: number; note?: string }[];
  steps: string[];
};

export type FoodSource = 'usda' | 'product' | 'custom' | 'recipe' | 'my-recipe';

export type FoodItem = {
  /** f:<key> USDA food, p:<id> product or own food, r:<key> built-in recipe, u:<id> own recipe */
  ref: string;
  source: FoodSource;
  name: string;
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

type RawFood = { key: string; name: string; words: string; category: string; servings: Serving[]; n: Nutrients };

export const BUILTIN_FOODS: FoodItem[] = (foodData as RawFood[]).map((f) => ({
  ref: `f:${f.key}`,
  source: 'usda',
  name: f.name,
  brand: '',
  category: f.category,
  words: f.words,
  per100: f.n,
  servings: f.servings,
  useCount: 0,
}));

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

/** Search across foods and recipes, with German names and typo tolerance. */
export function searchFoods(query: string, items: FoodItem[]): FoodItem[] {
  const asSearchable = (f: FoodItem, words: string, name = f.name) => ({
    id: 0,
    name,
    muscle: f.category,
    equipment: f.brand,
    aliases: words.split(/\s+/).join(','),
    use_count: f.useCount,
  });
  const scored: { f: FoodItem; score: number }[] = [];
  for (const f of items) {
    let score = scoreExercise(query, asSearchable(f, f.words));
    // A recipe that contains the food comes after the food itself.
    if (!score && f.ingredientWords) score = scoreExercise(query, asSearchable(f, f.ingredientWords, '')) * 0.5;
    if (score > 0) scored.push({ f, score });
  }
  // Typo guesses (low scores) only when nothing matches properly.
  const best = Math.max(0, ...scored.map((s) => s.score));
  const shown = best >= 30 ? scored.filter((s) => s.score >= 25) : scored;
  const isRecipe = (f: FoodItem) => (f.recipe ? 1 : 0);
  shown.sort((a, b) => b.score - a.score || isRecipe(a.f) - isRecipe(b.f) || a.f.name.length - b.f.name.length);
  return shown.map((s) => s.f);
}

/** Cheap check whether a query looks like it means a specific item already in the list. */
export function hasExact(query: string, items: FoodItem[]): boolean {
  const q = normalize(query);
  return items.some((f) => normalize(f.name) === q);
}

