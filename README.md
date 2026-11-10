# tsaudit

[![version](https://img.shields.io/badge/version-0.5.0-blue)](CHANGELOG.md) [![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Checks a TypeScript repo against strict coding standards and AI-slop rules, without installing anything in it. It runs each tool and prints the tool's own output, nothing else.

## Run it

In any TypeScript repo whose dependencies are installed (the type-aware rules read its types), with Node 22.13 or later:

```
npx @rocharm/tsaudit .
```

Or install it once with `npm i -g @rocharm/tsaudit`, then `tsaudit .`. To run a checkout instead: `git clone https://github.com/r0charm/tsaudit.git && cd tsaudit && npm install && npm link`.

- Nothing is installed in the audited repo.
- Tools, in order, each under a `== tool ==` header:
  - `tsc`: the compiler's type errors, once per project: every `tsconfig.json` under the path, except a base the others extend; a solution file (`"files": []`) stands for the projects it references. Each uses the nearest TypeScript the project installs, else the pinned one, and writes no build output (emit off; references are checked from source, no build needed). Its throwaway config sits next to the project's tsconfig, hidden, for that run only, so everything tsc resolves from the config's folder (the default include, `${configDir}`, `types`, `typeRoots`) holds as it does for the project. Says it was skipped when there is no `tsconfig.json`.
  - `oxlint`: strict TypeScript rules plus the anti-slop rules (`oxlintrc.json`), grouped by file (oxlint's `stylish`).
- `--agent`: output for a model to act on: oxlint one line per finding with its fix hint (`file:line:column: error rule: message help: ...`), tsc one line per error. Pass `-f` with `--only oxlint` for any other oxlint format.
- One tool, with its own options: `tsaudit . --only oxlint -f json`.
- Exit code: the worst across tools, 0 clean, 1 findings, 2 setup error.
- oxlint skips test code (`*.test.ts`, `*.spec.ts`, and `__tests__/`, `__mocks__/`, `test/`, `tests/`, `e2e/` folders; add `--tests` to lint them), agent folders (`.claude`, `.cursor`, `.codex`...), `node_modules`, `dist` and similar.

## Versions

Each release is a `vX.Y.Z` tag on `main`. Minor can add findings (a rule on, a tool added, a tool version bump), patch only removes wrong ones, major breaks a flag, an exit code or the output format.

To release: bump `version` in `package.json` and in the README badge (the canary fails if they differ), merge, then `git tag vX.Y.Z && git push origin vX.Y.Z`.

## Add a tool

1. Add it to `package.json` at an exact version, and to the Dependabot group.
2. Write `tools/<name>.mjs`: `name`, `commands(ctx)` returning a list of `{ bin, args, env?, label?, files? }` (empty when it does not apply; `files` maps a path to its text, written just before the run and removed after), `skip` saying why in that case, and `status(code)` mapping its exit code to 0, 1 or 2.
3. Register it in `TOOLS` in `bin/tsaudit.mjs`.
4. Give the fixture something it must flag, and check it in `fixture/test.mjs`.
