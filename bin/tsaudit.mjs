#!/usr/bin/env node
// tsaudit [path] [--tests] [--agent] [--only <tool> [tool options]]
// Runs each tool in tools/ over a project and prints each tool's own output, untouched, under a one-line header.
// Nothing is installed in the project; its dependencies must be installed (type-aware rules read its types).
// Exit code: the worst across tools (0 clean, 1 findings, 2 setup error).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import oxlint from "../tools/oxlint.mjs";
import tsc from "../tools/tsc.mjs";

const TOOLS = [tsc, oxlint];
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = `usage: tsaudit [path] [--tests] [--agent] [--only <tool> [tool options]]\ntools: ${TOOLS.map((t) => t.name).join(", ")}`;
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
if (argv.includes("--version") || argv.includes("-V")) {
  console.log(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);
  process.exit(0);
}

const onlyAt = argv.indexOf("--only");
const only = onlyAt === -1 ? undefined : argv[onlyAt + 1];
if (onlyAt !== -1 && !TOOLS.some((t) => t.name === only)) fail(USAGE);
const rest = argv.filter((a, i) => a !== "--tests" && a !== "--agent" && (onlyAt === -1 || (i !== onlyAt && i !== onlyAt + 1)));
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const pathArg = rest.find((a) => !a.startsWith("-") && isDir(resolve(a)));
const forwarded = rest.filter((a) => a !== pathArg);
if (forwarded.length > 0 && only === undefined) fail(`tool options need --only <tool>: ${forwarded.join(" ")}\n${USAGE}`);

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) fail(`Node ${process.versions.node} is too old. Use Node 22.13 or later.`);
// Tools are found the way Node finds them: inside this checkout, or beside it where npm hoists them (npx, a global install).
const require = createRequire(import.meta.url);
const pkgDir = (name) => {
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch {
    return fail(`${name} missing: run \`npm install\` in ${root}`);
  }
};
const bin = (name, command) => {
  const dir = pkgDir(name);
  const field = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).bin;
  return join(dir, typeof field === "string" ? field : field[command]);
};

const ctx = { root, pkgDir, bin, target: resolve(pathArg ?? "."), withTests: argv.includes("--tests"), agent: argv.includes("--agent"), forwarded };
const selected = TOOLS.filter((t) => only === undefined || t.name === only);
const runs = selected.flatMap((tool) => {
  const commands = tool.commands(ctx);
  if (commands.length === 0) console.log(`== ${tool.name}: skipped (${tool.skip}) ==`);
  return commands.map((c) => ({ tool, ...c }));
});

// A run's throwaway files (a tool's own config) exist only while it runs: written just before, removed just after, and on Ctrl-C.
let live = [];
const clean = () => {
  for (const f of live) rmSync(f, { force: true });
  live = [];
};
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => (clean(), process.exit(130)));

let worst = 0;
for (const { tool, bin, args, env = {}, label, files = {} } of runs) {
  // A header only when several runs share the output, so a single run's output (e.g. -f json) stays parseable.
  if (runs.length > 1) console.log(`== ${tool.name}${label ? ` (${label})` : ""} ==`);
  live = Object.keys(files);
  for (const [file, text] of Object.entries(files)) writeFileSync(file, text);
  const run = spawnSync(bin, [...args, ...forwarded], { cwd: ctx.target, stdio: "inherit", env: { ...process.env, ...env } });
  clean();
  worst = Math.max(worst, run.status === null ? 2 : tool.status(run.status));
}
process.exit(worst);
