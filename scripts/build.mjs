// Builds the anti-slop plugin to JavaScript in build/: Node will not strip types from a .ts file under node_modules,
// which is where an installed tsaudit lives. Runs on `npm install` in a checkout and before `npm pack`/`npm publish`.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "vendor", "anti-slop");
const to = join(root, "build", "anti-slop");
rmSync(to, { recursive: true, force: true });
for (const file of readdirSync(from, { recursive: true })) {
  if (!file.endsWith(".ts")) continue;
  const out = join(to, file.replace(/\.ts$/, ".js"));
  const js = stripTypeScriptTypes(readFileSync(join(from, file), "utf8")).replace(/(from\s+(["'])\.{1,2}\/[^"']*)\.ts\2/g, "$1.js$2");
  if (/from\s+["']\.{1,2}\/[^"']*\.ts["']/.test(js)) throw new Error(`${file}: a relative .ts import is left`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, js);
}
console.log(`built ${relative(root, to)}`);
