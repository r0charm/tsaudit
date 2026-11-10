// Canary: runs the tsaudit CLI against a deliberately sloppy project.
// Fails when a tool update drops or renames a rule, or the runner stops wiring its tools together.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "bin", "tsaudit.mjs");

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + detail}`);
  if (!ok) failed++;
};

const tsaudit = (...args) => spawnSync("node", [cli, here, ...args], { encoding: "utf8" });

const all = tsaudit();
check("a full run exits 1 on findings", all.status === 1, `status ${all.status}: ${all.stderr}`);
check("a full run heads each tool's output", /^== tsc .*==$/m.test(all.stdout) && /^== oxlint ==$/m.test(all.stdout), all.stdout.slice(0, 300));
check("tool options without --only are refused", tsaudit("-f", "json").status === 2);

const types = tsaudit("--only", "tsc");
check("tsc reports the type error", types.status === 1 && /type-error\.ts.*TS2322/.test(types.stdout), types.stdout);

// A monorepo: no root project, a base with a ${configDir} include, a solution file, a reference never built, a package with no include.
const mono = spawnSync("node", [cli, join(here, "monorepo"), "--only", "tsc"], { encoding: "utf8" });
check("tsc runs each package, not the base or the solution file",
  mono.status === 1 && /^== tsc \(packages\/a\/tsconfig\.json,/m.test(mono.stdout) && /^== tsc \(packages\/b\/tsconfig\.app\.json,/m.test(mono.stdout)
    && (mono.stdout.match(/^== /gm) ?? []).length === 3, mono.stdout);
// Everything tsc resolves from the config's folder: the default include, ${configDir}, types, typeRoots.
check("tsc resolves paths from the project's folder", /packages\/c\/src\/index\.ts.*TS2322/.test(mono.stdout) && !/TS18003|TS5\d{3}/.test(mono.stdout), mono.stdout);
check("tsc finds the project's types entries, @types or a package's", !/TS2688|TS2304/.test(mono.stdout), mono.stdout);
check("tsc checks a reference from its source", /packages\/b\/src\/index\.ts.*TS2322/.test(mono.stdout) && !/TS6305/.test(mono.stdout), mono.stdout);
const written = readdirSync(join(here, "monorepo"), { recursive: true }).filter((f) => /dist|tsbuildinfo|\.tsaudit-/.test(f));
check("tsc writes nothing in the project", written.length === 0, written.join(", "));
const none = spawnSync("node", [cli, join(here, "monorepo", "packages", "a", "src"), "--only", "tsc"], { encoding: "utf8" });
check("no tsconfig.json says tsc was skipped", none.status === 0 && /^== tsc: skipped/m.test(none.stdout), none.stdout);

const plain = all.stdout.replace(/\x1b\[[0-9;]*m/g, "");
check("oxlint defaults to stylish, grouped by file", /^\S*sloppy\.ts\n\s+\d+:\d+\s+error\s/m.test(plain), plain.slice(-300));
const agent = tsaudit("--agent");
check("--agent gives one line per finding with its help",
  /^src\/sloppy\.ts:\d+:\d+: error .*help: /m.test(agent.stdout) && /type-error\.ts\(\d+,\d+\): error TS2322/.test(agent.stdout), agent.stdout.slice(0, 300));

const run = tsaudit("--only", "oxlint", "-f", "json");
check("oxlint exits 1 on findings", run.status === 1, `status ${run.status}: ${run.stderr}`);

const expected = [
  "typescript(no-explicit-any)", "typescript(no-non-null-assertion)", "typescript(no-floating-promises)",
  "typescript(no-unsafe-member-access)", "typescript(no-unsafe-return)", "typescript(no-unsafe-type-assertion)",
  "typescript(prefer-nullish-coalescing)", "typescript(strict-boolean-expressions)", "typescript(switch-exhaustiveness-check)",
  "anti-slop(no-unsafe-dictionary-type)",
];
const diagnostics = run.stdout.startsWith("{") ? JSON.parse(run.stdout).diagnostics : [];
const fired = new Set(diagnostics.map((d) => d.code));
for (const r of expected) check(`rule fires: ${r}`, fired.has(r), "dropped or renamed by the tool update?");
// One rule per mistake: a second rule on the same assertion or a style-only rule is noise.
for (const r of ["anti-slop(require-safety-comment-for-type-assertion)", "anti-slop(no-chained-type-assertions)", "eslint(curly)", "eslint(no-underscore-dangle)"]) check(`rule stays off: ${r}`, !fired.has(r));
check("only the fixture source is linted", diagnostics.every((d) => d.filename.startsWith("src/")), [...new Set(diagnostics.map((d) => d.filename))].join(", "));

check("test folders are skipped", !diagnostics.some((d) => d.filename.includes("/tests/")));
const tests = tsaudit("--tests", "--only", "oxlint", "-f", "json");
check("--tests lints them", tests.stdout.startsWith("{") && JSON.parse(tests.stdout).diagnostics.some((d) => d.filename === "src/tests/helper.ts"));

const version = spawnSync("node", [cli, "--version"], { encoding: "utf8" });
check("--version prints the version", version.status === 0 && /^\d+\.\d+\.\d+/.test(version.stdout), version.stdout);

const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")).version;
check("the README badge shows the package version", readFileSync(join(here, "..", "README.md"), "utf8").includes(`badge/version-${pkg}-`), pkg);

process.exit(failed > 0 ? 1 : 0);
