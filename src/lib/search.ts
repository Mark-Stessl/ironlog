// Exercise search with suggestions. Pure functions, no React Native imports,
// so it can be tested with plain Node (see tests/logic.test.ts).

export type Searchable = {
  id: number;
  name: string;
  muscle: string;
  equipment: string;
  aliases: string; // comma-separated alternative names (incl. German)
  use_count: number;
};

/** Words people type for a body area -> muscles stored on exercises. */
const MUSCLE_SYNONYMS: Record<string, string[]> = {
  chest: ['Chest'],
  brust: ['Chest'],
  pecs: ['Chest'],
  back: ['Back'],
  ruecken: ['Back'],
  rucken: ['Back'],
  lats: ['Back'],
  shoulders: ['Shoulders'],
  schultern: ['Shoulders'],
  delts: ['Shoulders'],
  arms: ['Biceps', 'Triceps', 'Forearms'],
  arme: ['Biceps', 'Triceps', 'Forearms'],
  biceps: ['Biceps'],
  bizeps: ['Biceps'],
  triceps: ['Triceps'],
  trizeps: ['Triceps'],
  forearms: ['Forearms'],
  unterarme: ['Forearms'],
  legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  beine: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  quads: ['Quads'],
  hamstrings: ['Hamstrings'],
  glutes: ['Glutes'],
  po: ['Glutes'],
  calves: ['Calves'],
  waden: ['Calves'],
  core: ['Core'],
  abs: ['Core'],
  bauch: ['Core'],
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Edit distance, stops caring once it exceeds `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const FUZZY = 20;

function tokenScore(
  token: string,
  nameWords: string[],
  aliasPhrases: string[],
  aliasWords: string[],
  ex: Searchable,
): number {
  if (nameWords[0]?.startsWith(token)) return 100;
  if (nameWords.some((w) => w.startsWith(token))) return 80;
  // "beinpresse" is the start of an alternative name.
  if (aliasPhrases.some((p) => p.startsWith(token))) return 78;

  const muscle = normalize(ex.muscle);
  const equipment = normalize(ex.equipment);
  if (muscle.startsWith(token) || equipment.split(' ').some((w) => w.startsWith(token))) {
    return 75;
  }
  if (token.length >= 2) {
    for (const key in MUSCLE_SYNONYMS) {
      if (key.startsWith(token) && MUSCLE_SYNONYMS[key].includes(ex.muscle)) return 75;
    }
  }
  if (aliasWords.some((w) => w.startsWith(token))) return 65;

  if (token.length >= 3) {
    if (nameWords.some((w) => w.includes(token))) return 40;
    if (aliasWords.some((w) => w.includes(token))) return 30;
  }

  // Typo tolerance: compare against the start of each word.
  if (token.length >= 4) {
    const max = token.length >= 7 ? 2 : 1;
    const words = nameWords.concat(aliasWords);
    for (const w of words) {
      if (editDistance(token, w.slice(0, token.length), max) <= max) return FUZZY;
    }
  }
  return 0;
}

function match(query: string, ex: Searchable): { score: number; fuzzy: boolean } {
  const q = normalize(query);
  if (!q) return { score: 1 + Math.min(ex.use_count, 20), fuzzy: false };
  const tokens = q.split(' ');
  const name = normalize(ex.name);
  const nameWords = name.split(' ');
  const aliasPhrases = ex.aliases.split(',').map(normalize).filter(Boolean);
  const aliasWords = aliasPhrases.flatMap((p) => p.split(' '));

  let total = 0;
  let fuzzy = false;
  for (const t of tokens) {
    const s = tokenScore(t, nameWords, aliasPhrases, aliasWords, ex);
    if (s === 0) return { score: 0, fuzzy: false }; // every typed word has to match something
    if (s === FUZZY) fuzzy = true;
    total += s;
  }
  if (tokens.length > 1 && name.startsWith(q)) total += 30;
  if (name === q) total += 50;
  // Exercises you actually use float to the top: a few uses are enough to
  // beat an unused exercise that merely matches the text a bit better.
  total += Math.min(ex.use_count, 10) * 8;
  return { score: total, fuzzy };
}

/** 0 means "does not match". Higher is a better suggestion. */
export function scoreExercise(query: string, ex: Searchable): number {
  return match(query, ex).score;
}

export function searchExercises<T extends Searchable>(
  query: string,
  all: T[],
  filter?: { muscle?: string | null; equipment?: string | null },
): T[] {
  let scored: { ex: T; score: number; fuzzy: boolean }[] = [];
  for (const ex of all) {
    if (filter?.muscle && ex.muscle !== filter.muscle) continue;
    if (filter?.equipment && ex.equipment !== filter.equipment) continue;
    const m = match(query, ex);
    if (m.score > 0) scored.push({ ex, ...m });
  }
  // Typo guesses are only shown when nothing matches properly.
  if (scored.some((s) => !s.fuzzy)) scored = scored.filter((s) => !s.fuzzy);
  scored.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
  return scored.map((s) => s.ex);
}
