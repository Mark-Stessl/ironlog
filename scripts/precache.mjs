// Runs after `expo export --platform web`: writes the list of built files and a
// version into dist/sw.js, so the home-screen app keeps a copy and opens offline.
// Usage: node scripts/precache.mjs [dist]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] ?? 'dist';
// Not needed offline: launch screens (iOS reads them when the app is added), the
// 404 copy, build metadata and the worker itself.
const SKIP = [/^splash\//, /^404\.html$/, /^metadata\.json$/, /^sw\.js$/, /^index\.html$/, /\.map$/];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(dist)
  .map((p) => relative(dist, p).split(sep).join('/'))
  .filter((f) => !SKIP.some((re) => re.test(f)))
  .sort();

const hash = createHash('sha256');
for (const f of [...files, 'index.html']) {
  hash.update(f);
  hash.update(readFileSync(join(dist, f)));
}
const version = hash.digest('hex').slice(0, 12);

const swPath = join(dist, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
if (!sw.includes("const VERSION = 'dev';") || !sw.includes('const FILES = [];')) {
  throw new Error('sw.js placeholders not found');
}
writeFileSync(
  swPath,
  sw
    .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
    .replace('const FILES = [];', `const FILES = ${JSON.stringify(files)};`),
);
const mb = files.reduce((s, f) => s + statSync(join(dist, f)).size, 0) / 1e6;
console.log(`sw.js: version ${version}, ${files.length} files, ${mb.toFixed(1)} MB kept for offline use`);
