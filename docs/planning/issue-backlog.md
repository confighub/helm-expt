# Issue Backlog

This document mirrors the GitHub issues that must not be lost in the planning
docs. GitHub remains the execution tracker; this file keeps reviewers aligned
with the written plan.

Last synced with planning docs: 2026-06-07.

## Rule

```text
P0 issues are gates for the scope they name.
P1 issues strengthen the proof after P0.
P2 issues preserve important design depth without blocking the first proof.
```

Issue closure should be outcome-based:

```text
Name the chart choices, variants, or lanes covered.
Commit the receipt, matrix row, generated report, or verified doc that proves
the outcome.
Add or update the verifier that fails if the evidence becomes stale.
Do not close an issue because a command, tutorial, or proposal merely exists.
```

The catalog-wide target is that every supported Helm chart default and declared
main choice becomes reproducible, ConfigHub-reviewable, live-cluster verified,
and tied to receipts. If a lane is still missing, track it as missing backlog
instead of converting the issue into a broad "verified" claim.

The original P0 proof gates are now closed and verified by the harness. The
remaining open P0 is a productization/design gate, not evidence that the current
proof corpus is broken:

```text
#76 Define Helm import path from cub helm template / cub helm install to cub installer recipes.
```

That issue matters because the repo-proven import workflow needs a clear product
path. The current command story is:

| Command | Product role |
| --- | --- |
| `cub helm template` | Fast local render and Helm baseline. |
| `cub helm install` | Fast one-shot render into ConfigHub Units. |
| `cub installer` recipe/package | Maintained catalog artifact with named bases, receipts, scans, and live evidence. |
| future `cub installer import helm` | Bridge from fast Helm command paths to maintained recipe/package candidates. |

The public proof can remain valid while #76 is open; the product story is not
complete until the bridge is resolved.

Current open issue shape:

```text
open P0: 1
open P1: 17
open P2: 7
open content/story issues: 8
open unlabelled issues: 7 (#82, #96, #97, #99, #106, #113, #114)
```

## Capability Roadmap

The active roadmap now separates existing `cub` / ConfigHub capabilities from
missing product verbs. These lanes should become GitHub issues when they move
from roadmap shape to implementation work.

Existing ConfigHub capabilities to use now:

| Lane | Existing verbs | Roadmap home |
| --- | --- | --- |
| Installer proof | `cub installer doc/setup/render/package/push/sign/verify/vet/plan/upload/inspect/list` | P0.4, P1.1 |
| Server variants | `cub variant create` | #143, #144, #145, #150 |
| Review and diff | `cub unit diff`, `cub revision data/list`, `cub unit data/tree/list` | P1.6 |
| Safe operations | `cub changeset create/list/update`, `cub unit approve/apply/destroy/cancel` | P1.7 |
| Scanning and misconfig | `cub function vet`, `cub function get/set`, `cub run ...` | P1.8 |
| Target and live facts | `cub target create/get/list`, `cub k8s collect`, `cub k8s source`, `cub unit livestate/livedata/refresh` | P1.3, P1.4 |
| GitOps adoption | `cub gitops discover/import` | #12, #151, #153 |
| Metadata model | `cub tag`, `cub attribute`, `cub filter`, `cub view`, `cub link` | #146, #149 |

Missing product verbs:

| Priority | Ask |
| --- | --- |
| P0 ask | `cub installer import helm` |
| P0 ask | `cub installer analyze` |
| P0 ask | implemented `cub installer preflight` |
| P0 ask | `cub installer compare` or `cub installer prove` |
| P1 ask | `cub installer scan` |
| P1 ask | `cub variant list/diff/promote/update` |
| P1 ask | `cub variant release` or another explicit variant-to-OCI handoff verb |
| P1 ask | `cub observe` or `cub target observe` |
| P2 ask | `cub catalog search/show/install` |

## Configuration-As-Data And Derived-Variant Issues Added 2026-06-04

Configuration-as-data work is now represented as helm-expt execution work, with
derived ConfigHub variants pulled forward instead of treated as an appendix.

