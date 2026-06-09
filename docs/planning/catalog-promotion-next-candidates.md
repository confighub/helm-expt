# Catalog Promotion Next Candidates

All top-20 bespoke recipes are now explicit `catalog-supported` entries for the
declared `local-test` scope.

They are not production-supported. Production support remains unclaimed until
the target scope, scan/gate expectations, lifecycle requirements, runtime
evidence, and support policy are recorded in a final support decision.

The next promotion reviews should take proof-grade charts from the generated
default set, add user-shaped variants, and prove breadth without making the
happy path feel heavy.

The generated wave-2 plan is now the source of truth:

```text
data/catalog-promotion-wave2/candidates.yaml
data/catalog-promotion-wave2/review.csv
data/catalog-promotion-wave2/summary.md
```

Recommended next candidates:

| Chart | Why it matters | Review focus |
| --- | --- | --- |
| `traefik/traefik` | High-rank ingress controller | CRD ownership, IngressClass ownership, Service exposure, webhook/readiness policy. |
| `external-dns/external-dns` | Provider/credential-driven controller | Provider variants, credential target facts, TXT registry ownership, cluster RBAC. |
| `vmware-tanzu/velero` | Backup/restore controller | Cloud credentials, backup target facts, CRD lifecycle, restore/rollback policy. |
| `istio-official/istiod` | Service mesh control plane | Webhook lifecycle, cluster RBAC, revision labels, certificate authority boundary. |
| `kyverno/kyverno` | Policy engine | Admission webhook safety, CRD ownership, hook policy, controller HA and reports. |

Promotion review should answer:

```text
Is this the best, simplest, safest way for a Helm user to install and vary it?
Are the supported variants obvious?
Are deferred variants explicit?
Are scan/gate warnings acceptable for the declared support scope?
Can cub installer output be compared cleanly with regular Helm output?
```

Alternates if a selected chart is delayed:

```text
cloudnative-pg/cloudnative-pg
argo/argo-workflows
fluent/fluent-bit
```
