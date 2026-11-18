# Ironlog

A personal workout and food tracker in the style of Hevy, built with React Native and Expo.
Everything is stored on the phone (SQLite), so it works offline in the gym and needs no account or server.

## What works now

- **Workout logging**: exercises → sets → kg × reps, tick sets off as you go
- **"Previous" column**: shows what you lifted last time; tap it to copy the values, or just tick an empty set to reuse them
- **Rest timer**: starts when you tick a set (off / 60 / 90 / 120 / 150 / 180 s, with −15 / +15 / skip)
- **Rest-over reminder**: a notification when the break is over, even if you switched to another app (phone app; in the browser it works on desktop and Android Chrome after tapping the bell, but not on iPhone, which pauses web pages in the background)
- **Machine and exercise search**: about 110 built-in machines and exercises, suggestions while you type
  - by name (`che` → Chest Press, Chest Dip …)
  - by muscle or body area (`back`, `legs`, `abs`)
  - by German name (`beinpresse`, `latzug`, `butterfly`)
  - small typos are tolerated, and exercises you use often move to the top
  - filter chips for muscle and equipment
- **Pictures and how-to guides**: illustrations for 99 of the built-in exercises (start and end pose, shown as a looping animation on the exercise page), step-by-step instructions and form tips
- **Form videos**: each exercise page has a button that opens a YouTube search for a form tutorial
- **Body map**: a front and back figure on every exercise page showing the primary and secondary muscles it trains
- **Custom exercises** for machines that are missing: create one right from any search (with the muscles it works); from a workout or routine it's added there straight away
- **Routines**: build "Push Day" once and start it with one tap, or save a finished workout as a routine
- **History** of finished workouts with duration, volume and sets
- **Sounds** for new records, end of rest and finishing (mix with your music, respect the silent switch, adjustable volume from the speaker button, can be muted)
- **Routine changes**: finish a routine workout that differed from the plan and choose to update the routine, save it as a new one, or keep the old one
- **PR celebrations**: beat your heaviest weight, your reps at that weight, or your estimated 1RM and you get confetti, a "New PR" banner and a gold set row. One set can beat up to three records at once (tap the trophy to see them), and if a later set beats them again only the newest one counts
- **Workout complete screen** with your records, counting-up stats, which workout number it was and a body heatmap of the muscles you trained
- **Profile** with your name, total workouts since you started, total volume and sets, and shortcuts to the exercise library, calendar and measures
- **Statistics** (on the profile) per week, month or year: totals compared with the previous period, a muscle distribution chart (Chest, Back, Shoulders, Arms, Legs, Core) and a body heatmap with sets per muscle
- **Calendar** of the days you trained; days without a workout can be marked as rest days, which keep your day streak going and show as a moon on the home screen
- **Measures**: body weight with a chart and history, plus optional body fat and body measurements (neck, chest, arms, waist, thighs, ...)
- **Weight trend**: a smoothed trend line (exponential moving average, 10 % a day) under the daily scale readings, with kg per week
- **Calorie check**: compares the last 28 days of weight trend with what you logged, estimates the calories you really burn (1 kg ≈ 7,700 kcal) and suggests a goal that fits your aim

### Food

- **Food tab** per day: calorie ring, protein / carbs / fat against your goals, energy split, fibre, sugar, saturated fat and salt, eight vitamins and minerals as % of the EU reference, and the last 7 days
- **Water tracker** with a glass that fills up (+250 ml glass, +500 ml bottle, undo)
- **German national nutrient database (BLS 4.0)** from the Max Rubner-Institut: about 7,150 foods and dishes (Kaiserschmarren, Gulasch, Apfelstrudel, Knödel, ...), searchable in English, German and Austrian words (Topfen, Paradeiser, Semmel, Erdäpfel, Faschiertes, Karfiol, ...)
- **144 everyday foods with portion sizes** (1 banana, 1 Semmel, 1 cup of skyr, ...) ranked first
- **26 recipes** for breakfast, lunch, dinner and snacks; their nutrition is calculated from the ingredients
- **Supermarket products** from Open Food Facts: scan the barcode with the camera (on-device decoding with ZXing, works in iPhone Safari) or search by name. Free, no account, no key; products are kept on the phone after the first lookup
- **Your own foods** typed in from the label, and **your own recipes** with nutrition calculated automatically
- **Pictures**: a photo for every built-in recipe, package photos for supermarket products, an emoji for every food, and your own photos of meals, foods and recipes (taken or picked from the gallery, kept only on the phone)
- **Goals**: EU reference intakes by default; with age, height, weight and activity, calories come from the Henry equation × EFSA activity level, protein from g per kg body weight (ISSN 1.4–2.0), fat 30 % of energy, water from EFSA (2.0 L men / 1.6 L women from drinks); every number can be overridden
- Quick add, "same as yesterday" for a whole meal, edit entries, browse earlier days
- **One-tap remove** with Undo on every logged entry
- **Favourites** (star on any food or recipe) and **saved meals**: the bookmark next to a meal saves it as a usual meal, which is then added again with one tap from the empty meal or the add screen
- **Week strip and streak** on the home screen
- **Personal records** per exercise (heaviest set, estimated 1RM, best session volume) and a trophy on sets that beat your previous best weight

