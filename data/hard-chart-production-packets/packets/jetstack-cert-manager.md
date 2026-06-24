# jetstack/cert-manager@v1.20.2 Production Packet

This generated packet summarizes the current support story for a hard chart. It
is a navigation surface over existing evidence, not a new support decision.

## Current Answer

| Field | Value |
| --- | --- |
| Supported base | `crds-enabled` |
| Support decision | `supported` |
| Production disposition | `blocked` |
| Target scope | cub-lk-kind-vanilla; namespace=cert-manager; delivery=confighub-oci; controller=argo |
| Delivery path | `confighub-oci` |
| Evidence count | 16 |
| Strongest user-facing evidence | live-helm-vs-confighub-parity |
| Live summary | local:2/2 gitops:2/2 live-parity:2/2 two-cluster:2/2 |

## Why This Chart Is Hard

CRD-owning certificate controller with webhook readiness, startup API checks, lifecycle ordering, and issuer/certificate follow-on configuration.

## What A User Can Safely Do Today

Use crds-enabled as the first supported base. Treat issuer/provider/hardened resource shapes as separate bases or derived variants with fresh target evidence.

## What Remains Before Broader Production Use

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate issuer, certificate, provider, or hardened resource bases for real customer certificate workloads.

## Bases

| Base | User readiness | Lane summary | Target facts | Command |
| --- | --- | --- | --- | --- |
| `crds-enabled` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass; lifecycle=pass | none | `cub installer setup --pull packages/jetstack/cert-manager/v1.20.2 --base crds-enabled --work-dir <tmp> --non-interactive --namespace cert-manager` |
| `default` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass; lifecycle=pass | required CRD challenges.acme.cert-manager.io; required CRD orders.acme.cert-manager.io; required CRD certificaterequests.cert-manager.io; required CRD certificates.cert-manager.io; required CRD clusterissuers.cert-manager.io; required CRD issuers.cert-manager.io | `cub installer setup --pull packages/jetstack/cert-manager/v1.20.2 --base default --work-dir <tmp> --non-interactive --namespace cert-manager` |

## Quirks And Inputs

| Field | Value |
| --- | --- |
| Quirks surfaced | extension-slots |
| User must provide | nothing beyond a cluster and namespace |
| ConfigHub / installer absorbs | exact rendered objects with render parity and receipts; extension slots routed to reviewed bases |
| Extension slot route | none recorded |

## Decision Details

| Decision | State |
| --- | --- |
| Image policy | `mutable-image-exception-accepted-for-target-scope` |
| Scan policy | `resource-policy-accepted-for-target-scope` |
| Lifecycle policy | `lifecycle-observed-for-proof-scope` |
| Target facts | `no-unresolved-target-prerequisite-in-candidate-base` |
| Live evidence | `fresh-target-evidence-passed` |

## Evidence Links

- [Production support decision](../../production-support-decisions/jetstack-cert-manager/support-decision.yaml)
- [Production disposition table](../../production-disposition/top20.csv)
- [Per-chart catalog](../../../recipes/jetstack/cert-manager/v1.20.2/CATALOG.md)
- [Installer package](../../../packages/jetstack/cert-manager/v1.20.2)
- [Helm pain report](../../../recipes/jetstack/cert-manager/v1.20.2/helm-pain-report.yaml)
- [Public chart page](../../../site/charts/jetstack-cert-manager-v1-20-2.html)

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
