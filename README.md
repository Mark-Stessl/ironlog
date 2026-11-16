# Ironlog

A personal workout tracker in the style of Hevy, built with React Native and Expo.
Everything is stored on the phone (SQLite), so it works offline in the gym and needs no account or server.

## What works now

- **Workout logging**: exercises → sets → kg × reps, tick sets off as you go
- **"Previous" column**: shows what you lifted last time; tap it to copy the values, or just tick an empty set to reuse them
- **Rest timer**: starts when you tick a set (off / 60 / 90 / 120 / 150 / 180 s, with −15 / +15 / skip)
- **Machine and exercise search**: about 110 built-in machines and exercises, suggestions while you type
  - by name (`che` → Chest Press, Chest Dip …)
  - by muscle or body area (`back`, `legs`, `abs`)
  - by German name (`beinpresse`, `latzug`, `butterfly`)
  - small typos are tolerated, and exercises you use often move to the top
  - filter chips for muscle and equipment
- **Custom exercises** for machines that are missing
- **Routines**: build "Push Day" once and start it with one tap, or save a finished workout as a routine
- **History** of finished workouts with duration, volume and sets
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

## Project layout

```
src/app/                 screens (Expo Router, one file per screen)
  (tabs)/index.tsx       Workout tab: start a workout, routines
  (tabs)/history.tsx     finished workouts
  (tabs)/exercises.tsx   exercise library with search
  workout/[id].tsx       running workout / summary of a finished one
  routine/[id].tsx       routine editor
  exercise/[id].tsx      records and history of one exercise
  exercise-picker.tsx    "Add Exercise" search
  exercise-new.tsx       create a custom exercise
src/lib/db.ts            database schema and all queries
src/lib/search.ts        search and suggestion ranking
src/lib/exercise-data.ts built-in machine and exercise list
tests/logic.test.ts      tests for search and database logic
```

## Checks

```bash
npm run typecheck
npm test
```

## Planned next

1. Meals and calories: food search and barcode scanning (Open Food Facts), daily calorie and protein goals
2. Progress charts per exercise and a workout calendar
3. Bodyweight log with trend line
4. Rest timer notification when the app is in the background
5. Backup and export of the database
