// Adds ?v=<stamp> to every local CSS/JS reference in public/**/*.html so browsers never use a stale copy after a deploy.
// Runs automatically as part of `npm run deploy`.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const stamp = Date.now().toString(36);
const walk = (dir) => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : []; });
let count = 0;
for (const file of walk("public")) {
  const before = readFileSync(file, "utf8");
  const after = before.replace(/(["'])(\/assets\/(?:css|js)\/[^"'?]+)(?:\?v=[^"']*)?(["'])/g, `$1$2?v=${stamp}$3`);
  if (after !== before) { writeFileSync(file, after); count++; }
}
console.log(`stamped ${count} pages with v=${stamp}`);
