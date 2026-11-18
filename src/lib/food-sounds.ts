// Which sound to play when food is added: the soft "tock", or a warm chord when
// this addition is the one that reaches the day's protein goal.
import type { SQLiteDatabase } from 'expo-sqlite';

import { dailyTotals, getGoals } from './food-db';
import { sound } from './sound';

/** Call right after logging. `addedProtein` is the protein (g) that was just added. */
export async function playFoodAdded(db: SQLiteDatabase, day: string, addedProtein: number): Promise<void> {
  try {
    const [totals, goals] = await Promise.all([dailyTotals(db, day, day), getGoals(db)]);
    const now = totals.get(day)?.protein ?? 0;
    const before = now - addedProtein;
    sound.play(before < goals.protein && now >= goals.protein ? 'foodGoal' : 'foodAdd');
  } catch {
    sound.play('foodAdd');
  }
}
