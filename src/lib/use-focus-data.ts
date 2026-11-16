import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';

/**
 * Loads data from the database every time the screen comes into focus.
 * `key` re-runs the load when it changes (e.g. a route id).
 * Returns [data, reload, setData].
 */
export function useFocusData<T>(load: (db: SQLiteDatabase) => Promise<T>, key: string | number = '') {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);

  const reload = useCallback(async () => {
    setData(await load(db));
    // `load` is intentionally not a dependency: callers pass inline functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return [data, reload, setData] as const;
}
