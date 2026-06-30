# Shared fork vocabulary + current→canonical mapping

**Status:** working reference. Built from the actual bases of all 20 top-20
catalog charts, not invented.

## The problem, in one table
Every chart today has exactly **2 bases** (a `default:true` + one fork), but the names are ad-hoc.
The same *dimension* is named many ways, so a user can't predict the menu:

- **default role** is named **6 ways**: `default` (×11), `static-passwords` (×5 secret charts), `single-binary-filesystem` (loki), `http-clusterip` (nginx), `local-persistent` (tempo), `default-control-plane` (consul).
- **existing-secret** is named **5 ways** across 7 charts: `reuse-existing-secret`, `existing-secret`, `existing-secret-replicaset`, `existing-secret-ingress`, `secure-mesh-existing-secrets`.
- **ingress** is named 3 ways: `ui-ingress`, `existing-tls-ingress`, `…-ingress`.
- **no-crds** vs **crds**: 3 charts ship `no-crds`, cert-manager ships the inverse `crds-enabled`.

## Canonical fork vocabulary (proposed)
| dimension | meaning | composes? |
|---|---|---|
| `default` | honest OOTB base (role = `default:true`); zero placeholders where possible | — |
| `parameterized` | same shape as default; fill-safe fields exposed as placeholders | — |
| `existing-secret` | BYO secret instead of generated (the F3 fix-path) | yes |
| `ingress-tls` | externally exposed via ingress (+ TLS) | yes |
| `ha` | high-availability / scalable deployment mode | yes |
| `no-crds` | CRDs owned externally (GitOps/controller) | yes |
| `minimal` | lean: drop optional components / persistence | yes |
| `tls` | BYO TLS material / CA | yes |

Forks **compose** (e.g. `existing-secret + ingress-tls`). The catalog should name a fork by its
canonical dimension(s), not a bespoke string.

## Current → canonical mapping (all 20)
| chart | default base (current) | fork (current) | → canonical |
|---|---|---|---|
| redis | `default` | `reuse-existing-secret` | existing-secret |
| postgresql | `static-passwords` | `existing-secret` | existing-secret |
| rabbitmq | `static-passwords` | `existing-secret` | existing-secret |
| mysql | `static-passwords` | `existing-secret` | existing-secret |
| mongodb | `static-passwords` | `existing-secret-replicaset` | existing-secret + ha |
| grafana | `static-passwords` | `existing-secret-ingress` | existing-secret + ingress-tls |
| consul | `default-control-plane` | `secure-mesh-existing-secrets` | existing-secret (+ mesh) |
| external-secrets | `default` | `no-crds` | no-crds ✓ |
| argo-cd | `default` | `no-crds` | no-crds ✓ |
| kube-prometheus-stack | `default` | `no-crds` | no-crds ✓ |
| cert-manager | `default` | `crds-enabled` | crds (inverse — default should be no-crds for GitOps) |
| longhorn | `default` | `ui-ingress` | ingress-tls |
| nginx | `http-clusterip` | `existing-tls-ingress` | ingress-tls (+ existing-secret for TLS) |
| metrics-server | `default` | `external-tls-ca` | tls |
| vault | `default` | `ha-raft-ui` | ha |
| loki | `single-binary-filesystem` | `simple-scalable-minio` | ha (scalable + object store) |
| tempo | `local-persistent` | `s3-query-observability` | ha (object store) |
| prometheus | `default` | `server-only-ephemeral` | minimal |
| ingress-nginx | `default` | `admission-disabled` | minimal |
| secrets-store-csi-driver | `default` | `sync-secret-rotation` | (chart feature: rotation) |

## What the data shows
- **No chart has a `parameterized` base yet** — the doctrine's explicit fill-surface is net-new across the catalog.
- **The catalog is under-forked:** every chart has only 2 bases; the doctrine allows `default + parameterized + ≤4 forks`. Most charts have obvious additional standard forks they don't yet ship (e.g. the secret charts could all offer `ingress-tls` and `ha`).
- **Secret-chart defaults are the F3 hazard:** all 5 `static-passwords` defaults are the silently-broken-over-GitOps case. Under the doctrine their *honest* default either declares the required secret fill or ships `existing-secret` as the recommended base.

## Migration recommendation
1. Adopt the canonical dimension names; keep bespoke shape names only as descriptive suffixes where they add meaning (e.g. `ha` for vault, with `raft` an implementation detail, not the fork name).
2. Alias old names → canonical for one release so existing references don't break.
3. Normalize the `default` role: the menu always presents the `default:true` base as **"default"** regardless of its underlying descriptive name.
4. Flip cert-manager's default to `no-crds` (GitOps-consistent), with `crds` as the fork.

## Sources
The current top-20 package bases, [Catalog Doctrine](./catalog-doctrine.md),
and the generated status and outcome data under `data/`.
