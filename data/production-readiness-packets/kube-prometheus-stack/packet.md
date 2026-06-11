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

Lane summary: local:1/2 gitops:1/2 live-parity:1/2 two-cluster:2/2. Authoritative per-lane rows: [lane test matrix](../../../data/lane-test-matrix/summary.md).

## What is at live parity?

- two-cluster kind parity, base `default`: pass ([receipt](../../../runs/live-kind-parity/prometheus-community-kube-prometheus-stack-default/receipt.yaml))
- two-cluster kind parity, base `no-crds`: pass ([receipt](../../../runs/live-kind-parity/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml))
- local kind live e2e: pass, strict witness `observed` (3/4 pass)
- Live CRD upgrade rehearsal 85.3.3 -> 86.1.0 (API-server apply of the new CRDs over the old) ([evidence](../../../data/serious-chart-reviews/kube-prometheus-stack.csv))
- Render-level CRD upgrade delta (6/10 CRDs change; all additive) ([evidence](../../../data/serious-chart-reviews/kps-crd-upgrade-delta-85.3.3-to-86.1.0.yaml))

## What is only watch, per-target, or manual?

- no routed watchlist rows for this chart today ([watchlist](../../../data/live-e2e/cub-scout-watchlist.md))
- every supported claim is per-target: the decision above covers `cub-lk-kind-vanilla; namespace=monitoring; delivery=confighub-oci; controller=argo` and nothing broader

## What production decision is still open, and why?

Keep the target-scoped evidence fresh before using this supported scope as a production-support example.

Current work item: supported-scope-evidence - [work items](../../../data/production-support-decisions/work-items.csv).

## Claims we must not make yet

- "upgrades are proven" - the CRD upgrade evidence is a render delta plus an API-server CRD rehearsal; no full chart upgrade with running workloads has been receipted
- "webhook runtime lifecycle is proven for this chart" - the observed pattern lives on cert-manager/external-secrets; this chart's own operator webhook lifecycle has no receipt
- "production-supported beyond the named target scope" - support is a per-scope decision
- "works on any Kubernetes" - live claims are bounded to the tested capability profile

## The exact next test

a full live chart upgrade 85.3.3 -> 86.1.0 on kind with workloads running and the strict witness before and after (the committed CRD rehearsal scopes it).
