// Photos for the built-in recipes, from Unsplash (unsplash.com/license: free to use).
// Resized to 640 x 480. Credit is shown on each recipe.

export type RecipePhoto = { source: number; author: string; url: string };

export const RECIPE_PHOTOS: Record<string, RecipePhoto> = {
  'overnight-oats': { source: require('../../assets/recipes/overnight-oats.jpg'), author: 'Alisha Hieb', url: 'https://unsplash.com/photos/LzrMzmVWhJw' },
  'protein-porridge': { source: require('../../assets/recipes/protein-porridge.jpg'), author: 'Yente Van Eynde', url: 'https://unsplash.com/photos/oh-5xHAtJg8' },
  'scrambled-eggs': { source: require('../../assets/recipes/scrambled-eggs.jpg'), author: 'Imad 786', url: 'https://unsplash.com/photos/qla1_604R4c' },
  'yogurt-bowl': { source: require('../../assets/recipes/yogurt-bowl.jpg'), author: 'Joanna Stołowicz', url: 'https://unsplash.com/photos/Qze7zeiMz0A' },
  'avocado-toast': { source: require('../../assets/recipes/avocado-toast.jpg'), author: 'Taylor Friehl', url: 'https://unsplash.com/photos/zU_x3GT4ByQ' },
  'protein-pancakes': { source: require('../../assets/recipes/protein-pancakes.jpg'), author: 'nikldn', url: 'https://unsplash.com/photos/qp7WA8AV2x0' },
  'cottage-bowl': { source: require('../../assets/recipes/cottage-bowl.jpg'), author: 'Gennady Zakharin', url: 'https://unsplash.com/photos/KmUj3vChQQc' },
  'chicken-rice-bowl': { source: require('../../assets/recipes/chicken-rice-bowl.jpg'), author: 'Di_An_h', url: 'https://unsplash.com/photos/f-Y7sAUSX2M' },
  'tuna-pasta-salad': { source: require('../../assets/recipes/tuna-pasta-salad.jpg'), author: 'Eiliv Aceron', url: 'https://unsplash.com/photos/mW0LIBBHNdE' },
  'chicken-wrap': { source: require('../../assets/recipes/chicken-wrap.jpg'), author: 'Leanna Myers', url: 'https://unsplash.com/photos/0Pr5YeRW3Z4' },
  'lentil-salad': { source: require('../../assets/recipes/lentil-salad.jpg'), author: 'Alex Bayev', url: 'https://unsplash.com/photos/7nfjR-hPbbQ' },
  'buddha-bowl': { source: require('../../assets/recipes/buddha-bowl.jpg'), author: 'Martin Baron', url: 'https://unsplash.com/photos/PBgbIbOsprk' },
  'burrito-bowl': { source: require('../../assets/recipes/burrito-bowl.jpg'), author: 'Andrew Relf', url: 'https://unsplash.com/photos/iku1zhSNRU8' },
  'salmon-potatoes': { source: require('../../assets/recipes/salmon-potatoes.jpg'), author: 'micheile henderson', url: 'https://unsplash.com/photos/t05q7TZObzc' },
  'bolognese': { source: require('../../assets/recipes/bolognese.jpg'), author: 'Homescreenify', url: 'https://unsplash.com/photos/sA3wymYqyaI' },
  'chicken-stir-fry': { source: require('../../assets/recipes/chicken-stir-fry.jpg'), author: 'Orijit Chatterjee', url: 'https://unsplash.com/photos/wEBg_pYtynw' },
  'turkey-pan': { source: require('../../assets/recipes/turkey-pan.jpg'), author: 'Allan Lainez', url: 'https://unsplash.com/photos/QvgHLCOpdJQ' },
  'chili': { source: require('../../assets/recipes/chili.jpg'), author: 'Maria Klichik', url: 'https://unsplash.com/photos/72oTVZs_730' },
  'tofu-stir-fry': { source: require('../../assets/recipes/tofu-stir-fry.jpg'), author: 'Alex Bayev', url: 'https://unsplash.com/photos/7oER79aCOys' },
  'omelette': { source: require('../../assets/recipes/omelette.jpg'), author: 'Amin Zabardast', url: 'https://unsplash.com/photos/TpdD-DDOF6Q' },
  'shrimp-pasta': { source: require('../../assets/recipes/shrimp-pasta.jpg'), author: 'Ellie Ellien', url: 'https://unsplash.com/photos/WGY9XvzMQ5s' },
  'protein-shake': { source: require('../../assets/recipes/protein-shake.jpg'), author: 'Elena Leya', url: 'https://unsplash.com/photos/JfWhrxbmF-U' },
  'apple-pb': { source: require('../../assets/recipes/apple-pb.jpg'), author: 'sheri silver', url: 'https://unsplash.com/photos/zBdYOipnD9s' },
  'yogurt-honey-walnut': { source: require('../../assets/recipes/yogurt-honey-walnut.jpg'), author: 'Joan McEwan', url: 'https://unsplash.com/photos/Ckb10FIdslw' },
  'rice-cakes': { source: require('../../assets/recipes/rice-cakes.jpg'), author: 'Monaz Hastam', url: 'https://unsplash.com/photos/BuztIyooiNg' },
  'trail-mix': { source: require('../../assets/recipes/trail-mix.jpg'), author: 'Monaz Hastam', url: 'https://unsplash.com/photos/dCcEyzd6e7Q' },
  'hummus-veggies': { source: require('../../assets/recipes/hummus-veggies.jpg'), author: 'Riddhi K', url: 'https://unsplash.com/photos/enRLKyJLxrk' },
};
