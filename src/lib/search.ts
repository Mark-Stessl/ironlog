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

/**
 * Edit distance where swapping two neighbouring letters counts as one typo
 * ("sqaut" -> "squat"). Stops caring once it exceeds `max`.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos a typed word may have: none for 1-2 letters, 1 up to 6, 2 from 7. */
function typoBudget(token: string): number {
  return token.length < 3 ? 0 : token.length >= 7 ? 2 : 1;
}

/**
 * Smallest typo distance between `token` and the start of `word`. Compares with
 * starts one letter shorter or longer too, so missing or extra letters count once
 * ("dedlift" -> "deadlift", "sqquat" -> "squat").
 */
function typoDistance(token: string, word: string, max: number): number {
  let best = max + 1;
  for (const len of [token.length - 1, token.length, token.length + 1]) {
    if (len < 2 || len > word.length) continue;
    // A short word must be typed (nearly) whole: "rwo" may mean "row", not "rowing".
    if (token.length <= 3 && word.length > len + 1) continue;
    best = Math.min(best, editDistance(token, word.slice(0, len), max));
    if (best === 0) break;
  }
  return best;
}

function tokenScore(
  token: string,
  nameWords: string[],
  aliasPhrases: string[],
  aliasWords: string[],
  ex: Searchable,
  joined: string[],
): [number, boolean] {
  if (nameWords[0]?.startsWith(token)) return [100, false];
  if (nameWords.some((w) => w.startsWith(token))) return [80, false];
  // "beinpresse" is the start of an alternative name.
  if (aliasPhrases.some((p) => p.startsWith(token))) return [78, false];

  const muscle = normalize(ex.muscle);
  const equipment = normalize(ex.equipment);
  if (muscle.startsWith(token) || equipment.split(' ').some((w) => w.startsWith(token))) {
    return [75, false];
  }
  if (token.length >= 2) {
    for (const key in MUSCLE_SYNONYMS) {
      if (key.startsWith(token) && MUSCLE_SYNONYMS[key].includes(ex.muscle)) return [75, false];
    }
  }
  // Typed without spaces: "latpulldown", "legpress".
  if (token.length >= 5 && joined.some((j) => j.startsWith(token))) return [72, false];
  if (aliasWords.some((w) => w.startsWith(token))) return [65, false];

  if (token.length >= 3) {
    if (nameWords.some((w) => w.includes(token))) return [40, false];
    if (aliasWords.some((w) => w.includes(token))) return [30, false];
  }

  // Typos. Closer spellings and name words rank higher than alias or muscle words.
  const max = typoBudget(token);
  if (max) {
    const muscleWords = [muscle, ...equipment.split(' ')];
    for (const key in MUSCLE_SYNONYMS) if (MUSCLE_SYNONYMS[key].includes(ex.muscle)) muscleWords.push(key);
    const groups: [string[], number][] = [
      [nameWords, 24],
      [joined, 22],
      [aliasWords, 18],
      [muscleWords, 16],
    ];
    let best = 0;
    for (const [words, base] of groups) {
      for (const [i, w] of words.entries()) {
        const d = typoDistance(token, w, max);
        // +4 when it's the name's first word: "sqaut" -> "Squat" before "Split Squat".
        if (d <= max) best = Math.max(best, base - d * 3 + (words === nameWords && i === 0 ? 4 : 0));
      }
    }
    if (best) return [best, true];
  }
  return [0, false];
}

function match(query: string, ex: Searchable): { score: number; fuzzy: boolean } {
  const q = normalize(query);
  if (!q) return { score: 1 + Math.min(ex.use_count, 20), fuzzy: false };
  const tokens = q.split(' ');
  const name = normalize(ex.name);
  const nameWords = name.split(' ');
  const aliasPhrases = ex.aliases.split(',').map(normalize).filter(Boolean);
  const aliasWords = aliasPhrases.flatMap((p) => p.split(' '));
  const joined = [name, ...aliasPhrases].map((p) => p.replace(/ /g, ''));

  let total = 0;
  let fuzzy = false;
  for (const t of tokens) {
    const [s, typo] = tokenScore(t, nameWords, aliasPhrases, aliasWords, ex, joined);
    if (s === 0) return { score: 0, fuzzy: false }; // every typed word has to match something
    if (typo) fuzzy = true;
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
  return searchExercisesInfo(query, all, filter).results;
}

/** Like searchExercises, and says whether the results are guesses for a misspelling. */
export function searchExercisesInfo<T extends Searchable>(
  query: string,
  all: T[],
  filter?: { muscle?: string | null; equipment?: string | null },
): { results: T[]; typo: boolean } {
  let scored: { ex: T; score: number; fuzzy: boolean }[] = [];
  for (const ex of all) {
    if (filter?.muscle && ex.muscle !== filter.muscle) continue;
    if (filter?.equipment && ex.equipment !== filter.equipment) continue;
    const m = match(query, ex);
    if (m.score > 0) scored.push({ ex, ...m });
  }
  // Typo guesses are only shown when nothing matches properly.
  const exact = scored.some((s) => !s.fuzzy);
  if (exact) scored = scored.filter((s) => !s.fuzzy);
  scored.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
  return { results: scored.map((s) => s.ex), typo: !exact && scored.length > 0 };
}
