// oxlint, type-aware: strict TypeScript rules plus the anti-slop plugin (oxlintrc.json).
import { existsSync } from "node:fs";
import { join } from "node:path";

export const IGNORE = [
  "node_modules", "dist", "build", "out", "coverage", ".next", ".git", ".turbo", ".worktrees",
  ".agent", ".agents", ".claude", ".codex", ".continue", ".cursor", ".gemini", ".opencode", ".pi", ".roo", ".windsurf",
];
// TypeScript only: config scripts and other JavaScript are not this tool's business.
const JS = ["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"];
// Test code by convention: test and spec files, and the folders that hold tests, mocks and end-to-end suites.
const TESTS = ["**/*.test.{ts,tsx,mts,cts}", "**/*.spec.{ts,tsx,mts,cts}", ...["__tests__", "__mocks__", "test", "tests", "e2e"].map((d) => `**/${d}/**`)];

export default {
  name: "oxlint",
  commands({ root, bin, target, withTests, agent, forwarded }) {
    const tsconfig = existsSync(join(target, "tsconfig.json")) ? ["--tsconfig", join(target, "tsconfig.json")] : [];
    const ignore = [...IGNORE.map((d) => `**/${d}/**`), ...JS, ...(withTests ? [] : TESTS)].flatMap((g) => ["--ignore-pattern", g]);
    // stylish groups findings by file for a person; agent is one line per finding with its fix hint, for a model. A -f of the caller's wins.
    const format = forwarded.some((a) => a === "-f" || a.startsWith("--format")) ? [] : ["-f", agent ? "agent" : "stylish"];
    return [{
      bin: bin("oxlint", "oxlint"),
      args: ["-c", join(root, "oxlintrc.json"), "--type-aware", ...format, ...tsconfig, ...ignore, target],
      env: { OXLINT_TSGOLINT_PATH: bin("oxlint-tsgolint", "tsgolint") },
    }];
  },
  // oxlint's own codes: 0 clean, 1 findings, 2 setup error.
  status: (code) => code,
};
