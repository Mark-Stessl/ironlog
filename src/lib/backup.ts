// Backup and restore: every table of the database in one JSON file.
// Pure database code (no files), tested in tests/logic.test.ts; saving and
// picking the file is in backup-file.ts / backup-file.web.ts.
import type { SQLiteDatabase } from 'expo-sqlite';

export type Backup = {
  app: 'ironlog';
  /** Database schema version (PRAGMA user_version) the backup was made with. */
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export type BackupSummary = {
  workouts: number;
  foodDays: number;
  measurements: number;
  recipes: number;
  photos: number;
};

async function tableNames(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

async function schemaVersion(db: SQLiteDatabase): Promise<number> {
  return (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
}

export async function createBackup(db: SQLiteDatabase): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const t of await tableNames(db)) tables[t] = await db.getAllAsync(`SELECT * FROM "${t}"`);
  return { app: 'ironlog', version: await schemaVersion(db), exportedAt: new Date().toISOString(), tables };
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `ironlog-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Reads and checks a backup file's text. Throws an Error with a message meant for the user. */
export function parseBackup(json: string, currentVersion: number): Backup {
  let b: Backup;
  try {
    b = JSON.parse(json);
  } catch {
    throw new Error("This file isn't an Ironlog backup (it couldn't be read).");
  }
  if (!b || b.app !== 'ironlog' || typeof b.tables !== 'object' || b.tables == null) {
    throw new Error("This file isn't an Ironlog backup.");
  }
  if (typeof b.version !== 'number' || b.version > currentVersion) {
    throw new Error('This backup comes from a newer version of Ironlog. Update the app first, then restore it.');
  }
  return b;
}

export function summarize(b: Backup): BackupSummary {
  const t = b.tables;
  const days = new Set((t.food_log ?? []).map((r) => r.day));
  const photos =
    (t.meal_photos ?? []).length +
    [...(t.foods ?? []), ...(t.user_recipes ?? [])].filter((r) => typeof r.image === 'string' && r.image).length;
  return {
    workouts: (t.workouts ?? []).filter((r) => r.finished_at != null).length,
    foodDays: days.size,
    measurements: (t.measurements ?? []).length,
    recipes: (t.user_recipes ?? []).length,
    photos,
  };
}

/**
 * Replaces everything in the database with the backup, in one transaction:
 * if anything goes wrong, nothing changes. Columns the backup doesn't have
 * (it came from an older version) get their defaults.
 */
export async function restoreBackup(db: SQLiteDatabase, b: Backup): Promise<void> {
  const tables = await tableNames(db);
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const t of tables) {
        await db.runAsync(`DELETE FROM "${t}"`);
        const rows = b.tables[t];
        if (!Array.isArray(rows) || !rows.length) continue;
        const cols = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${t}")`)).map((c) => c.name));
        for (const row of rows) {
          const keys = Object.keys(row).filter((k) => cols.has(k));
          if (!keys.length) continue;
          await db.runAsync(
            `INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
            keys.map((k) => row[k] as string | number | null),
          );
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}

/** When the last backup was saved, in words. */
export function backupAge(at: number | null, now = Date.now()): string {
  if (!at) return 'No backup yet';
  const days = Math.floor((now - at) / 86_400_000);
  if (days <= 0) return 'Last backup: today';
  if (days === 1) return 'Last backup: yesterday';
  return `Last backup: ${days} days ago`;
}

/** Older than two weeks (or never) while there's something worth saving. */
export function backupDue(at: number | null, now = Date.now()): boolean {
  return !at || now - at > 14 * 86_400_000;
}
