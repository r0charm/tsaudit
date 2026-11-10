# Contributing

```bash
git clone https://github.com/r0charm/tsaudit.git
cd tsaudit
npm install
npm test
npm link   # optional: use your checkout as `tsaudit`
```

## Add a tool

1. Add it to `package.json` at an exact version, and to the Dependabot group.
2. Write `tools/<name>.mjs` exporting:
   - `name`
   - `commands(ctx)`: list of `{ bin, args, env?, label?, files? }`, empty when the tool does not apply. `files` maps a path to its text, written just before the run and removed after.
   - `skip`: why it was skipped, when `commands` is empty.
   - `status(code)`: maps the tool's exit code to 0, 1 or 2.
3. Register it in `TOOLS` in `bin/tsaudit.mjs`.
4. Give the fixture something it must flag, and check it in `fixture/test.mjs`.

## Releases

See [CHANGELOG.md](CHANGELOG.md) for the versioning policy.
