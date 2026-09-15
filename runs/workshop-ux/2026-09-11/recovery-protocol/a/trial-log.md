# Trial log

All commands were run with working directory `$TRIAL`. Every `cub` command used `CUB_CONFIG=$TRIAL/cli/config.yaml`.

| Command | Exit | Evidence/output |
|---|---:|---|
| `cp -a platform-moved failed-api-version` | 0 | `failed-api-version/` |
| `cp -a platform-moved recovered-workspace` | 0 | `recovered-workspace/` |
| `CUB_CONFIG=$TRIAL/cli/config.yaml cub stack certify ./failed-api-version/stack.yaml --json > ./failed-api-version/refusal.json` | 1 | `failed-api-version/refusal.json`; `certified: false`; version-not-served detail |
| `CUB_CONFIG=$TRIAL/cli/config.yaml cub stack certify ./recovered-workspace/stack.yaml --json > ./recovered-workspace/recovery-result.json` | 0 | `recovered-workspace/recovery-result.json`; `certified: true` |
| `sha256sum platform-moved/rendered.yaml failed-api-version/rendered.yaml recovered-workspace/rendered.yaml` | 0 | all retained rendered files hash to `e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6` |
| `git diff --no-index platform-moved/components/06-shop-web.yaml failed-api-version/components/06-shop-web.yaml` | 1 | one apiVersion change: `v1` to `v1beta1` |
| `git diff --no-index platform-moved/components/06-shop-web.yaml recovered-workspace/components/06-shop-web.yaml` | 0 | recovery copy matches baseline |

Evidence paths retained: baseline `platform-moved/result.json` and `platform-moved/rendered.yaml`; failed `failed-api-version/refusal.json`; recovered `recovered-workspace/recovery-result.json`. No cluster, credentials, ConfigHub, registry, or live-health commands were run. The public site release/deployment timing remained uncertain: release `15d0774b388d3e436971005649d98b4010a20304` was queued and the prior `ae083116d` deployment may have been visible.
