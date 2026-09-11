# Guided prompt regression report

All commands ran from `./plugin/compose-ai` with `CUB_CONFIG=./cli/config.yaml`. No cluster, ConfigHub server, registry, or credentials were contacted.

The installed `kubara-gitops-shop` stack was sandboxed as `platform`, retaining `result.json` and `rendered.yaml`, then moved as a complete directory to `platform-moved`. The resumed certification of `platform-moved/stack.yaml` exited 0. The baseline result hash is `e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6` (rendered file hash in `result.json`); `platform-moved/result.json` SHA-256 is `2cc7c7ee6ab1b7e87ce01423145f48e984353744d7b237c758f71f73edd48b2a`.

Only `spec.replicas` for the `shop-web` Deployment in `platform-moved/components/06-shop-web.yaml` changed, from 3 to 2. Candidate certification exited 0 and wrote `platform-moved/changed-result.json`; candidate rendered output was written to `platform-moved/changed.yaml`. The inspected diff contains exactly that replicas change. Candidate rendered hash is `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`; `changed-result.json` SHA-256 is `c3566fffcf3fcb8ab64e3c4054e38bb0a789456255dc1c803f026ba19e9d4774`.

Before the refusal, the complete candidate directory was copied to `incompatible`. Only the shop-web `ExternalSecret` apiVersion changed from `external-secrets.io/v1` to `external-secrets.io/v1beta1`. Refusal certification exited 1 and wrote `incompatible/refusal.json`. The expected refusal reason is `external-secrets.io/v1beta1|ExternalSecret|shop|shop-web-db: version-not-served; externalsecrets.external-secrets.io serves v1`. The refusal result rendered hash is `3a4cfee33e17a080e870f842bbdd0071eabd2aa4f2735f6d2f51941c946b0286`; `refusal.json` SHA-256 is `5ea63d1dcca49f44b73f839a220ae9ef30a911398fb84820766291563a119072`. `incompatible` was preserved unchanged after this check.

The complete incompatible directory was then copied to `recovered`; only the ExternalSecret apiVersion was restored to `external-secrets.io/v1`. The new recovery command (`cub stack certify ./plugin/compose-ai/recovered/stack.yaml --json`) exited 0 and wrote `recovered/recovery.json`, whose SHA-256 is `c3566fffcf3fcb8ab64e3c4054e38bb0a789456255dc1c803f026ba19e9d4774`. This is a new recovery check, separate from the prior successful receipt.

The unverified target prerequisites reported by certification are six pre-existing namespaces (`argocd`, `cert-manager`, `external-secrets`, `kube-system`, `shop`, `traefik`), `ClusterIssuer/letsencrypt`, and `ClusterSecretStore/platform-store`. The report makes no claims about ConfigHub creation, delivery, readiness, or application health.

## Command exit codes

The full command log, including paths and exit codes, is in [`trial-log.md`](trial-log.md).

- Initial sandbox workspace creation: 0
- Baseline certification: 0
- Baseline render: 0
- Resumed certification after move: 0
- Candidate certification: 0
- Candidate render: 0
- Render diff inspection: 1 (differences found, exactly the requested replicas change)
- Incompatible refusal certification: 1 (expected refusal)
- Recovery certification: 0
