# Trial log

Execution root: `.`
Shell workdir: `./plugin`
Guide discovery: `curl -fsS http://127.0.0.1:8767/site/index.html` succeeded (HTTP body retained only as the command observation; URL is the evidence location).

All cub invocations used `CUB_CONFIG=./cli/config.yaml`.

1. `cp -R .../handoff .../platform` — exit 0.
2. `CUB_CONFIG=... /.../plugin/bin/cub-stack certify .../platform/stack.yaml --json > .../platform/baseline-certify.json` — exit 0; certified true, 184 objects. Output: `platform/baseline-certify.json`.
3. `CUB_CONFIG=... /.../plugin/bin/cub-stack sandbox .../platform/stack.yaml --out .../platform/baseline-rendered.yaml` — exit 0; rendered 184 objects. Output: `platform/baseline-rendered.yaml`.
4. `git diff --no-index .../platform/rendered.yaml .../platform/changed.yaml` — exit 1, expected; the only diff is shop-web Deployment `spec.replicas: 3` to `2`. Evidence: `platform/rendered.yaml`, `platform/changed.yaml`.
5. `cp -R .../platform .../incompatible`, then changed only `platform/incompatible/components/06-shop-web.yaml` ExternalSecret `apiVersion` from `external-secrets.io/v1` to `external-secrets.io/v1beta1` — copy/change exit 0.
6. `CUB_CONFIG=... /.../plugin/bin/cub-stack certify .../platform/stack.yaml --json > .../platform/changed-result.json` — exit 0; certified true. Output: `platform/changed-result.json`.
7. `CUB_CONFIG=... /.../plugin/bin/cub-stack sandbox .../platform/stack.yaml --out .../platform/changed.yaml` — exit 0. Output: `platform/changed.yaml`.
8. `CUB_CONFIG=... /.../plugin/bin/cub-stack certify .../incompatible/stack.yaml --json > .../incompatible/refusal.json` — exit 1, preserved refusal; stderr was empty and JSON contains `certified: false` with `version-not-served`: `externalsecrets.external-secrets.io serves v1`. Output: `incompatible/refusal.json` and `incompatible/refusal.stderr`.

Hashes:

- baseline rendered: `e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6` (`platform/rendered.yaml`)
- changed rendered: `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3` (`platform/changed.yaml`)
- baseline result: `2cc7c7ee6ab1b7e87ce01423145f48e984353744d7b237c758f71f73edd48b2a` (`platform/result.json`)
- changed result: `c3566fffcf3fcb8ab64e3c4054e38bb0a789456255dc1c803f026ba19e9d4774` (`platform/changed-result.json`)
- refusal result: `5ea63d1dcca49f44b73f839a220ae9ef30a911398fb84820766291563a119072` (`incompatible/refusal.json`)
