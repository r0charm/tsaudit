# tsaudit

[![checks](https://github.com/r0charm/tsaudit/actions/workflows/test.yml/badge.svg)](https://github.com/r0charm/tsaudit/actions/workflows/test.yml) [![npm](https://img.shields.io/npm/v/@rocharm/tsaudit)](https://www.npmjs.com/package/@rocharm/tsaudit) [![node](https://img.shields.io/node/v/@rocharm/tsaudit)](package.json) [![license](https://img.shields.io/npm/l/@rocharm/tsaudit)](LICENSE)

Audit any TypeScript repo against strict type-safety and anti-AI-slop rules with one command, without adding config or dependencies to it.

```bash
npx @rocharm/tsaudit .
```

- **Zero setup**: nothing is installed in or written to the audited repo.
- **Two tools**: `tsc` (type errors, every project in a monorepo) and `oxlint` (strict, type-aware rules plus [anti-slop](#oxlint) rules).
- **Raw output**: each tool's own output under a `== tool ==` header, nothing reformatted.
- **Agent mode**: `--agent` prints one line per finding with a fix hint, ready to hand to a coding agent.

## Installation

Requires Node 22.13+, and the audited repo's dependencies installed (type-aware rules read its types).

Run it with `npx` as above, or install it globally:

```bash
npm i -g @rocharm/tsaudit
```

From a clone (to edit the rules): see [CONTRIBUTING.md](CONTRIBUTING.md).

## Usage

```
tsaudit [path] [--tests] [--agent] [--only <tool> [tool options]]
```

| Option | Effect |
| --- | --- |
| `path` | Directory to audit. Default `.` |
| `--agent` | Compact output for an LLM: one line per finding, with oxlint's fix hint |
| `--tests` | Also lint test code (skipped by default) |
| `--only <tool>` | Run one tool (`tsc` or `oxlint`); anything after is passed to it, e.g. `--only oxlint -f json` |
| `-h`, `--help` | Show usage |
| `-V`, `--version` | Show version |

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Clean |
| `1` | Findings |
| `2` | Setup error |

The worst code across tools wins, so it works as a CI gate:

```yaml
- run: npm ci
- run: npx @rocharm/tsaudit .
```

## Output

Default:

```
== tsc (tsconfig.json, typescript 7.0.2) ==
src/type-error.ts(2,14): error TS2322: Type 'string' is not assignable to type 'number'.
== oxlint ==

src/sloppy.ts
  13:12  error  Unexpected `any`. Specify a different type.  typescript(no-explicit-any)
  18:3   error  Promises must be awaited, add void operator to ignore.  typescript(no-floating-promises)
```

`--agent`:

```
src/sloppy.ts:13:12: error typescript(no-explicit-any): Unexpected `any`. Specify a different type. help: Use `unknown` instead, ...
```

## What it checks

### tsc

- Runs once per `tsconfig.json` under the path. Configs only extended by others are skipped; a solution file (`"files": []`) stands for the projects it references.
- Uses the project's own TypeScript if installed, else the bundled one.
- No emit, no build needed for project references.
- Skipped, with a note, when there is no `tsconfig.json`.

### oxlint

Config: [`oxlintrc.json`](oxlintrc.json). Highlights:

- **Type safety**: no `any`, no non-null `!`, no unsafe assertions/assignments/calls/returns, strict boolean expressions, exhaustive `switch`, no floating or misused promises.
- **Complexity limits**: cyclomatic complexity 15, 50 lines per function, 300 lines per file, 4 params.
- **Anti-slop** (vendored from [anti-slop](vendor/anti-slop)): patterns typical of generated code, e.g. `filter().map()` chains, accumulator copies in `reduce`, widen-then-assert, dictionaries typed `Record<string, unknown>`, Jest/Vitest module mocking, runtime `typeof` checks instead of decoding at the boundary.

Ignored by default: `node_modules`, `dist` and similar build output, agent folders (`.claude`, `.cursor`, `.codex`, ...), and test code (`*.test.ts`, `*.spec.ts`, `__tests__/`, `__mocks__/`, `test/`, `tests/`, `e2e/`). Use `--tests` to include tests.

## What it does not do

- Change the audited repo: it only reports; fixes are yours or your agent's (`--agent`).
- Read your repo's own lint config: the rules are this package's `oxlintrc.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
