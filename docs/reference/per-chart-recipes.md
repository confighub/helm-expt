# Per-chart recipes — recommended target surface for the TOP20

**Status:** working proposal. The third piece of the catalog model:
`catalog-doctrine.md` (the principle) → `fork-vocabulary.md` (the shared names + current state) →
**this doc** (the recommended recipe per chart) → `customization-decision-tree.md` (the user flow).
Grounded by current catalog roles, the generated data under `data/`, and the
current package bases.

## What this is
This proposal lists the recommended named configurations for each top-20
chart. It separates real operational choices from simple value changes and
says what must be tested before a configuration is added to the catalog.

## Method — recommend a fork only where the role makes it real (no padding)
| dimension | recommended when the chart… |
|---|---|
| `existing-secret` | generates/needs a secret (the F3 fix-path) |
| `ha` | has a real replicated/clustered mode |
| `ingress-tls` | has a web UI / external HTTP surface |
| `no-crds` | ships CRDs a controller/GitOps should own |
| `minimal` | has optional components worth dropping |
| `tls` | consumes BYO TLS/CA material |

Forks **compose** (`existing-secret + ingress-tls`); a composed fork is **one** base, named by its
dimensions. **Fork = shape change; fill = slot binding** (doctrine invariant) — replica count, image tag,
resource requests, persistence size, retention are *fills* on the `parameterized` base, never forks.

## Recommended recipe per chart
Legend: **default** always present · **P** = `parameterized` base recommended · **forks** named from the
shared vocabulary (`a+b` = composed single base) · **n** = standard fork count (target 1–4).

| # | chart | role | default base | P | recommended standard forks | n | notes |
|--|--|--|--|--|--|--|--|
| 1 | nginx | stateless web | `default` (http-clusterip) | ✓ | `ingress-tls` · `ingress-tls+existing-secret` (BYO cert) | 2 | TLS cert arrives as `existing-secret` |
| 2 | metrics-server | cluster metrics addon | `default` | ✓ | `tls` (serving CA) · `ha` (2× + PDB) | 2 | lean addon |
| 3 | ingress-nginx | ingress controller | `default` | ✓ | `minimal` (admission-disabled) · `ha` (replicas+PDB) | 2 | |
| 4 | cert-manager | CRD operator | **`no-crds`** (flip) | ✓ | `crds` (bundled) · `ha` | 2 | **default flips to no-crds** — GitOps owns CRDs |
| 5 | external-secrets | CRD operator | `default` | ✓ | `no-crds` · `ha` | 2 | |
| 6 | secrets-store-csi-driver | secret CSI addon | `default` | ✓ | `rotation` (sync-secret) | 1 | rotation is a chart-feature fork |
| 7 | argo-cd | GitOps platform | `default` | ✓ | `no-crds` · `ha` · `ingress-tls` (UI) · `existing-secret` (admin) | 4 | rich platform chart |
| 8 | loki | log store (stateful) | `default` (single-binary) | ✓ | `ha` (scalable+object store) · `ha+existing-secret` (store creds) | 2 | default is the lean mode |
| 9 | prometheus | monitoring | `default` | ✓ | `minimal` (server-only-ephemeral) · `ha` (replicas+persistent) · `ingress-tls` (UI) | 3 | |
| 10 | tempo | tracing (stateful) | `default` (local-persistent) | ✓ | `ha` (S3 scalable) · `ha+existing-secret` (S3 creds) | 2 | |
| 11 | redis | cache + secret | `default` | ✓ | `existing-secret` · `ha` (sentinel/cluster) | 2 | F3: default must declare required secret |
| 12 | postgresql | secret DB | `default` | ✓ | `existing-secret` · `ha` (replication) | 2 | F3 |
| 13 | mysql | secret DB | `default` | ✓ | `existing-secret` · `ha` (replication) | 2 | F3 |
| 14 | mongodb | secret DB | `default` | ✓ | `existing-secret` · `ha` (replicaset) · `existing-secret+ha` | 3 | current fork = the composed base |
| 15 | rabbitmq | queue + secret | `default` | ✓ | `existing-secret` · `ha` (cluster) | 2 | F3 |
| 16 | grafana | dashboards + secret | `default` | ✓ | `existing-secret` · `ingress-tls` (UI) · `existing-secret+ingress-tls` | 3 | current fork = the composed base |
| 17 | longhorn | block storage | `default` | ✓ | `ingress-tls` (UI) · `no-crds` · `ha` (replica count) | 3 | ships CRDs |
| 18 | vault | HA secret store | `default` | ✓ | `ha` (raft) · `ingress-tls` (UI) · `tls` (BYO TLS) | 3 | |
| 19 | consul | service mesh | `default` (control-plane) | ✓ | `ha` (servers) · `existing-secret` (gossip/mesh) · `ingress-tls` (UI) | 3 | |
| 20 | kube-prometheus-stack | monitoring suite | `default` | ✓ | `no-crds` · `minimal` (drop exporters) · `ingress-tls` (UI) · `existing-secret` (grafana admin) | 4 | umbrella chart |

## Catalog rollup
- **Today:** 40 bases (20 `default` + 20 ad-hoc forks), 0 `parameterized` (`fork-vocabulary.md`).
- **Target:** ~20 `default` + ~18 `parameterized` + **~47 standard forks ≈ ~85 bases** — roughly double, but
  **predictable**: the same fork name means the same thing on every chart.
- **Highest-leverage dimensions — build these first:** `ha` (~16 charts) and `existing-secret` (~12) are the
  broadest, `ingress-tls` (~8) next. `tls`, `crds`, `rotation` are niche (1–2 charts each).
- **Average 2.35 forks/chart** — inside the 1–4 band; only the platform/umbrella charts (argo-cd,
  kube-prometheus-stack) hit 4. No chart needs a padded fork to look complete.

## Typical fill-safe fields (the `parameterized` placeholders, not forks)
Image tag · replica count (within a mode) · resource requests/limits · persistence size · service annotations ·
chart-specific tunables (retention, log level, storage class). These bind on a **derived variant** with no
re-render. Anything that changes the rendered object *set* (enable ingress, switch to cluster mode, add/drop
CRDs) is a **fork**, not a fill — that is what preserves Helm-equivalence and digest-pinning.

## How a user reaches these (decision-tree START)
1. Pick the chart → see its **`default`** (installs to Ready, or declares its required secret fill — F3).
2. Need a change? Pick a **named fork** from this chart's row — the menu is the same vocabulary everywhere.
3. Want to make it yours? Use the **`parameterized`** base and fill the placeholder fields (the form).
4. The long tail (env / region / customer) is **derived variants** layered on the chosen base — fills only.

## Open decisions (carried from the doctrine + vocabulary)
1. **cert-manager default flips to `no-crds`** (GitOps owns CRDs); `crds` becomes the fork. (`fork-vocabulary.md` rec 4)
2. **Secret-chart defaults (F3):** redis/postgresql/mysql/mongodb/rabbitmq/grafana `default` must either declare
   the required secret fill and refuse a silently broken install through a required-secret gate **or** ship `existing-secret`
   as the recommended base — never deliver silently broken over GitOps.
3. **Per-chart fill-set:** the exact "fill-safe (non-shape) fields" list per chart needs author confirmation;
   the typical set above is the proposed starting point.

## Sources
`catalog-doctrine.md`, `fork-vocabulary.md`, generated status/outcome data, and
current package bases.
