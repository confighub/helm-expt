# grafana/loki@7.0.0 Production Packet

This generated packet summarizes the current support story for a hard chart. It
is a navigation surface over existing evidence, not a new support decision.

## Current Answer

| Field | Value |
| --- | --- |
| Supported base | `single-binary-filesystem` |
| Support decision | `supported` |
| Production disposition | `production-review-ready` |
| Target scope | cub-lk-kind-vanilla; namespace=loki; delivery=confighub-oci; controller=argo |
| Delivery path | `confighub-oci` |
| Evidence count | 14 |
| Strongest user-facing evidence | live-helm-vs-confighub-parity |
| Live summary | local:2/2 gitops:2/2 live-parity:2/2 two-cluster:2/2 |

## Why This Chart Is Hard

Stateful logging system with CRDs, storage mode choices, retention/backups, object-store decisions, and security trade-offs.

## What A User Can Safely Do Today

Use single-binary-filesystem for the declared local proof scope. Object-store, retention, backup, restore, tenant, and hardened profiles need separate bases.

## What Remains Before Broader Production Use

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate object-store, retention, backup, restore, tenant, hardening, and digest-pinned bases for real customer Loki workloads.

## Bases

| Base | User readiness | Lane summary | Target facts | Command |
| --- | --- | --- | --- | --- |
| `single-binary-filesystem` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass | none | `cub installer setup --pull packages/grafana/loki/7.0.0 --base single-binary-filesystem --work-dir <tmp> --non-interactive --namespace loki` |
| `simple-scalable-minio` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass | none | `cub installer setup --pull packages/grafana/loki/7.0.0 --base simple-scalable-minio --work-dir <tmp> --non-interactive --namespace loki` |

## Quirks And Inputs

| Field | Value |
| --- | --- |
| Quirks surfaced | crds;generated-secrets;webhooks;extension-slots;required-values;lookup;generated-facts;tpl;capabilities;rbac;storage |
| User must provide | a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; target facts at variant time; mandatory chart inputs |
| ConfigHub / installer absorbs | exact rendered objects with render parity and receipts; generated Secrets separated out of the published artifact; CRD handling split into explicit bases; extension slots routed to reviewed bases; cluster lookups lifted into declared target facts |
| Extension slot route | none recorded |

## Decision Details

| Decision | State |
| --- | --- |
| Image policy | `mutable-image-exception-accepted-for-target-scope` |
| Scan policy | `single-binary-resource-security-accepted-for-target-scope` |
| Lifecycle policy | `lifecycle-observed-for-proof-scope` |
| Target facts | `no-unresolved-target-prerequisite-in-candidate-base` |
| Live evidence | `fresh-target-evidence-passed` |

## Evidence Links

- [Production support decision](../../production-support-decisions/grafana-loki/support-decision.yaml)
- [Production disposition table](../../production-disposition/top20.csv)
- [Per-chart catalog](../../../recipes/grafana/loki/7.0.0/CATALOG.md)
- [Installer package](../../../packages/grafana/loki/7.0.0)
- [Helm pain report](../../../recipes/grafana/loki/7.0.0/helm-pain-report.yaml)
- [Public chart page](../../../site/charts/grafana-loki-7-0-0.html)

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
