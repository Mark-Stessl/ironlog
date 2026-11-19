/** Accepts "62.5" and "62,5". Returns null for empty or invalid input. */
export function parseNum(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function fmtWeight(w: number | null | undefined): string {
  if (w == null) return '';
  return Number.isInteger(w) ? String(w) : String(Math.round(w * 100) / 100);
}

export function fmtSet(weight: number | null, reps: number | null): string {
  if (reps == null) return '—';
  if (!weight) return `${reps} reps`;
  return `${fmtWeight(weight)} kg × ${reps}`;
}

/** Cardio time: "25 min" or "25:30". */
export function fmtCardioTime(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`;
}

/** Seconds as the minutes you type in, e.g. 1530 s -> "25.5". */
export function minutesText(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  return fmtWeight(Math.round((seconds / 60) * 100) / 100);
}

/** A cardio set for lists: "25 min · 3.2 km" or "12 min · 40 floors". */
export function fmtCardio(
  seconds: number | null | undefined,
  distance: number | null | undefined,
  floors: boolean,
): string {
  const parts = [fmtCardioTime(seconds)];
  if (distance) parts.push(floors ? `${fmtWeight(distance)} floors` : `${fmtWeight(distance)} km`);
  return parts.filter(Boolean).join(' · ') || '—';
}

/** Estimated one-rep max (Epley). */
export function est1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtDurationShort(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtVolume(kg: number): string {
  return `${Math.round(kg).toLocaleString()} kg`;
}

export function defaultWorkoutName(now: Date): string {
  const h = now.getHours();
  if (h < 11) return 'Morning Workout';
  if (h < 14) return 'Midday Workout';
  if (h < 18) return 'Afternoon Workout';
  return 'Evening Workout';
}

/** "1 set", "3 sets". */
export function plural(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

/** Short date for lists: "Today", "Yesterday", "3 days ago", then "Nov 19". */
export function fmtAgo(ms: number, now = Date.now()): string {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };
  const diff = day(now) - day(ms);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}),
  });
}
