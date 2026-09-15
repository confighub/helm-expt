# Trial log

Working directory: `$TRIAL`
CLI configuration for every `cub` command: `CUB_CONFIG=$TRIAL/cli/config.yaml`
No cluster, credentials, ConfigHub, registry, or live health checks were used.

| Command | Exit | Outputs / evidence |
|---|---:|---|
| `cp -R platform-moved incompatible` | 0 | Created `$TRIAL/incompatible` |
| `cp -R incompatible recovered` | 0 | Created `$TRIAL/recovered` |
| Edit `incompatible/components/06-shop-web.yaml`: `external-secrets.io/v1` → `external-secrets.io/v1beta1` | 0 | One-line API version diff retained in incompatible copy |
| `CUB_CONFIG=... cub stack certify ./incompatible/stack.yaml --json > ./incompatible/refusal.json` | 1 | `$TRIAL/incompatible/refusal.json`; `certified: false`; `version-not-served`, bundled CRD serves `v1` |
| Restore recovered copy's one API version to `external-secrets.io/v1` | 0 | Recovery edit retained in `$TRIAL/recovered/components/06-shop-web.yaml` |
| `CUB_CONFIG=... cub stack certify ./recovered/stack.yaml --json > ./recovered/recovery-result.json` | 0 | `$TRIAL/recovered/recovery-result.json`; `certified: true`, 184 objects |
| `CUB_CONFIG=... cub stack sandbox ./recovered/stack.yaml --out ./recovered/recovered.yaml` | 0 | `$TRIAL/recovered/recovered.yaml`; 184 objects |
| `sha256sum platform-moved/rendered.yaml platform-moved/changed.yaml recovered/recovered.yaml` | 0 | Baseline `e9d86c...a4a6`; changed/recovered `d99fcb...70c3` |

The refusal is not hidden: the incompatible source and JSON remain available. Certification is a bundled-CRD check, not target discovery. Namespace existence, ClusterIssuer, ClusterSecretStore, admission readiness, GitOps sync, scheduling, and application health remain unverified.
