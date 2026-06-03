# Chart Facts — what each chart is, and what we can't yet easily enable

One row per chart with a recipe (100 charts). The headline column is **not_yet_enabled**:
a recommended capability we cannot yet build because **no solution/workaround exists yet**. This is
kept distinct from **buildable_not_yet_run** — capabilities with a known build path that simply
haven't been run through the variant generator.

## Headline

```text
charts with a recipe:                       100
no open gap (built or n/a; modeled L2):     74
charts with a hard gap (no workaround yet):  26
charts with buildable backlog (path exists): 37
```

## What the hard gaps are (charts affected)

```text
existing-secret — chart ships no Secret toggle (#113):  15
no-crds — template-baked CRDs, no toggle (#114):        4
curated proof lane — needs bespoke teaching:            6
other hard gap:                                         1
```

## How to read a row

| Column | Meaning |
| --- | --- |
| `post_deploy_hooks` | Helm post-install / post-upgrade / post-delete hooks the chart ships |
| `other_hooks` | pre-install / pre-upgrade / pre-delete / test hooks |
| `hook_status` | hooks have an execution home (ConfigHub applies; Flux/Argo runs) — live receipt still pending |
| `generates_secrets` | chart generates secret material (random / cert / password funcs) |
| `existing_secret` | bring-your-own-Secret path: built, a known gap, or n/a |
| `no_crds_variant` | a CRDs-off variant: built, a known gap, or n/a |
| `webhooks` | validating + mutating admission webhooks |
| `required_values` | chart uses `required`/`fail` — some inputs are mandatory or the render aborts |
| `values_schema` | chart ships `values.schema.json` — a machine-checked contract for user inputs |
| `install_vs_upgrade` | chart branches on `.Release.IsInstall`/`.IsUpgrade` — upgrade render differs from the captured install render |
| `notes` | chart ships `NOTES.txt` post-install guidance |
| `extension_slots` | open tpl / extraManifests injection points — safe to fill but need per-use review |
| `buildable_not_yet_run` | recommended variants with a known build path, just not run through the generator yet |
| `not_yet_enabled` | **the honest hard gap**: recommended capability with no solution/workaround yet, + reason |

## Charts with an open gap

| Chart | Not yet enabled |
| --- | --- |
| `argo-cd/argo-cd` | ha (curated proof lane — bespoke teaching needed) |
| `argo-cd/argocd-image-updater` | no-crds (template-baked CRDs, no toggle — #114) |
| `bitnami/apache` | existing-secret (chart ships no Secret toggle — #113) |
| `bitnami/contour` | existing-secret (chart ships no Secret toggle — #113) |
| `bitnami/elasticsearch` | existing-secret (chart ships no Secret toggle — #113) |
| `bitnami/memcached` | existing-secret (chart ships no Secret toggle — #113) |
| `bitnami/mysql` | ha (curated proof lane — bespoke teaching needed) |
| `bitnami/nginx` | existing-secret (chart ships no Secret toggle — #113) |
| `bitnami/phpmyadmin` | existing-secret (chart ships no Secret toggle — #113) |
| `bitnami/postgresql` | ha (curated proof lane — bespoke teaching needed) |
| `bitnami/rabbitmq` | ha (curated proof lane — bespoke teaching needed) |
| `bitnami/spark` | existing-secret (chart ships no Secret toggle — #113) |
| `bitnami/zookeeper` | existing-secret (chart ships no Secret toggle — #113) |
| `fairwinds-stable/goldilocks` | existing-secret (chart ships no Secret toggle — #113) |
| `grafana/pyroscope` | existing-secret (chart ships no Secret toggle — #113) |
| `grafana/tempo` | ha (tempo single-binary chart; HA is the separate t…) |
| `hashicorp/consul` | ha (curated proof lane — bespoke teaching needed) |
| `jaegertracing/jaeger` | existing-secret (chart ships no Secret toggle — #113) |
| `kyverno/kyverno` | existing-secret (chart ships no Secret toggle — #113) |
| `linkerd/linkerd-crds` | no-crds (template-baked CRDs, no toggle — #114) |
| `metrics-server/metrics-server` | existing-secret (chart ships no Secret toggle — #113) |
| `minio-operator/operator` | no-crds (template-baked CRDs, no toggle — #114) |
| `prometheus-community/kube-prometheus-stack` | existing-secret (chart ships no Secret toggle — #113) |
| `prometheus-community/prometheus` | ha (curated proof lane — bespoke teaching needed) |
| `rook-release/rook-ceph` | no-crds (template-baked CRDs, no toggle — #114) |
| `traefik/traefik` | existing-secret (chart ships no Secret toggle — #113) |

## Files

```text
data/chart-facts/chart-facts.csv   one row per chart, all fact columns (open in a spreadsheet)
data/chart-facts/summary.md        this file
```
