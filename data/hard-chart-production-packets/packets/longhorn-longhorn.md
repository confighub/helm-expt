# longhorn/longhorn@1.11.2 Production Packet

This generated packet summarizes the current support story for a hard chart. It
is a navigation surface over existing evidence, not a new support decision.

## Current Answer

| Field | Value |
| --- | --- |
| Supported base | `default` |
| Support decision | `supported` |
| Production disposition | `production-review-ready` |
| Target scope | cub-lk-kind-vanilla; namespace=longhorn-system; delivery=confighub-oci; controller=argo |
| Delivery path | `confighub-oci` |
| Evidence count | 13 |
| Strongest user-facing evidence | live-helm-vs-confighub-parity |
| Live summary | local:2/2 gitops:2/2 live-parity:2/2 two-cluster:2/2 |

## Why This Chart Is Hard

Privileged storage infrastructure with CRDs, webhooks, node components, backup/restore expectations, and target-cluster assumptions.

## What A User Can Safely Do Today

Use default only inside the declared privileged storage proof scope. Backup/restore, upgrade, replica policy, UI ingress, and hardening need separate support decisions.

## What Remains Before Broader Production Use

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate backup/restore, upgrade, replica-policy, storage-class, UI-ingress, resource-hardened, or digest-pinned bases for real customer Longhorn workloads.

## Bases

| Base | User readiness | Lane summary | Target facts | Command |
| --- | --- | --- | --- | --- |
| `default` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass | none | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/longhorn-longhorn:1.11.2@sha256:a6fcbe3cb5728a096f61c52fc8a0a4034a9511b0bbfb8a9cfedf91313a3a4064 --base default --work-dir <tmp> --non-interactive --namespace longhorn-system` |
| `ui-ingress` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass | none | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/longhorn-longhorn:1.11.2@sha256:a6fcbe3cb5728a096f61c52fc8a0a4034a9511b0bbfb8a9cfedf91313a3a4064 --base ui-ingress --work-dir <tmp> --non-interactive --namespace longhorn-system` |

## Quirks And Inputs

| Field | Value |
| --- | --- |
| Quirks surfaced | required-values;generated-facts;tpl;rbac |
| User must provide | target facts at variant time; mandatory chart inputs |
| ConfigHub / installer absorbs | exact rendered objects with render parity and receipts; cluster lookups lifted into declared target facts |
| Extension slot route | none recorded |

## Decision Details

| Decision | State |
| --- | --- |
| Image policy | `mutable-image-exception-accepted-for-target-scope` |
| Scan policy | `privileged-storage-infrastructure-accepted-for-target-scope` |
| Lifecycle policy | `storage-controller-crds-webhooks-observed-for-proof-scope` |
| Target facts | `no-unresolved-target-prerequisite-in-candidate-base` |
| Live evidence | `fresh-target-evidence-passed` |

## Evidence Links

- [Production support decision](../../production-support-decisions/longhorn-longhorn/support-decision.yaml)
- [Production disposition table](../../production-disposition/top20.csv)
- [Per-chart catalog](../../../recipes/longhorn/longhorn/1.11.2/CATALOG.md)
- [Installer package](../../../packages/longhorn/longhorn/1.11.2)
- [Helm pain report](../../../recipes/longhorn/longhorn/1.11.2/helm-pain-report.yaml)
- [Public chart page](../../../site/charts/longhorn-longhorn-1-11-2.html)

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
