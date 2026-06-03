# Latest Top-20 Candidate Proofs

These are latest-version candidate proofs for the six top-20 charts whose
upstream Helm chart versions moved after the current supported catalog proofs.

They are **not** catalog-supported replacements yet. They are candidate
artifacts that prove the new chart version can still go through the
recipe/package/render/compare path. Promotion requires ConfigHub proof receipts,
live e2e receipts, catalog status, production disposition, and regenerated
top-100/top-500 outputs.

| Chart | Current proof | Candidate version | Variants | Object counts | Status |
| --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | `default;no-crds` | no-crds:46;default:49 | candidate-proof-generated |
| `bitnami/mongodb` | `19.0.7` | `19.0.9` | `generated-passwords;existing-secret-replicaset` | generated-passwords:8;existing-secret-replicaset:10 | candidate-proof-generated |
| `bitnami/nginx` | `24.0.2` | `24.0.4` | `http-clusterip;existing-tls-ingress` | existing-tls-ingress:6;http-clusterip:5 | candidate-proof-generated |
| `bitnami/postgresql` | `18.6.7` | `18.6.10` | `generated-passwords;existing-secret` | generated-passwords:7;existing-secret:6 | candidate-proof-generated |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | `default;no-crds` | no-crds:114;default:124 | candidate-proof-generated |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | `default;server-only-ephemeral` | server-only-ephemeral:6;default:23 | candidate-proof-generated |

## Verify

```sh
npm run top20:latest-candidates:verify
```
