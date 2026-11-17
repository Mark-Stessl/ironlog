import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { getSetting } from '@/lib/db';
import { sound } from '@/lib/sound';

/** Applies saved settings once the database is open. Renders nothing. */
export function SettingsLoader() {
  const db = useSQLiteContext();
  useEffect(() => {
    getSetting(db, 'sound', '1').then((v) => sound.setEnabled(v === '1'));
  }, [db]);
  return null;
}