| Issue | Lane | Why it matters now |
| --- | --- | --- |
| [#143](https://github.com/confighub/helm-expt/issues/143) Make `cub variant create` the explicit derived-variant substrate | Current CLI truth | Keeps docs and tutorials aligned with the current command surface. |
| [#144](https://github.com/confighub/helm-expt/issues/144) Build a derived-variant expansion wave across top-20 and wave-2 charts | Derived variants | Fixes the gap that the repo does not yet use enough derived variants. |
| [#145](https://github.com/confighub/helm-expt/issues/145) Prove promotion and environment management with derived ConfigHub variants | Promotion | Highest-value derived-variant lane inside helm-expt. |
| [#146](https://github.com/confighub/helm-expt/issues/146) Add fleet inventory and CMDB views over catalog artifacts and ConfigHub Units | Inventory | Shows the value of queryable rendered desired state. |
| [#147](https://github.com/confighub/helm-expt/issues/147) Prove fleet-scale mutation and codemod workflows over ConfigHub Units | Fleet operations | Turns rendered Units into safe bulk operations, not YAML search/replace. |
| [#148](https://github.com/confighub/helm-expt/issues/148) Add policy, compliance, and security posture reports over rendered desired state | Policy/security | Rolls scan/gate evidence into a useful posture view. |
| [#149](https://github.com/confighub/helm-expt/issues/149) Add dependency graph and impact analysis for variants and upgrades | Impact analysis | Uses upstream links, targets, and variants to answer "what changes?" |
| [#150](https://github.com/confighub/helm-expt/issues/150) Add Creator and agentic intent flow over `cub variant create` | AI/Creator UX | Keeps the human story simple while mapping to current CLI primitives. |
| [#151](https://github.com/confighub/helm-expt/issues/151) Define variant release and OCI handoff semantics | Release/GitOps | Captures release vs tag, gates, validation, and OCI publication questions. |
| [#152](https://github.com/confighub/helm-expt/issues/152) Define Promotion UI expectations for clean variant diffs | Promotion UI | Makes derived-variant review understandable to humans. |
| [#153](https://github.com/confighub/helm-expt/issues/153) Reposition GitOps tutorial around Argo/OCI and bridge-independent proof | GitOps | Keeps Tutorial 6 aligned with the Argo/OCI direction and descoped bridge paths. |

## Completed Redis Proof Gates

These P0s are complete for the Redis proof slice and should stay closed unless
the evidence regresses:

| Issue | Evidence |
| --- | --- |
| [#8](https://github.com/confighub/helm-expt/issues/8) Prove Helm equivalence for Redis and classify every ConfigHub difference | `npm run redis:compare`, Helm equivalence receipts, and namespace/secret classifications. |
| [#9](https://github.com/confighub/helm-expt/issues/9) Bind rendered-object scans and install gates to exact manifest digests | Redis scan receipts and install gates are digest-bound and verified by `npm run verify`. |
| [#10](https://github.com/confighub/helm-expt/issues/10) Create complete Redis HelmPlan and ChartDossier artifacts | `recipes/bitnami/redis/25.5.3/`, durable installer package, upload/OCI receipt. |
| [#26](https://github.com/confighub/helm-expt/issues/26) Prove simple UX is easier, safer, and correct versus Helm | `docs/demo/redis/` demo script, transcript, UX acceptance note, and ConfigHub proof transcript with real `cub installer`, `cub variant create`, and ConfigHub review verbs. |

## Current Harness Proof Slice

The scale-out harness now exists across:

```text
recipes/
packages/
runs/
data/adversarial10/
data/top500-catalog-analysis/
data/production-disposition/
```

It closes the original proof gates
[#24](https://github.com/confighub/helm-expt/issues/24),
[#25](https://github.com/confighub/helm-expt/issues/25), and
[#4](https://github.com/confighub/helm-expt/issues/4):

- 100 proof-grade recipe/package artifacts;
- 20 top-chart catalog entries with bespoke variants;
- 20/20 local kind live/e2e receipts;
- 20/20 ConfigHub proof receipt sets;
- 20 catalog-supported Helm pain reports;
- 80 generated full default proofs;
- adversarial10 and next80 tamper-detection self-tests;
- top-500 catalog analysis outputs;
- production disposition and legacy patch review outputs;
- verifier and negative golden checks through `npm run verify`.

The next harness step is not "prove that anything exists." It is to make how the
harness works easier to explain and productize. The compact explanation lives in
[How The Harness Works](../user/how-the-harness-works.md).

## Hook / Lifecycle Risk Lane

The top-500 source scan found 54 hook-using charts among 495 scanned charts. A
first-pass risk estimate classifies 42 as likely problematic, 6 as needs-review,
and 6 as probably benign/test-only. This should remain visible in planning
because hook execution is cluster-dependent and cannot be hidden inside normal
render equivalence.

Current planning home:

```text
docs/user/hook-lifecycle-strategy.md
```

Current implementation evidence:

```text
data/hook-lifecycle/summary.md
data/lifecycle-observations/cert-manager-eso/summary.md
npm run hooks:lifecycle:verify
npm run lifecycle:cert-manager-eso:verify
```

The hook queue is still inventory and required-receipt planning. The
cert-manager / External Secrets lane proves a lifecycle-observation pattern for
CRD ownership, webhook readiness, controller-populated data, and server dry-run
checks. It does not prove all hook-using charts.

Execution work still needed:

```text
Add hook risk buckets and lifecycle dispositions to top-500 catalog analysis.
Add hook/lifecycle receipt expectations for catalog-supported hook charts.
Add safe Argo/GitOps lifecycle translation proof for at least one hook-heavy chart.
```

Do not make this a P0 gate for all public-catalog work. Make it a production
support gate for hook-using charts.

## Current Promoted Chart Proofs

Rows promoted from readiness evidence into full proof slices:

| Chart | Evidence | Status |
| --- | --- | --- |
| `bitnami/redis@25.5.3` | `recipes/bitnami/redis/25.5.3/`, `packages/bitnami/redis/25.5.3/` | First complete proof slice with ConfigHub upload/OCI evidence. |
| `metrics-server/metrics-server@3.13.0` | `recipes/metrics-server/metrics-server/3.13.0/`, `packages/metrics-server/metrics-server/3.13.0/` | First promoted adversarial row: default and `external-tls-ca` variants, target Secret fact, APIService/RBAC gates, deterministic `cub installer` package/setup proof. |
| `ingress-nginx/ingress-nginx@4.15.1` | `recipes/ingress-nginx/ingress-nginx/4.15.1/`, `packages/ingress-nginx/ingress-nginx/4.15.1/` | Second promoted adversarial row: default and `admission-disabled` variants, admission webhook/hook lifecycle/RBAC gates, deterministic `cub installer` package/setup proof. |
| `jetstack/cert-manager@v1.20.2` | `recipes/jetstack/cert-manager/v1.20.2/`, `packages/jetstack/cert-manager/v1.20.2/` | Third promoted adversarial row: default and `crds-enabled` variants, CRD lifecycle/webhook/hook/RBAC gates, deterministic `cub installer` package/setup proof. |
| `external-secrets/external-secrets@2.5.0` | `recipes/external-secrets/external-secrets/2.5.0/`, `packages/external-secrets/external-secrets/2.5.0/` | Fourth promoted adversarial row: default and `no-crds` variants, capability/CRD/dependency/webhook/Secret/RBAC gates, deterministic `cub installer` package/setup proof. |
| `argo-cd/argo-cd@9.5.15` | `recipes/argo-cd/argo-cd/9.5.15/`, `packages/argo-cd/argo-cd/9.5.15/` | Fifth promoted adversarial row: default and `no-crds` variants, CRD/hook/dependency/Secret/StatefulSet/GitOps/RBAC gates, deterministic `cub installer` package/setup proof. |
| `bitnami/postgresql@18.6.7` | `recipes/bitnami/postgresql/18.6.7/`, `packages/bitnami/postgresql/18.6.7/` | Sixth promoted adversarial row: `generated-passwords` and `existing-secret` variants, generated fact/target fact/hook/dependency/StatefulSet/PVC gates, deterministic `cub installer` package/setup proof. |
| `bitnami/rabbitmq@16.0.14` | `recipes/bitnami/rabbitmq/16.0.14/`, `packages/bitnami/rabbitmq/16.0.14/` | Seventh promoted adversarial row: `generated-passwords` and `existing-secret` variants, password/Erlang-cookie generated facts, target Secret facts, dependency/StatefulSet/PVC/clustering gates, deterministic `cub installer` package/setup proof. |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `recipes/prometheus-community/kube-prometheus-stack/85.3.3/`, `packages/prometheus-community/kube-prometheus-stack/85.3.3/` | Eighth promoted adversarial row: `default` and `no-crds` variants, generated Grafana credential, 10 CRDs, umbrella dependencies, admission webhook/RBAC/extension gates, deterministic `cub installer` package/setup proof. |
| `grafana/loki@7.0.0` | `recipes/grafana/loki/7.0.0/`, `packages/grafana/loki/7.0.0/` | Ninth promoted adversarial row: blocked default render, `single-binary-filesystem` and `simple-scalable-minio` variants, storage/schema/object-store gates, dependency/RBAC/StatefulSet/PVC/extension gates, deterministic `cub installer` package/setup proof. |
| `longhorn/longhorn@1.11.2` | `recipes/longhorn/longhorn/1.11.2/`, `packages/longhorn/longhorn/1.11.2/` | Tenth promoted adversarial row: `default` and `ui-ingress` variants, 22 CRDs, pre-upgrade hook/admission-recovery/RBAC/privileged-storage/StorageClass/UI ingress gates, deterministic `cub installer` package/setup proof. |
| `bitnami/mysql@14.0.3` | `recipes/bitnami/mysql/14.0.3/`, `packages/bitnami/mysql/14.0.3/` | Eleventh promoted adversarial row: `generated-passwords` and `existing-secret` variants, root/user/replication generated facts, target Secret facts, dependency/hook/StatefulSet/PVC/extension gates, deterministic `cub installer` package/setup proof. |
| `grafana/grafana@10.5.15` | `recipes/grafana/grafana/10.5.15/`, `packages/grafana/grafana/10.5.15/` | Twelfth promoted adversarial row: chart-deprecation marker, `generated-passwords` and `existing-secret-ingress` variants, generated admin credential, target Secret facts, UI ingress, RBAC/deployment/provisioning/sidecar/Secret extension gates, deterministic `cub installer` package/setup proof. |
| `hashicorp/vault@0.32.0` | `recipes/hashicorp/vault/0.32.0/`, `packages/hashicorp/vault/0.32.0/` | Thirteenth full public-chart proof row: `default` and `ha-raft-ui` variants, TLS posture, injector webhook, StatefulSet/HA Raft, init/unseal operate policy, service exposure, RBAC/Secret/env extension gates, deterministic `cub installer` package/setup proof. |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | `recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/`, `packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/` | Fourteenth full public-chart proof row: `default` and `sync-secret-rotation` variants, SecretProviderClass CRDs, CSIDriver, Linux DaemonSet/hostPath, cluster RBAC, sync Secret/rotation/provider-health gates, deterministic `cub installer` package/setup proof. |
| `prometheus-community/prometheus@29.8.0` | `recipes/prometheus-community/prometheus/29.8.0/`, `packages/prometheus-community/prometheus/29.8.0/` | Fifteenth full public-chart proof row: `default` and `server-only-ephemeral` variants, bundled dependencies, scrape ConfigMap, server PVC/storage, component selection, cluster RBAC, remote read/write/exposure extension gates, deterministic `cub installer` package/setup proof. |
| `bitnami/mongodb@19.0.7` | `recipes/bitnami/mongodb/19.0.7/`, `packages/bitnami/mongodb/19.0.7/` | Sixteenth full public-chart proof row: `generated-passwords` and `existing-secret-replicaset` variants, generated root password, target Secret, replica-set/arbiter StatefulSets, storage/PDB/NetworkPolicy/extension gates, deterministic `cub installer` package/setup proof. |
| `bitnami/nginx@24.0.2` | `recipes/bitnami/nginx/24.0.2/`, `packages/bitnami/nginx/24.0.2/` | Seventeenth full public-chart proof row: `http-clusterip` and `existing-tls-ingress` variants, default generated TLS mitigation, target TLS Secrets, ingress, NetworkPolicy, PDB, service exposure, static-site/metrics/raw-template extension gates, deterministic `cub installer` package/setup proof. |
| `grafana/tempo@1.24.4` | `recipes/grafana/tempo/1.24.4/`, `packages/grafana/tempo/1.24.4/` | Eighteenth full public-chart proof row: deprecated chart marker, `local-persistent` and `s3-query-observability` variants, local/S3 storage, target S3 credential Secret, query ingress, ServiceMonitor capability, NetworkPolicy, StatefulSet runtime risk, deterministic `cub installer` package/setup proof. |
| `hashicorp/consul@2.0.0` | `recipes/hashicorp/consul/2.0.0/`, `packages/hashicorp/consul/2.0.0/` | Nineteenth full public-chart proof row and twentieth target chart: `default-control-plane` and `secure-mesh-existing-secrets` variants, 28 CRDs, cluster RBAC, injector webhooks, TLS/ACL/gossip target Secrets, gateway topology, UI ingress, lifecycle Job, rendered Secret, deterministic `cub installer` package/setup proof. |

## Execution Order

The review made the first implementation slice explicit:

1. [#24](https://github.com/confighub/helm-expt/issues/24) **Schema and verifier first.**
   Without this, artifacts and spreadsheets are decorative.
2. **Redis complete proof.**
   Redis now has the first complete proof slice. Keep it green while the next
   issues scale the pattern.
3. **Five-minute UX proof.**
   The first demo script exists under `docs/demo/redis/`. Keep refining the UX
   without inventing non-existent commands.
4. **Close the missing determinism/freshness gates**:
   [#29](https://github.com/confighub/helm-expt/issues/29),
   [#28](https://github.com/confighub/helm-expt/issues/28),
   [#30](https://github.com/confighub/helm-expt/issues/30), and
   [#27](https://github.com/confighub/helm-expt/issues/27).
5. [#25](https://github.com/confighub/helm-expt/issues/25) **Top-N adversarial harness.**
   The next milestone is 20 full public-chart proofs, not just a readiness
   spreadsheet. Only scale after the artifact chain and UX proof work. Use
   [known-adversarial-charts.md](../corpus/known-adversarial-charts.md) to choose
   public charts that exercise CRDs, hooks, generated facts, capabilities,
   `tpl`, raw manifests, RBAC/webhooks/APIService, and stateful behavior.

## Closed P0 Proof Gates

These issues are closed. Keep them listed because they define what the current
proof corpus must continue to satisfy.

| Issue | Area | Why it was a gate |
| --- | --- | --- |
| [#24](https://github.com/confighub/helm-expt/issues/24) Add artifact schema and receipt verifier | Proof integrity | Reviewers need machine verification that artifacts, hashes, and receipts are consistent. |
| [#4](https://github.com/confighub/helm-expt/issues/4) Emit a HelmPlan pain report for each analyzed chart | HelmPlan | Every chart needs a visible pain/mitigation report before it can be trusted. |
| [#5](https://github.com/confighub/helm-expt/issues/5) Produce EffectiveValues@sha with value precedence and provenance | Values / provenance | Helm users need to know which inputs actually produced the result. |
| [#6](https://github.com/confighub/helm-expt/issues/6) Detect dead, unknown, or ignored Helm values where possible | Values / safety | Silent ignored values are a core Helm pain point. |
| [#7](https://github.com/confighub/helm-expt/issues/7) Add value-to-rendered-field explanation for key chart settings | Explainability | The proof must show why rendered objects differ between variants. |
| [#29](https://github.com/confighub/helm-expt/issues/29) Define capability profile catalog for Helm proofs | Capability profiles | Top charts branch on Kubernetes/API capabilities; profiles must be finite and digest-bound. |
| [#28](https://github.com/confighub/helm-expt/issues/28) Define generated fact receipt schema | Generated facts | Passwords, certs, UUIDs, and time values must be generated once and bound into revisions. |
| [#30](https://github.com/confighub/helm-expt/issues/30) Add upgrade and rollback simulation receipts | Day-2 proof | First install is not enough; upgrades and rollback need digest-bound proof. |
| [#27](https://github.com/confighub/helm-expt/issues/27) Define observation freshness SLO for workerless proof | Observation | Workerless ConfigHub is credible only if freshness is explicit and machine-checkable. |
| [#25](https://github.com/confighub/helm-expt/issues/25) Build top-N adversarial chart run harness | Scale proof | 20/100/500 chart claims require a repeatable generated run, not manual analysis. |

## P1 Strong Next Proof

| Issue | Area | Why it matters |
| --- | --- | --- |
| [#11](https://github.com/confighub/helm-expt/issues/11) Add ConsequencePreview for rendered variant revisions | Review UX | Shows effects, not just YAML noise. |
| [#12](https://github.com/confighub/helm-expt/issues/12) Generate GitOpsCompatibilityReport for Argo CD and Flux paths | GitOps | Proves ConfigHub works with existing delivery tools. |
| [#13](https://github.com/confighub/helm-expt/issues/13) Add CRDCompatibilityReport for CRD-heavy charts | CRDs / day-2 | CRD-heavy charts are common and risky. |
| [#14](https://github.com/confighub/helm-expt/issues/14) Add CI/PR comment mode for chart analysis results | Workflow | Lets teams adopt analysis in existing review flows. |
| [#15](https://github.com/confighub/helm-expt/issues/15) Diagnose existing Helm release state and upgrade footguns | Migration / day-2 | Helps existing Helm users move without blind spots. |
| [#16](https://github.com/confighub/helm-expt/issues/16) Generate suggested fixes for common Helm pain findings | Remediation | Turns analysis into action. |
| [#143](https://github.com/confighub/helm-expt/issues/143) Make `cub variant create` the explicit derived-variant substrate | Derived variants / docs | Prevents docs from inventing command surface and makes the current variant CLI visible. |
| [#144](https://github.com/confighub/helm-expt/issues/144) Build a derived-variant expansion wave across top-20 and wave-2 charts | Derived variants / proof | Gives derived variants enough real use to be credible. |
| [#145](https://github.com/confighub/helm-expt/issues/145) Prove promotion and environment management with derived ConfigHub variants | Promotion | Shows reviewed base -> environment/region/customer variants without Helm rerender. |
| [#146](https://github.com/confighub/helm-expt/issues/146) Add fleet inventory and CMDB views over catalog artifacts and ConfigHub Units | Inventory | Turns queryable desired state into a concrete user-facing value lane. |
| [#147](https://github.com/confighub/helm-expt/issues/147) Prove fleet-scale mutation and codemod workflows over ConfigHub Units | Fleet operations | Demonstrates controlled bulk changes with checks, gates, and receipts. |
| [#148](https://github.com/confighub/helm-expt/issues/148) Add policy, compliance, and security posture reports over rendered desired state | Policy/security | Rolls scan/gate evidence into a catalog posture view. |
| [#149](https://github.com/confighub/helm-expt/issues/149) Add dependency graph and impact analysis for variants and upgrades | Impact analysis | Shows what base, target, or policy changes affect. |
| [#150](https://github.com/confighub/helm-expt/issues/150) Add Creator and agentic intent flow over `cub variant create` | Creator / AX | Keeps the human and agent story intent-first while mapping to current primitives. |
| [#151](https://github.com/confighub/helm-expt/issues/151) Define variant release and OCI handoff semantics | GitOps / release | Separates current CLI truth from planned release/tag/OCI behavior. |
| [#152](https://github.com/confighub/helm-expt/issues/152) Define Promotion UI expectations for clean variant diffs | Review UX | Makes inherited, overridden, upstream-added, and no-op changes legible. |
| [#153](https://github.com/confighub/helm-expt/issues/153) Reposition GitOps tutorial around Argo/OCI and bridge-independent proof | GitOps | Keeps the tutorial aligned with current Argo/OCI direction. |

## P2 Design Depth

| Issue | Area | Why it matters |
| --- | --- | --- |
| [#17](https://github.com/confighub/helm-expt/issues/17) Build shared chart dossier and HelmPlan index for curated charts | Catalog / dossiers | Enables reusable chart knowledge over time. |
| [#18](https://github.com/confighub/helm-expt/issues/18) Add full field-level governance and ownership model | Governance | Prevents tool/controller ownership conflicts. |
| [#19](https://github.com/confighub/helm-expt/issues/19) Design deep typed secret reference system | Secrets | Keeps secret handling safe without hiding needed proof. |
| [#20](https://github.com/confighub/helm-expt/issues/20) Model lifecycle contracts for migrations, readiness, and rollback | Lifecycle | Captures complex day-2 behavior. |
| [#21](https://github.com/confighub/helm-expt/issues/21) Explore typed/enriched value model beyond Helm values | Value model | May improve explainability beyond raw values. |
| [#22](https://github.com/confighub/helm-expt/issues/22) Design cross-controller consequence engine | Operations | Supports deeper multi-controller reasoning. |
| [#23](https://github.com/confighub/helm-expt/issues/23) Track pure serverless cub installer as deferred option | Deferred option | Preserves the idea without putting it on the current proof path. |

## Planning Sync Checklist

When a GitHub issue is added, closed, or reclassified:

- update this file
- update `docs/planning/current-handover.md` or the relevant archived snapshot if it changes P0 gates
- update `docs/planning/agreed-execution-plan.md` if it changes doctrine or acceptance
- update `docs/planning/independent-review-brief.md` if it changes review scope

Do not let the written plan describe a proof path that ignores open P0 gates.
When a P0 is about productization rather than current proof validity, say that
explicitly rather than letting reviewers infer the proof corpus is broken.