## Run it on your phone

You need [Node.js](https://nodejs.org) (20 or newer) on your computer and the **Expo Go** app on your phone.

```bash
git clone https://github.com/Mark-Stessl/ironlog.git
cd ironlog
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the camera app (iPhone). Phone and computer must be on the same Wi-Fi.

If Expo Go says the project needs a newer SDK than it supports, update Expo Go, or create a development build with `npx expo run:android`.

## Layout

On phones the app uses bottom tabs. In a browser window wider than 900 px it switches to a desktop layout like Hevy's web app: a sidebar, the exercise library next to the workout and routine editor, and a list + detail view for exercises.

## Run it in the browser

```bash
npm run web
```

The web version uses the same code and keeps its data in the browser, separate from the phone app. Added to the iPhone home screen it has its own icon and launch screen and opens without internet: a service worker (`public/sw.js`) keeps a copy of the app, and `scripts/precache.mjs` writes the list of files into it after each build. Every push to `main` also builds it and publishes it to GitHub Pages (see `.github/workflows/deploy-web.yml`).

## Project layout

```
src/app/                 screens (Expo Router, one file per screen)
  (tabs)/index.tsx       Workout tab: start a workout, routines
  (tabs)/food.tsx        Food tab: calories, macros, micros, water, meals
  food-add.tsx           search foods, recipes and products
  food/[ref].tsx         amount and nutrition of a food or recipe
  food-scan.tsx          barcode scanner
  food-new.tsx           type in a food from its label
  recipe-new.tsx         build your own recipe
  nutrition-goals.tsx    body profile and goals
  (tabs)/history.tsx     finished workouts
  (tabs)/profile.tsx     profile, totals and statistics
  exercises.tsx          exercise library with search
  calendar.tsx           training and rest days
  measures.tsx           body weight and measurements
  measure/[kind].tsx     history of one measurement
  workout/[id].tsx       running workout / summary of a finished one
  routine/[id].tsx       routine editor
  exercise/[id].tsx      records and history of one exercise
  exercise-picker.tsx    "Add Exercise" search
  exercise-new.tsx       create a custom exercise
src/lib/db.ts            database schema and all queries
src/lib/search.ts        search and suggestion ranking
src/lib/exercise-data.ts built-in machine and exercise list
src/lib/exercise-media.json pictures and instructions (generated by scripts/build-exercise-media.py)
src/lib/nutrition.ts     nutrients, reference values and goal formulas
src/lib/foods.ts         foods, recipes and food search
src/lib/bls-data.json    BLS 4.0 foods (generated)
src/lib/food-db.ts       food log, water, own foods and recipes
src/lib/off.ts           Open Food Facts (barcode lookup and search)
src/lib/recipes.ts       built-in recipes
src/lib/recipe-photos.ts recipe photos (assets/recipes) and their credits
src/lib/food-emoji.ts    emoji per food and food group
src/lib/photo.ts         take or pick a photo, resized and kept on the phone
tests/logic.test.ts      tests for search, database and nutrition logic
```

## Checks

```bash
npm run typecheck
npm test
```

## Planned next

1. Progress charts per exercise
2. Backup and export of the database

## Credits

Exercise data by [RepDB](https://repdb.co) (free tier, used under its [license](https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md)).
The illustrations are loaded from RepDB's own site and are not part of this repository.

Food data: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: [10.25826/Data20251217-134202-0](https://doi.org/10.25826/Data20251217-134202-0), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Converted (16 of 138 nutrients, values below the detection limit counted as 0, Austrian search words added) into `src/lib/food-data.json` and `src/lib/bls-data.json` by `scripts/build-food-data.py`.
Product data from [Open Food Facts](https://world.openfoodfacts.org), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
Reference values: EU Regulation 1169/2011 Annex XIII; EFSA dietary reference values (energy 2013; carbohydrates, fibre, fats and water 2010); ISSN position stand on protein and exercise (2017).
Recipe photos from [Unsplash](https://unsplash.com/license) (free to use); each recipe credits its photographer. Product photos from Open Food Facts, licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), shown with a credit.
Barcode decoding: [ZXing](https://github.com/zxing-js/library) (Apache 2.0).
