// Day keys and month grids for the training calendar. Days use local time.

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-18" for a time in local time. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Midnight (local) of a day key. */
export function dayStart(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function monthStart(year: number, month: number): number {
  return new Date(year, month, 1).getTime();
}

/**
 * Weeks (Monday first) covering a month. Days outside the month are null.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function dayLabel(key: string): string {
  return new Date(dayStart(key)).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Days in a row up to today that were trained or marked as rest. Today counts once it's done. */
export function dayStreak(done: Set<string>, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  if (!done.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1); // today isn't over yet
  let streak = 0;
  while (done.has(dayKey(d.getTime()))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** The day key `n` days after (or before, if negative) `key`. */
export function addDays(key: string, n: number): string {
  const d = new Date(dayStart(key));
  d.setHours(12);
  d.setDate(d.getDate() + n);
  return dayKey(d.getTime());
}

/** "Today", "Yesterday", "Tomorrow" or "Mon, Nov 16". */
export function relativeDay(key: string, now = Date.now()): string {
  const today = dayKey(now);
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  return new Date(dayStart(key)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
