# Guided prompt regression trial log

- Working directory: `./plugin/compose-ai`
- All `cub` commands used `CUB_CONFIG=./cli/config.yaml`.
- `cub stack sandbox kubara-gitops-shop --workspace .../platform`: exit 0; created `platform/` with `stack.yaml`, `components/`, `rendered.yaml`, and `result.json`.
- Move `platform` to `platform-moved`: exit 0; path `./plugin/compose-ai/platform-moved`.
- `cub stack certify .../platform-moved/stack.yaml --json > .../platform-moved/changed-result.json`: exit 0; output path `./plugin/compose-ai/platform-moved/changed-result.json`.
- `cub stack sandbox .../platform-moved/stack.yaml --out .../platform-moved/changed.yaml`: exit 0; output path `./plugin/compose-ai/platform-moved/changed.yaml`.
- `git diff --no-index .../platform-moved/rendered.yaml .../platform-moved/changed.yaml`: exit 1 (expected difference); one change at `shop-web` Deployment `spec.replicas`, `3` to `2`.
- Copy to incompatible: exit 0; path `./plugin/compose-ai/incompatible`.
- `cub stack certify .../incompatible/stack.yaml --json > .../incompatible/refusal.json`: exit 1 (expected refusal); reason `external-secrets.io/v1beta1|ExternalSecret|shop|shop-web-db: version-not-served; externalsecrets.external-secrets.io serves v1`.
- Copy incompatible to recovered: exit 0; path `./plugin/compose-ai/recovered`.
- `cub stack certify .../recovered/stack.yaml --json > .../recovered/recovery.json`: exit 0; this is the new recovery certification command and exit code.

Receipt SHA-256 hashes:

- `platform-moved/result.json`: `2cc7c7ee6ab1b7e87ce01423145f48e984353744d7b237c758f71f73edd48b2a`
- `platform-moved/changed-result.json`: `c3566fffcf3fcb8ab64e3c4054e38bb0a789456255dc1c803f026ba19e9d4774`
- `incompatible/refusal.json`: `5ea63d1dcca49f44b73f839a220ae9ef30a911398fb84820766291563a119072`
- `recovered/recovery.json`: `c3566fffcf3fcb8ab64e3c4054e38bb0a789456255dc1c803f026ba19e9d4774`

Rendered result hashes: baseline `e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6`; changed and recovered `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`.
