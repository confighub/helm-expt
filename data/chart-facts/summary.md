# Chart Facts — what each chart is, and what we can't yet easily enable

One row per chart with a recipe (100 charts). The headline column is **not_yet_enabled**:
a recommended capability we cannot yet build because **no solution/workaround exists yet**. This is
kept distinct from **buildable_not_yet_run** — capabilities with a known build path that simply
haven't been run through the variant generator.

Hook counts in this file are scoped to the current recipe corpus. The retained
source-scan top-100 hook inventory is separate because it can include charts
that are not yet current recipe rows. Use
`data/hook-lifecycle/summary.md` for source-scan hook totals.

## Headline

```text
charts with a recipe:                       100
no open gap (built or n/a; modeled L2):     78
charts with a hard gap (no workaround yet):  22
charts with buildable backlog (path exists): 38
charts with remote dependency risk surfaced: 18
non-exact dependency rows frozen to lock:    9
remote-risk rows missing dependency provenance: 0
current recipe rows with Helm hooks:         5
hook rows observed:                          5
hook rows partially observed:                0
hook rows route-selected only:               0
hook rows source-reviewed but not maintained:0
hook-like reviewed rows without hook annotation: 0
hook rows still needing source route review: 0
```

## What the hard gaps are (charts affected)

```text
existing-secret - chart ships no Secret toggle:         12
no-crds - template-baked CRDs, no clean toggle yet:     3
curated proof lane — needs bespoke teaching:            6
other hard gap:                                         1
```

## How to read a row

| Column | Meaning |
| --- | --- |
| `post_deploy_hooks` | Helm post-install / post-upgrade / post-delete hooks the chart ships |
| `other_hooks` | pre-install / pre-upgrade / pre-delete / test hooks |
| `hook_status` | current hook route state: observed, partially observed, source reviewed, source detected, or n/a |
| `hook_route_evidence` | receipt, queue, review, or source-scan file supporting the hook status |
| `hook_route_next_action` | next concrete lifecycle step before stronger support can be claimed |
| `generates_secrets` | chart generates secret material (random / cert / password funcs) |
| `existing_secret` | bring-your-own-Secret path: built, a known gap, or n/a |
| `no_crds_variant` | a CRDs-off variant: built, a known gap, or n/a |
| `webhooks` | validating + mutating admission webhooks |
| `required_values` | chart uses `required`/`fail` — some inputs are mandatory or the render aborts |
| `values_schema` | chart ships `values.schema.json` — a machine-checked contract for user inputs |
| `install_vs_upgrade` | chart branches on `.Release.IsInstall`/`.IsUpgrade` — upgrade render differs from the captured install render |
| `notes` | chart ships `NOTES.txt` post-install guidance |
| `extension_slots` | open tpl / extraManifests injection points — safe to fill but need per-use review |
| `dependency_lock` | whether the recipe records an empty or non-empty dependency closure, and whether dependency provenance is recorded |
| `remote_dependency_risk` | top-100 source-scan dependency risk: remote repositories, non-exact constraints, or vendored subcharts |
| `dependency_range_policy` | how non-exact source dependency ranges are handled; `freeze-to-chart-lock` means install uses the committed lock |
| `dependency_refresh_survival` | whether this dependency row is connected to the top-20 refresh-survival surface |
| `buildable_not_yet_run` | recommended variants with a known build path, just not run through the generator yet |
| `not_yet_enabled` | **the honest hard gap**: recommended capability with no solution/workaround yet, + reason |

## Charts with an open gap

| Chart | Not yet enabled |
| --- | --- |
| `argo-cd/argo-cd` | ha (curated proof lane — bespoke teaching needed) |
| `argo-cd/argocd-image-updater` | no-crds (template-baked CRDs; no clean chart toggle yet) |
| `bitnami/apache` | existing-secret (chart ships no Secret toggle) |
| `bitnami/contour` | existing-secret (chart ships no Secret toggle) |
| `bitnami/elasticsearch` | existing-secret (chart ships no Secret toggle) |
| `bitnami/memcached` | existing-secret (chart ships no Secret toggle) |
| `bitnami/mysql` | ha (curated proof lane — bespoke teaching needed) |
| `bitnami/nginx` | existing-secret (chart ships no Secret toggle) |
| `bitnami/phpmyadmin` | existing-secret (chart ships no Secret toggle) |
| `bitnami/postgresql` | ha (curated proof lane — bespoke teaching needed) |
| `bitnami/rabbitmq` | ha (curated proof lane — bespoke teaching needed) |
| `bitnami/spark` | existing-secret (chart ships no Secret toggle) |
| `bitnami/zookeeper` | existing-secret (chart ships no Secret toggle) |
| `fairwinds-stable/goldilocks` | existing-secret (chart ships no Secret toggle) |
| `grafana/pyroscope` | existing-secret (chart ships no Secret toggle) |
| `grafana/tempo` | ha (tempo single-binary chart; HA is the separate tempo-distributed chart) |
| `hashicorp/consul` | ha (curated proof lane — bespoke teaching needed) |
| `jaegertracing/jaeger` | existing-secret (chart ships no Secret toggle) |
| `metrics-server/metrics-server` | existing-secret (chart ships no Secret toggle) |
| `minio-operator/operator` | no-crds (template-baked CRDs; no clean chart toggle yet) |
| `prometheus-community/prometheus` | ha (curated proof lane — bespoke teaching needed) |
| `rook-release/rook-ceph` | no-crds (template-baked CRDs; no clean chart toggle yet) |

## Files

```text
data/chart-facts/chart-facts.csv   one row per chart, all fact columns (open in a spreadsheet)
data/chart-facts/summary.md        this file
```
