# prometheus-community/kube-prometheus-stack Production-Readiness Packet

Generated. Do not edit by hand. This packet answers the reviewer questions
in one place and links the generated evidence; it makes no new claims.
Companion navigation packet: [hard-chart packet](../../../data/hard-chart-production-packets/packets/prometheus-community-kube-prometheus-stack.md).

## Why this chart matters

CRDs, admission webhooks with hook-driven cert patching, cluster RBAC, generated facts, large fanout, dependency-locked subcharts, and real image/security surface in one install.

## What should a serious user try first?

Base `default` - support decision `supported`, disposition `production-review-ready`, bounded to target scope: cub-lk-kind-vanilla; namespace=monitoring; delivery=confighub-oci; controller=argo.

Support decision evidence: `fresh-target-evidence-passed` ([decision](../../../data/production-support-decisions/prometheus-community-kube-prometheus-stack/support-decision.yaml)).

## Quirks

hooks;crds;generated-secrets;existing-secret;webhooks;extension-slots;install-vs-upgrade-divergence;required-values;lookup;generated-facts;tpl;capabilities;rbac;storage

You provide: an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; target facts at variant time; mandatory chart inputs. Absorbed for you: exact rendered objects with render parity and receipts; generated Secrets separated out of the published artifact; CRD handling split into explicit bases; hooks classified and routed (not silently executed); extension slots routed to reviewed bases; install-vs-upgrade render divergence captured per revision; cluster lookups lifted into declared target facts.

Hook disposition: `observed` (post-install, post-upgrade, pre-install, pre-upgrade; dependency source: chart-own) - [hook dispositions](../../../data/hook-disposition/summary.md).

## What is at render parity?

Current lane status is derived from committed receipts and generated matrix rows. Authoritative per-lane rows: [outcome coverage](../../../data/outcome-coverage/summary.md).

## What is at live parity?

- no matching-version two-cluster kind row is used for prometheus-community/kube-prometheus-stack@85.3.3; 2 row(s) exist for other chart versions and are deliberately excluded
- local kind live e2e: pass, strict witness `observed` (3/4 pass)
- Live CRD upgrade rehearsal 85.3.3 -> 86.1.0 (API-server apply of the new CRDs over the old) ([evidence](../../../data/serious-chart-reviews/kube-prometheus-stack.csv))
- Render-level CRD upgrade delta (6/10 CRDs change; all additive) ([evidence](../../../data/serious-chart-reviews/kps-crd-upgrade-delta-85.3.3-to-86.1.0.yaml))
- Regular Helm workload upgrade rehearsal 85.3.3 -> 86.1.0 (install, workloads Ready, upgrade, workloads Ready) ([evidence](../../../runs/serious-chart-reviews/kube-prometheus-stack/workload-upgrade-live/latest/receipt.yaml))
- No-CRDs two-cluster live parity with explicit CRD and admission Secret target facts staged ([evidence](../../../runs/live-kind-parity/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml))
- No-CRDs ConfigHub OCI/Argo live parity with the same target facts staged ([evidence](../../../runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml))

## What is only watch, per-target, or manual?

- no routed watchlist rows for this chart today ([watchlist](../../../data/live-e2e/cub-scout-watchlist.md))
- every supported claim is per-target: the decision above covers `cub-lk-kind-vanilla; namespace=monitoring; delivery=confighub-oci; controller=argo` and nothing broader

## What production support work remains?

The target-scoped support decision is `supported`. Keep the target-scoped evidence fresh before using this supported scope as a production-support example.

Current work item: supported-scope-evidence - [work items](../../../data/production-support-decisions/work-items.csv).

## Claims we must not make yet

- "ConfigHub upgrades are proven" - the workload-upgrade receipt exercises regular Helm on one kind profile, not ConfigHub upgrade orchestration
- "all upgrades are proven" - no rollback, soak, private overlay, no-crds, or production target upgrade has been receipted
- "webhook runtime lifecycle is proven for this chart" - the observed pattern lives on cert-manager/external-secrets; this chart's own operator webhook lifecycle has no receipt
- "no-crds is production-supported" - it has live target-fact proof, but still needs a target-scoped production support decision
- "production-supported beyond the named target scope" - support is a per-scope decision
- "works on any Kubernetes" - live claims are bounded to the tested capability profile

## The exact next test

a ConfigHub-managed upgrade or a target-scoped no-crds production-support decision that applies the proven target-fact OCI path to the chosen production target.
