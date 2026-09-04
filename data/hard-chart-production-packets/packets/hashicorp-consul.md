# hashicorp/consul@2.0.0 Production Packet

This generated packet summarizes the current support story for a hard chart. It
is a navigation surface over existing evidence, not a new support decision.

## Current Answer

| Field | Value |
| --- | --- |
| Supported base | `default-control-plane` |
| Support decision | `supported` |
| Production disposition | `production-review-ready` |
| Target scope | cub-lk-kind-vanilla; namespace=consul; delivery=confighub-oci; controller=argo |
| Delivery path | `confighub-oci` |
| Evidence count | 17 |
| Strongest user-facing evidence | live-helm-vs-confighub-parity |
| Live summary | local:1/2 gitops:1/2 live-parity:1/2 two-cluster:2/2 |

## Why This Chart Is Hard

Service-mesh control plane with TLS, ACL, gateway/UI options, storage/quorum choices, webhooks, and secret prerequisites.

## What A User Can Safely Do Today

Use default-control-plane for the declared proof scope. Secure mesh, TLS, ACL, gateway, UI, production quorum, and digest-pinned paths need separate bases.

## What Remains Before Broader Production Use

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate secure-mesh, TLS, ACL, gateway, UI, external-CRD, production-quorum, hardening, and digest-pinned bases for real customer Consul workloads.

## Bases

| Base | User readiness | Lane summary | Target facts | Command |
| --- | --- | --- | --- | --- |
| `default-control-plane` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass | none | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/hashicorp-consul:2.0.0@sha256:eec0c002730d44e10c1c807aaf9f02fe8d1454e54e3ec6024956e2e079b5a2a5 --base default-control-plane --work-dir <tmp> --non-interactive --namespace consul` |
| `secure-mesh-existing-secrets` | runtime-watch | render=pass; confighub=pass; local=fail; gitops=watch; live-parity=watch; two-cluster=pass | required Secret consul/consul-ca-cert keys tls.crt; required Secret consul/consul-server-cert keys tls.crt,tls.key; required Secret consul/consul-gossip-encryption-key keys key; required Secret consul/consul-bootstrap-acl-token keys token; topology minSchedulableNodes=3 | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/hashicorp-consul:2.0.0@sha256:eec0c002730d44e10c1c807aaf9f02fe8d1454e54e3ec6024956e2e079b5a2a5 --base secure-mesh-existing-secrets --work-dir <tmp> --non-interactive --namespace consul` |

## Quirks And Inputs

| Field | Value |
| --- | --- |
| Quirks surfaced | webhooks;extension-slots;install-vs-upgrade-divergence;required-values;tpl;capabilities;rbac;storage |
| User must provide | a StorageClass / storage decision; webhook/cert readiness at delivery time; mandatory chart inputs |
| ConfigHub / installer absorbs | exact rendered objects with render parity and receipts; extension slots routed to reviewed bases; install-vs-upgrade render divergence captured per revision |
| Extension slot route | none recorded |

## Decision Details

| Decision | State |
| --- | --- |
| Image policy | `mutable-image-exception-accepted-for-target-scope` |
| Scan policy | `default-control-plane-resource-policy-accepted-for-target-scope` |
| Lifecycle policy | `lifecycle-observed-for-proof-scope` |
| Target facts | `no-unresolved-target-prerequisite-in-candidate-base` |
| Live evidence | `fresh-target-evidence-passed` |

## Evidence Links

- [Production support decision](../../production-support-decisions/hashicorp-consul/support-decision.yaml)
- [Production disposition table](../../production-disposition/top20.csv)
- [Per-chart catalog](../../../recipes/hashicorp/consul/2.0.0/CATALOG.md)
- [Installer package](../../../packages/hashicorp/consul/2.0.0)
- [Helm pain report](../../../recipes/hashicorp/consul/2.0.0/helm-pain-report.yaml)
- [Public chart page](../../../site/charts/hashicorp-consul-2-0-0.html)

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
