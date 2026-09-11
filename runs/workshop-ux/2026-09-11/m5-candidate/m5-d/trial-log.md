# M5-D trial log

All `cub` commands below used `CUB_CONFIG=./cli/config.yaml`; writes used absolute paths.

1. `cub plugin list` from the installed CLI: exit 0. Output retained at `trial/plugin-list.txt`; stderr at `trial/plugin-list.err`. This proves the isolated CLI could load its installed plugin surface.
2. Copied the supplied handoff to `trial/source-handoff/` (preserved source), `trial/incompatible/` (trial), and `recovery/platform/` (separate recovery). No supplied files were edited.
3. Changed only `trial/incompatible/components/06-shop-web.yaml`, `external-secrets.io/v1` → `external-secrets.io/v1beta1`. Diff retained at `trial/incompatible/api-version.diff`.
4. `cub stack certify .../trial/incompatible/stack.yaml --json`: exit 1. JSON retained at `trial/incompatible/refusal.json`; stderr retained at `trial/incompatible/refusal.err`. Result is `certified: false`, with `version-not-served`; CRD serves `v1`. The rejected result still contains a rendered-file hash, but no sandbox command was attempted for the refused candidate.
5. `cub stack certify .../recovery/platform/stack.yaml --json`: exit 0. Result retained at `recovery/platform/result.json`; stderr at `recovery/platform/certify.err`. Result is `certified: true`.
6. `cub stack sandbox .../recovery/platform/stack.yaml --out .../recovery/platform/recovered.yaml`: exit 0. Stdout/stderr retained at `recovery/platform/sandbox.out` and `recovery/platform/sandbox.err`. Recovered render hash: `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`.

Key evidence locations and meaning:

- `handoff/`: original supplied inputs, preserved for comparison.
- `trial/source-handoff/`: copied original handoff, proving the source was retained.
- `trial/incompatible/`: failed API-version attempt, including refusal receipt and error stream.
- `recovery/platform/`: separate served-version recovery, certification receipt and sandbox output.
- `result.md`: user-facing interpretation, proven/unknown/not-run scope and friction.
