# Top 20 Full Proof Target

The 20-chart milestone means **20 full public-chart proofs**, not a spreadsheet
with a few deep examples.

Each chart in this target must have:

- a recipe directory under `recipes/<repo>/<chart>/<version>/`;
- a `cub install` package directory under `packages/<repo>/<chart>/<version>/`;
- source and dependency locks;
- HelmPlan and ChartDossier artifacts;
- at least one install variant, plus a second meaningful variant when the chart
  exposes one naturally;
- rendered release objects and object inventory per variant revision;
- render, Helm-equivalence, scan, install-gate, and installer-package receipts;
- deterministic `cub install package` proof;
- `cub install setup` output compared against regular Helm output;
- verifier coverage wired into `npm run verify`;
- a row in the generated proof spreadsheet that links back to receipts.

The target count includes Redis because it is the first public-chart full
proof.

## Current Status

```text
Full proofs complete: 11 / 20
Remaining full proofs: 9 / 20
```

| # | Chart | Status | Proof Focus |
| ---: | --- | --- | --- |
| 1 | `bitnami/redis@25.5.3` | complete | generated facts, existing Secret variant, StatefulSet/PVC, Helm equivalence |
| 2 | `metrics-server/metrics-server@3.13.0` | complete | target Secret fact, APIService, capability/RBAC gates |
| 3 | `ingress-nginx/ingress-nginx@4.15.1` | complete | admission webhook variant, hook lifecycle policy, cluster RBAC |
| 4 | `jetstack/cert-manager@v1.20.2` | complete | CRD-heavy control plane, webhook risk, startup lifecycle policy |
| 5 | `external-secrets/external-secrets@2.5.0` | complete | CRD-heavy controller, dependency lock, webhook Secret/cert-controller |
| 6 | `argo-cd/argo-cd@9.5.15` | complete | GitOps handoff, CRDs, raw extension slots, cluster RBAC |
| 7 | `prometheus-community/kube-prometheus-stack@85.3.3` | complete | large umbrella chart, CRDs, dependencies, webhooks, generated Grafana credential, scale |
| 8 | `bitnami/postgresql@18.6.7` | complete | generated credentials, stateful/PVC, upgrade-sensitive values |
| 9 | `bitnami/rabbitmq@16.0.14` | complete | generated credentials, Erlang cookie, stateful/PVC, clustering policy |
| 10 | `grafana/loki@7.0.0` | complete | blocked default render, required storage/schema values, MinIO object-store variant, ConfigMap normalization |
| 11 | `longhorn/longhorn@1.11.2` | complete | 22 CRDs, storage lifecycle, privileged/daemon workloads, UI ingress variant |
| 12 | `hashicorp/vault` | planned | security posture, generated/init material, stateful storage, service exposure |
| 13 | `secrets-store-csi-driver/secrets-store-csi-driver` | planned | CSI driver, DaemonSet, RBAC, Secret provider integration |
| 14 | `prometheus-community/prometheus` | planned | monitoring stack, RBAC, PVCs, scrape configuration |
| 15 | `grafana/grafana` | planned | dashboard/config extension slots, Secret handling, service exposure |
| 16 | `bitnami/mysql` | planned | generated credentials, stateful/PVC, service variants |
| 17 | `bitnami/mongodb` | planned | generated credentials, stateful/PVC, replica-set variants |
| 18 | `bitnami/nginx` | planned | simple baseline chart, service/ingress variants, low-friction UX |
| 19 | `grafana/tempo` | planned | storage backend variants, distributed components, object graph checks |
| 20 | `hashicorp/consul` | planned | stateful service mesh/control plane, RBAC, upgrade-sensitive config |

Versions for rows 11-20 are pinned when their proof run is generated. The
proof lock, not this planning table, is the source of truth for exact chart
package SHA and dependency closure.

## Promotion Order

The next work should promote charts in this order unless a blocker makes a
different row more useful:

1. `bitnami/mysql`
2. `grafana/grafana`
3. `hashicorp/vault`
4. `secrets-store-csi-driver/secrets-store-csi-driver`
5. `prometheus-community/prometheus`

That order alternates between deterministic rendered charts, generated-fact
stateful charts, one large umbrella chart, and one blocked/default chart. It
keeps the proof honest while still producing steady runnable artifacts.

## Spreadsheet Doctrine

The top-20 spreadsheet is an evidence map. It must be generated from the proof
artifacts and link to each chart's receipts. It is not the proof itself.

Every row should answer, in plain English:

```text
Can I install this safely?
What variants exist?
What did Helm render?
What did cub install produce?
What differences are intentional?
What scans/gates ran?
What remains risky or blocked?
Where are the receipts?
```
