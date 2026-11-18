// Built-in recipes. Nutrition is calculated from the ingredients (USDA data),
// so every number on a recipe comes from the food database.

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: { key: Meal; label: string; icon: 'sunny-outline' | 'partly-sunny-outline' | 'moon-outline' | 'cafe-outline' }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { key: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { key: 'snack', label: 'Snacks', icon: 'cafe-outline' },
];

export function mealLabel(m: string): string {
  return MEALS.find((x) => x.key === m)?.label ?? 'Snacks';
}

/** The meal that fits the time of day. */
export function mealForTime(d = new Date()): Meal {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snack';
}

export type Ingredient = { food: string; g: number; note?: string };

export type Recipe = {
  key: string;
  name: string;
  meal: Meal;
  minutes: number;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  tags?: string;
};

export const RECIPES: Recipe[] = [
  // ── Breakfast ──
  {
    key: 'overnight-oats',
    name: 'Berry overnight oats',
    meal: 'breakfast',
    minutes: 5,
    servings: 1,
    ingredients: [
      { food: 'oats', g: 60 },
      { food: 'milk', g: 150 },
      { food: 'greek-yogurt', g: 100 },
      { food: 'blueberries', g: 75 },
      { food: 'chia', g: 10 },
      { food: 'honey', g: 7 },
    ],
    steps: [
      'Stir oats, milk, yogurt and chia seeds together in a jar.',
      'Cover and leave in the fridge overnight.',
      'Top with blueberries and honey in the morning.',
    ],
    tags: 'meal prep',
  },
  {
    key: 'protein-porridge',
    name: 'Banana protein porridge',
    meal: 'breakfast',
    minutes: 8,
    servings: 1,
    ingredients: [
      { food: 'oats', g: 60 },
      { food: 'milk', g: 250 },
      { food: 'whey', g: 30 },
      { food: 'banana', g: 118 },
      { food: 'cinnamon', g: 1 },
    ],
    steps: [
      'Simmer oats in the milk for about 4 minutes, stirring.',
      'Take off the heat and stir in the protein powder.',
      'Top with sliced banana and cinnamon.',
    ],
    tags: 'Porridge Haferbrei',
  },
  {
    key: 'scrambled-eggs',
    name: 'Scrambled eggs on toast',
    meal: 'breakfast',
    minutes: 10,
    servings: 1,
    ingredients: [
      { food: 'egg', g: 150, note: '3 eggs' },
      { food: 'butter', g: 5 },
      { food: 'bread-wholewheat', g: 80, note: '2 slices' },
      { food: 'spinach', g: 30 },
      { food: 'tomato', g: 120 },
    ],
    steps: [
      'Whisk the eggs with a pinch of salt.',
      'Melt the butter, wilt the spinach, then add the eggs and stir gently on low heat.',
      'Serve on toasted bread with sliced tomato.',
    ],
    tags: 'Rührei Eierspeise',
  },
  {
    key: 'yogurt-bowl',
    name: 'Greek yogurt granola bowl',
    meal: 'breakfast',
    minutes: 3,
    servings: 1,
    ingredients: [
      { food: 'greek-yogurt', g: 250 },
      { food: 'granola', g: 40 },
      { food: 'strawberries', g: 100 },
      { food: 'honey', g: 7 },
    ],
    steps: ['Spoon the yogurt into a bowl.', 'Add granola and sliced strawberries, drizzle with honey.'],
    tags: 'Joghurt Müsli Skyr',
  },
  {
    key: 'avocado-toast',
    name: 'Avocado toast with eggs',
    meal: 'breakfast',
    minutes: 10,
    servings: 1,
    ingredients: [
      { food: 'bread-multigrain', g: 90, note: '2 slices' },
      { food: 'avocado', g: 75 },
      { food: 'egg', g: 100, note: '2 eggs' },
      { food: 'lemon', g: 5 },
    ],
    steps: [
      'Toast the bread and mash the avocado with lemon juice, salt and pepper.',
      'Fry or poach the eggs.',
      'Spread the avocado on the toast and top with the eggs.',
    ],
  },
  {
    key: 'protein-pancakes',
    name: 'Banana protein pancakes',
    meal: 'breakfast',
    minutes: 15,
    servings: 1,
    ingredients: [
      { food: 'banana', g: 118 },
      { food: 'egg', g: 100, note: '2 eggs' },
      { food: 'oats', g: 40 },
      { food: 'whey', g: 15 },
      { food: 'blueberries', g: 50 },
    ],
    steps: [
      'Blend banana, eggs, oats and protein powder into a batter.',
      'Cook small pancakes in a non-stick pan, about 2 minutes per side.',
      'Serve with blueberries.',
    ],
    tags: 'Palatschinken Pfannkuchen',
  },
  {
    key: 'cottage-bowl',
    name: 'Cottage cheese pineapple bowl',
    meal: 'breakfast',
    minutes: 3,
    servings: 1,
    ingredients: [
      { food: 'cottage-cheese', g: 200 },
      { food: 'pineapple', g: 85 },
      { food: 'walnuts', g: 15 },
    ],
    steps: ['Top the cottage cheese with diced pineapple and chopped walnuts.'],
    tags: 'Hüttenkäse',
  },
  // ── Lunch ──
  {
    key: 'chicken-rice-bowl',
    name: 'Chicken, rice and broccoli bowl',
    meal: 'lunch',
    minutes: 25,
    servings: 1,
    ingredients: [
      { food: 'chicken-breast', g: 150 },
      { food: 'rice', g: 200 },
      { food: 'broccoli', g: 150 },
      { food: 'soy-sauce', g: 16 },
      { food: 'olive-oil', g: 5 },
    ],
    steps: [
      'Cook the rice. Steam the broccoli for 5 minutes.',
      'Slice the chicken and sear it in the oil until cooked through.',
      'Put everything in a bowl and finish with soy sauce.',
    ],
    tags: 'Hühnchen Reis meal prep',
  },
  {
    key: 'tuna-pasta-salad',
    name: 'Tuna pasta salad',
    meal: 'lunch',
    minutes: 15,
    servings: 1,
    ingredients: [
      { food: 'pasta', g: 200 },
      { food: 'tuna', g: 120 },
      { food: 'corn', g: 80 },
      { food: 'cucumber', g: 100 },
      { food: 'tomato', g: 100 },
      { food: 'greek-yogurt-full', g: 50 },
    ],
    steps: [
      'Cook the pasta and rinse it with cold water.',
      'Mix with drained tuna, corn, diced cucumber and tomato.',
      'Stir in the yogurt and season with salt, pepper and lemon.',
    ],
    tags: 'Nudelsalat Thunfisch',
  },
  {
    key: 'chicken-wrap',
    name: 'Crispy chicken wrap',
    meal: 'lunch',
    minutes: 10,
    servings: 1,
    ingredients: [
      { food: 'tortilla', g: 60 },
      { food: 'chicken-breast', g: 120 },
      { food: 'lettuce', g: 30 },
      { food: 'tomato', g: 60 },
      { food: 'cheddar', g: 20 },
      { food: 'sour-cream', g: 15 },
    ],
    steps: [
      'Warm the tortilla in a dry pan.',
      'Spread the sour cream, add lettuce, tomato, sliced chicken and cheese.',
      'Roll it up tightly and toast it seam-side down for a minute.',
    ],
    tags: 'Wrap',
  },
  {
    key: 'lentil-salad',
    name: 'Lentil salad with feta',
    meal: 'lunch',
    minutes: 15,
    servings: 1,
    ingredients: [
      { food: 'lentils', g: 200 },
      { food: 'feta', g: 50 },
      { food: 'bell-pepper', g: 100 },
      { food: 'cucumber', g: 100 },
      { food: 'onion', g: 30 },
      { food: 'olive-oil', g: 10 },
      { food: 'balsamic', g: 10 },
    ],
    steps: [
      'Mix cooked lentils with diced pepper, cucumber and red onion.',
      'Dress with olive oil, balsamic, salt and pepper.',
      'Crumble the feta on top.',
    ],
    tags: 'Linsensalat vegetarisch',
  },
  {
    key: 'buddha-bowl',
    name: 'Quinoa buddha bowl',
    meal: 'lunch',
    minutes: 30,
    servings: 1,
    ingredients: [
      { food: 'quinoa', g: 185 },
      { food: 'chickpeas', g: 120 },
      { food: 'sweet-potato', g: 114 },
      { food: 'spinach', g: 30 },
      { food: 'avocado', g: 50 },
      { food: 'hummus', g: 30 },
    ],
    steps: [
      'Roast diced sweet potato and chickpeas at 200 °C for 25 minutes.',
      'Cook the quinoa.',
      'Arrange everything on spinach and top with avocado and hummus.',
    ],
    tags: 'vegetarisch vegan',
  },
  {
    key: 'burrito-bowl',
    name: 'Beef burrito bowl',
    meal: 'lunch',
    minutes: 20,
    servings: 1,
    ingredients: [
      { food: 'rice', g: 180 },
      { food: 'beef-mince-cooked', g: 100 },
      { food: 'black-beans', g: 100 },
      { food: 'corn', g: 60 },
      { food: 'tomato', g: 80 },
      { food: 'sour-cream', g: 15 },
    ],
    steps: [
      'Brown the mince with cumin, paprika and salt.',
      'Warm the beans and corn.',
      'Serve over rice with diced tomato and a spoon of sour cream.',
    ],
    tags: 'Mexikanisch Faschiertes',
  },
  // ── Dinner ──
  {
    key: 'salmon-potatoes',
    name: 'Salmon with potatoes and asparagus',
    meal: 'dinner',
    minutes: 30,
    servings: 1,
    ingredients: [
      { food: 'salmon', g: 125 },
      { food: 'potato', g: 250 },
      { food: 'asparagus', g: 150 },
      { food: 'olive-oil', g: 5 },
      { food: 'lemon', g: 10 },
    ],
    steps: [
      'Roast halved potatoes at 200 °C for 25 minutes.',
      'Add the asparagus and salmon for the last 12 minutes, brushed with oil.',
      'Finish with lemon juice, salt and pepper.',
    ],
    tags: 'Lachs Fisch',
  },
  {
    key: 'bolognese',
    name: 'Spaghetti bolognese',
    meal: 'dinner',
    minutes: 30,
    servings: 1,
    ingredients: [
      { food: 'pasta', g: 220 },
      { food: 'beef-mince-cooked', g: 120 },
      { food: 'tomato-sauce', g: 150 },
      { food: 'onion', g: 50 },
      { food: 'garlic', g: 3 },
      { food: 'parmesan', g: 10 },
    ],
    steps: [
      'Fry the chopped onion and garlic, then brown the mince.',
      'Add the tomato sauce and simmer for 15 minutes.',
      'Serve over spaghetti with parmesan.',
    ],
    tags: 'Nudeln Faschiertes',
  },
  {
    key: 'chicken-stir-fry',
    name: 'Chicken stir-fry with rice noodles',
    meal: 'dinner',
    minutes: 20,
    servings: 1,
    ingredients: [
      { food: 'chicken-breast', g: 150 },
      { food: 'noodles-rice', g: 175 },
      { food: 'bell-pepper', g: 100 },
      { food: 'broccoli', g: 100 },
      { food: 'soy-sauce', g: 16 },
      { food: 'olive-oil', g: 5 },
    ],
    steps: [
      'Soak or cook the rice noodles.',
      'Stir-fry the chicken strips in a hot pan, then add the vegetables for 4 minutes.',
      'Toss in the noodles and soy sauce.',
    ],
    tags: 'Wok asiatisch',
  },
  {
    key: 'turkey-pan',
    name: 'Creamy turkey and mushroom pan',
    meal: 'dinner',
    minutes: 25,
    servings: 1,
    ingredients: [
      { food: 'turkey-breast', g: 150 },
      { food: 'zucchini', g: 200 },
      { food: 'mushrooms', g: 100 },
      { food: 'cream', g: 30 },
      { food: 'rice', g: 150 },
    ],
    steps: [
      'Sear diced turkey until golden, then set aside.',
      'Fry the sliced mushrooms and zucchini.',
      'Return the turkey, add the cream and simmer for 3 minutes. Serve with rice.',
    ],
    tags: 'Putenpfanne Pute',
  },
  {
    key: 'chili',
    name: 'Chili con carne',
    meal: 'dinner',
    minutes: 35,
    servings: 1,
    ingredients: [
      { food: 'beef-mince-cooked', g: 120 },
      { food: 'kidney-beans', g: 120 },
      { food: 'tomatoes-canned', g: 200 },
      { food: 'corn', g: 60 },
      { food: 'onion', g: 50 },
      { food: 'rice', g: 150 },
    ],
    steps: [
      'Fry the onion, brown the mince and season with chili, cumin and paprika.',
      'Add the tomatoes, beans and corn and simmer for 20 minutes.',
      'Serve with rice.',
    ],
    tags: 'Faschiertes Bohnen meal prep',
  },
  {
    key: 'tofu-stir-fry',
    name: 'Crispy tofu and veggie rice',
    meal: 'dinner',
    minutes: 25,
    servings: 1,
    ingredients: [
      { food: 'tofu', g: 200 },
      { food: 'broccoli', g: 150 },
      { food: 'bell-pepper', g: 100 },
      { food: 'rice', g: 180 },
      { food: 'soy-sauce', g: 16 },
      { food: 'olive-oil', g: 10 },
    ],
    steps: [
      'Press the tofu dry, cube it and fry in the oil until crisp.',
      'Add the vegetables and cook for 5 minutes.',
      'Glaze with soy sauce and serve over rice.',
    ],
    tags: 'vegan vegetarisch',
  },
  {
    key: 'omelette',
    name: 'Ham and cheese omelette',
    meal: 'dinner',
    minutes: 10,
    servings: 1,
    ingredients: [
      { food: 'egg', g: 150, note: '3 eggs' },
      { food: 'ham', g: 40 },
      { food: 'gouda', g: 25 },
      { food: 'mushrooms', g: 80 },
      { food: 'spinach', g: 30 },
      { food: 'bread-rye', g: 45 },
    ],
    steps: [
      'Fry the mushrooms and spinach, then pour in the whisked eggs.',
      'Add ham and cheese, fold when set.',
      'Serve with a slice of rye bread.',
    ],
    tags: 'Omelett Eier',
  },
  {
    key: 'shrimp-pasta',
    name: 'Garlic shrimp pasta',
    meal: 'dinner',
    minutes: 20,
    servings: 1,
    ingredients: [
      { food: 'pasta', g: 200 },
      { food: 'shrimp', g: 120 },
      { food: 'garlic', g: 6 },
      { food: 'olive-oil', g: 10 },
      { food: 'tomato', g: 120 },
      { food: 'parmesan', g: 10 },
    ],
    steps: [
      'Cook the pasta.',
      'Fry the garlic in oil, add the shrimp and diced tomato for 3 minutes.',
      'Toss with the pasta and parmesan.',
    ],
    tags: 'Garnelen Nudeln',
  },
  // ── Snacks ──
  {
    key: 'protein-shake',
    name: 'Banana protein shake',
    meal: 'snack',
    minutes: 2,
    servings: 1,
    ingredients: [
      { food: 'whey', g: 30 },
      { food: 'milk', g: 300 },
      { food: 'banana', g: 118 },
    ],
    steps: ['Blend everything until smooth.'],
    tags: 'Shake Eiweiß post workout',
  },
  {
    key: 'apple-pb',
    name: 'Apple with peanut butter',
    meal: 'snack',
    minutes: 2,
    servings: 1,
    ingredients: [
      { food: 'apple', g: 182 },
      { food: 'peanut-butter', g: 32 },
    ],
    steps: ['Slice the apple and dip it in the peanut butter.'],
  },
  {
    key: 'yogurt-honey-walnut',
    name: 'Yogurt with honey and walnuts',
    meal: 'snack',
    minutes: 2,
    servings: 1,
    ingredients: [
      { food: 'greek-yogurt', g: 170 },
      { food: 'honey', g: 7 },
      { food: 'walnuts', g: 15 },
    ],
    steps: ['Top the yogurt with honey and chopped walnuts.'],
  },
  {
    key: 'rice-cakes',
    name: 'Rice cakes with peanut butter',
    meal: 'snack',
    minutes: 3,
    servings: 1,
    ingredients: [
      { food: 'rice-cakes', g: 27, note: '3 cakes' },
      { food: 'peanut-butter', g: 16 },
      { food: 'banana', g: 60 },
    ],
    steps: ['Spread peanut butter on the rice cakes and top with banana slices.'],
    tags: 'pre workout',
  },
  {
    key: 'trail-mix',
    name: 'Trail mix',
    meal: 'snack',
    minutes: 1,
    servings: 1,
    ingredients: [
      { food: 'almonds', g: 20 },
      { food: 'cashews', g: 15 },
      { food: 'raisins', g: 15 },
      { food: 'dark-chocolate', g: 10 },
    ],
    steps: ['Mix everything and keep it in a small box.'],
    tags: 'Nüsse Studentenfutter',
  },
  {
    key: 'hummus-veggies',
    name: 'Hummus with veggie sticks',
    meal: 'snack',
    minutes: 5,
    servings: 1,
    ingredients: [
      { food: 'hummus', g: 60 },
      { food: 'carrot', g: 100 },
      { food: 'cucumber', g: 100 },
      { food: 'bell-pepper', g: 60 },
    ],
    steps: ['Cut the vegetables into sticks and dip them in the hummus.'],
    tags: 'vegan',
  },
];
