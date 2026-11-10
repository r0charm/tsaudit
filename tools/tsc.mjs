// tsc: the type errors the compiler reports, once per TypeScript project found under the target (tests too, if its tsconfig includes them).
// A project is each tsconfig.json, except a base others extend and a solution file ("files": []), which stands for the projects it references.
// Each runs through a throwaway config that extends it with emit off, so no build output is written
// and references resolve to their sources instead of build output that may not exist.
// tsc resolves the default include, ${configDir}, types and typeRoots from the folder of the config it is given,
// so the throwaway config sits next to the project's own, hidden, for the length of its run only.
// Uses the nearest TypeScript the project installs, since its tsconfig is written for that version; otherwise the pinned one here.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, parse, relative, resolve } from "node:path";
import { IGNORE } from "./oxlint.mjs";

const read = (file) => {
  // tsconfig is JSONC: drop comments and trailing commas, leaving strings alone.
  const text = readFileSync(file, "utf8")
    .replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? "")
    .replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

const find = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return IGNORE.includes(e.name) ? [] : find(join(dir, e.name));
    return e.name === "tsconfig.json" ? [join(dir, e.name)] : [];
  });

const asConfig = (p) => (p.endsWith(".json") ? p : existsSync(`${p}.json`) ? `${p}.json` : join(p, "tsconfig.json"));
const isSolution = (c) => Array.isArray(c.files) && c.files.length === 0 && c.include === undefined;
// A base with sources of its own is also a project; one whose include is written for its extenders (${configDir}/src) is not.
const ownSources = (list) => Array.isArray(list) && list.some((p) => !p.includes("${configDir}"));
const hasSources = (c) => ownSources(c.include) || ownSources(c.files);

function projects(target) {
  // Every config in play: each tsconfig.json found, plus whatever a solution file references (tsconfig.app.json and the like).
  const configs = new Map();
  const load = (file) => {
    if (configs.has(file) || !existsSync(file)) return;
    const c = read(file);
    configs.set(file, c);
    if (isSolution(c)) (c.references ?? []).forEach((r) => load(asConfig(resolve(dirname(file), r.path))));
  };
  const found = find(target);
  found.forEach(load);
  // A base is a config another one extends (relative extends only: a package such as @tsconfig/node22 is never a project here).
  const bases = new Set(
    [...configs].flatMap(([f, c]) => [c.extends ?? []].flat().filter((e) => e.startsWith(".")).map((e) => asConfig(resolve(dirname(f), e)))),
  );
  const out = new Set();
  const visit = (file) => {
    const c = configs.get(file);
    if (c === undefined || out.has(file)) return;
    if (isSolution(c)) return c.references?.forEach((r) => visit(asConfig(resolve(dirname(file), r.path))));
    if (!bases.has(file) || hasSources(c)) out.add(file);
  };
  found.forEach(visit);
  return [...out];
}

const typescript = (from, target, pinned) => {
  for (let dir = from; ; dir = dirname(dir)) {
    const pkg = join(dir, "node_modules", "typescript");
    if (existsSync(join(pkg, "bin", "tsc"))) return { pkg, own: true };
    if (dir === target || dir === dirname(dir)) return { pkg: pinned, own: false };
  }
};
const version = (pkg) => read(join(pkg, "package.json")).version;

export default {
  name: "tsc",
  skip: "no tsconfig.json",
  commands({ pkgDir, target, agent }) {
    const pinned = pkgDir("typescript");
    return projects(target).map((file, i) => {
      const { pkg, own } = typescript(dirname(file), target, pinned);
      const config = join(dirname(file), `.tsaudit-${process.pid}-${i}.tsconfig.json`);
      // rootDir at the filesystem root: with emit off it only guards file placement, and references now pull in sibling sources.
      const compilerOptions = { noEmit: true, composite: false, incremental: false, emitDeclarationOnly: false, rootDir: parse(file).root };
      return {
        files: { [config]: JSON.stringify({ extends: file, compilerOptions }) },
        bin: join(pkg, "bin", "tsc"),
        // --agent: one line per error, no code frame. Otherwise tsc decides (code frames in a terminal).
        args: ["-p", config, ...(agent ? ["--pretty", "false"] : [])],
        label: `${relative(target, file) || "tsconfig.json"}, typescript ${version(pkg)}${own ? ", the project's" : ""}`,
      };
    });
  },
  // tsc exits non-zero whenever it reports diagnostics, whatever their kind.
  status: (code) => (code === 0 ? 0 : 1),
};
