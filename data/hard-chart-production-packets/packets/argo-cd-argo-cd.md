# argo-cd/argo-cd@9.5.15 Production Packet

This generated packet summarizes the current support story for a hard chart. It
is a navigation surface over existing evidence, not a new support decision.

## Current Answer

| Field | Value |
| --- | --- |
| Supported base | `default` |
| Support decision | `supported` |
| Production disposition | `production-review-ready` |
| Target scope | cub-lk-kind-vanilla; namespace=argocd; delivery=confighub-oci; controller=argo |
| Delivery path | `confighub-oci` |
| Evidence count | 16 |
| Strongest user-facing evidence | live-helm-vs-confighub-parity |
| Live summary | local:1/2 gitops:1/2 live-parity:1/2 two-cluster:2/2 |

## Why This Chart Is Hard

GitOps control plane with CRDs, repository credentials, optional self-management, SSO, backup/restore, and bootstrap-order concerns.

## What A User Can Safely Do Today

Use default for the declared proof scope. Hardened, self-managed, repository-credential, SSO, or backup/restore paths need separate support decisions.

## What Remains Before Broader Production Use

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate hardened, self-managed, repository-credential, SSO, or backup/restore bases for real customer GitOps control planes.

## Bases

| Base | User readiness | Lane summary | Target facts | Command |
| --- | --- | --- | --- | --- |
| `default` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass | required Secret argocd/argocd-redis keys auth | `cub installer setup --pull packages/argo-cd/argo-cd/9.5.15 --base default --work-dir <tmp> --non-interactive --namespace argocd` |
| `no-crds` | runtime-watch | render=pass; confighub=pass; local=blocked; gitops=watch; live-parity=watch; two-cluster=pass | required Secret argocd/argocd-redis keys auth; required CRD applications.argoproj.io; required CRD applicationsets.argoproj.io; required CRD appprojects.argoproj.io | `cub installer setup --pull packages/argo-cd/argo-cd/9.5.15 --base no-crds --work-dir <tmp> --non-interactive --namespace argocd` |

## Quirks And Inputs

| Field | Value |
| --- | --- |
| Quirks surfaced | crds;existing-secret;extension-slots |
| User must provide | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) |
| ConfigHub / installer absorbs | exact rendered objects with render parity and receipts; CRD handling split into explicit bases; extension slots routed to reviewed bases |
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

- [Production support decision](../../production-support-decisions/argo-cd-argo-cd/support-decision.yaml)
- [Production disposition table](../../production-disposition/top20.csv)
- [Per-chart catalog](../../../recipes/argo-cd/argo-cd/9.5.15/CATALOG.md)
- [Installer package](../../../packages/argo-cd/argo-cd/9.5.15)
- [Helm pain report](../../../recipes/argo-cd/argo-cd/9.5.15/helm-pain-report.yaml)
- [Public chart page](../../../site/charts/argo-cd-argo-cd-9-5-15.html)

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
