# Catalog Promotion Next Candidates

All top-20 bespoke recipes are now explicit `catalog-supported` entries for the
declared `local-test` scope.

They are not production-supported. Production remains blocked until the
scan, gate, and operating-policy findings have dispositions.

The next promotion reviews should take proof-grade charts from the generated
default set, add user-shaped variants, and prove breadth without making the
happy path feel heavy.

Recommended next candidates:

| Chart | Why it matters | Review focus |
| --- | --- | --- |
| `cloudnative-pg/cloudnative-pg` | Operator-backed database | CRDs, webhook lifecycle, backups, and production blockers. |
| `bitnami/opensearch` | Stateful search workload | Storage, cluster shape, security defaults, and upgrade risk. |
| `kyverno/kyverno` | Policy engine | CRDs, admission webhooks, generated policies, and safe rollout. |
| `istio/istiod` | Service mesh control plane | CRDs, webhooks, APIService-like readiness, and cluster RBAC. |
| `minio-operator/operator` | Storage operator | CRDs, tenant handoff, object storage assumptions, and target facts. |

Promotion review should answer:

```text
Is this the best, simplest, safest way for a Helm user to install and vary it?
Are the supported variants obvious?
Are deferred variants explicit?
Are scan/gate warnings acceptable for the declared support scope?
Can cub install output be compared cleanly with regular Helm output?
```
