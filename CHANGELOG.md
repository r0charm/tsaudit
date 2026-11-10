# Changelog

Each release is a `vX.Y.Z` git tag on `main`. Versions follow [SemVer](https://semver.org), read for a tool whose output is findings:

- **Major**: a change that breaks a caller: a CLI flag, an exit code, or the output contract (`--agent`'s line format, the `== tool ==` headers).
- **Minor**: a change that can add findings: a rule turned on, a tool added, a tool or TypeScript version bump.
- **Patch**: a change that only removes wrong output: a fix, a false positive gone, a rule turned off.

Entries start once the tool has users. Until then the tags and the git log are the record.
