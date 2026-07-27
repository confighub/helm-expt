# prometheus-community/kube-prometheus-stack@85.3.3 Production Packet

This generated packet summarizes the current support story for a hard chart. It
is a navigation surface over existing evidence, not a new support decision.

## Current Answer

| Field | Value |
| --- | --- |
| Supported base | `default` |
| Support decision | `supported` |
| Production disposition | `production-review-ready` |
| Target scope | cub-lk-kind-vanilla; namespace=monitoring; delivery=confighub-oci; controller=argo |
| Delivery path | `confighub-oci` |
| Evidence count | 16 |
| Strongest user-facing evidence | live-helm-vs-confighub-parity |
| Live summary | local:2/2 gitops:2/2 live-parity:2/2 two-cluster:0/2 |

## Why This Chart Is Hard

Large monitoring stack with CRDs, admission webhooks, hooks, RBAC, generated facts, extension slots, high fanout, and upgrade-sensitive operator behavior.

## What A User Can Safely Do Today

Use the default base only inside the declared support scope while keeping the target-scoped evidence fresh. Treat no-crds and hardened monitoring profiles as separate support decisions.

## What Remains Before Broader Production Use

Keep the target-scoped evidence fresh before using this supported scope as a production-support example.

## Bases

| Base | User readiness | Lane summary | Target facts | Command |
| --- | --- | --- | --- | --- |
| `default` | render-only | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=missing | required Secret monitoring/kube-prometheus-stack-admission keys cert,key | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-kube-prometheus-stack:85.3.3 --base default --work-dir <tmp> --non-interactive --namespace monitoring` |
| `no-crds` | render-only | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=missing | required Secret monitoring/kube-prometheus-stack-admission keys cert,key; required CRD alertmanagerconfigs.monitoring.coreos.com; required CRD alertmanagers.monitoring.coreos.com; required CRD podmonitors.monitoring.coreos.com; required CRD probes.monitoring.coreos.com; required CRD prometheusagents.monitoring.coreos.com; required CRD prometheuses.monitoring.coreos.com; required CRD prometheusrules.monitoring.coreos.com; required CRD scrapeconfigs.monitoring.coreos.com; required CRD servicemonitors.monitoring.coreos.com; required CRD thanosrulers.monitoring.coreos.com | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-kube-prometheus-stack:85.3.3 --base no-crds --work-dir <tmp> --non-interactive --namespace monitoring` |

## Quirks And Inputs

| Field | Value |
| --- | --- |
| Quirks surfaced | hooks;crds;generated-secrets;existing-secret;webhooks;extension-slots;install-vs-upgrade-divergence;required-values;lookup;generated-facts;tpl;capabilities;rbac;storage |
| User must provide | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; target facts at variant time; mandatory chart inputs |
| ConfigHub / installer absorbs | exact rendered objects with render parity and receipts; generated Secrets separated out of the published artifact; CRD handling split into explicit bases; hooks classified and routed (not silently executed); extension slots routed to reviewed bases; install-vs-upgrade render divergence captured per revision; cluster lookups lifted into declared target facts |
| Extension slot route | none recorded |

## Decision Details

| Decision | State |
| --- | --- |
| Image policy | `mutable-image-exception-accepted-for-target-scope` |
| Scan policy | `security-accepted-for-target-scope` |
| Lifecycle policy | `lifecycle-observed-for-proof-scope` |
| Target facts | `no-unresolved-target-prerequisite-in-candidate-base` |
| Live evidence | `fresh-target-evidence-passed` |

## Evidence Links

- [Production support decision](../../production-support-decisions/prometheus-community-kube-prometheus-stack/support-decision.yaml)
- [Production disposition table](../../production-disposition/top20.csv)
- [Per-chart catalog](../../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md)
- [Installer package](../../../packages/prometheus-community/kube-prometheus-stack/85.3.3)
- [Helm pain report](../../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/helm-pain-report.yaml)
- [Public chart page](../../../site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html)

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
