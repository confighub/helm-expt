# hashicorp/vault@0.32.0 Production Packet

This generated packet summarizes the current support story for a hard chart. It
is a navigation surface over existing evidence, not a new support decision.

## Current Answer

| Field | Value |
| --- | --- |
| Supported base | `dev-mode` |
| Support decision | `rejected` |
| Production disposition | `production-review-ready` |
| Target scope | vanilla-kubernetes; namespace=vault; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |
| Evidence count | 9 |
| Strongest user-facing evidence | live-helm-vs-confighub-parity |
| Live summary | local:2/3 gitops:2/3 live-parity:2/3 two-cluster:3/3 |

## Why This Chart Is Hard

Security-sensitive stateful system where dev-mode is useful for parity but not a production support claim.

## What A User Can Safely Do Today

Use dev-mode only for local/demo proof. A production Vault base must cover init/unseal, storage, TLS, backup/restore, and operator runbook evidence.

## What Remains Before Broader Production Use

Keep dev-mode as the local/demo first path only; create a separate Vault production base with init/unseal, storage, TLS, backup/restore, and operator runbook evidence before making a support claim.

## Bases

| Base | User readiness | Lane summary | Target facts | Command |
| --- | --- | --- | --- | --- |
| `default` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass | none | `cub installer setup --pull packages/hashicorp/vault/0.32.0 --base default --work-dir <tmp> --non-interactive --namespace vault` |
| `dev-mode` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass | none | `cub installer setup --pull packages/hashicorp/vault/0.32.0 --base dev-mode --work-dir <tmp> --non-interactive --namespace vault` |
| `ha-raft-ui` | runtime-watch | render=pass; confighub=pass; local=blocked; gitops=watch; live-parity=watch; two-cluster=pass | topology minSchedulableNodes=3 | `cub installer setup --pull packages/hashicorp/vault/0.32.0 --base ha-raft-ui --work-dir <tmp> --non-interactive --namespace vault` |

## Quirks And Inputs

| Field | Value |
| --- | --- |
| Quirks surfaced | webhooks;extension-slots;required-values;tpl;capabilities;rbac;storage |
| User must provide | a StorageClass / storage decision; webhook/cert readiness at delivery time; mandatory chart inputs |
| ConfigHub / installer absorbs | exact rendered objects with render parity and receipts; extension slots routed to reviewed bases |
| Extension slot route | none recorded |

## Decision Details

| Decision | State |
| --- | --- |
| Image policy | `not-production-supported-because-dev-mode-is-local-only` |
| Scan policy | `not-production-supported-because-dev-mode-is-local-only` |
| Lifecycle policy | `vault-dev-mode-is-local-only` |
| Target facts | `no-unresolved-target-prerequisite-in-candidate-base` |
| Live evidence | `not-production-supported-because-vault-dev-mode-is-local-only` |

## Evidence Links

- [Production support decision](../../production-support-decisions/hashicorp-vault/support-decision.yaml)
- [Production disposition table](../../production-disposition/top20.csv)
- [Per-chart catalog](../../../recipes/hashicorp/vault/0.32.0/CATALOG.md)
- [Installer package](../../../packages/hashicorp/vault/0.32.0)
- [Helm pain report](../../../recipes/hashicorp/vault/0.32.0/helm-pain-report.yaml)
- [Public chart page](../../../site/charts/hashicorp-vault-0-32-0.html)

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
