# Extension Slot Coverage

This generated report answers the NGINX-style question:

~~~text
Which charts expose powerful Helm inputs such as raw manifests, tpl snippets,
extra config blocks, sidecars, or chart-specific config file slots?
~~~

Extension slots are useful, but they are not ordinary safe defaults. If a user
populates one, the result should be treated as a reviewed install shape with
its own render parity, scans, gates, and receipts.

## Headline

~~~text
top-20 catalog charts with explicit extension-slot control points: 13/20
top-20 catalog charts without extension slots in chart facts:     7/20
top-100 chart facts with extension slots surfaced:                82/100
matched top-500 proof rows with extension-slot control points:    53
top-500 source rows using tpl:                                    362/500
top-500 source rows with raw/extra manifest values:               254/500
top-500 source rows using tpl or raw/extra manifest values:       363/500
~~~

The top-500 `tpl` and raw/extra manifest counts are broader than the explicit
control-point count. They are source-scan signals that a chart may have
template-powered or arbitrary object injection inputs. The explicit
control-point count is narrower: it only covers rows already matched to current
recipe/package proof artifacts.

## Top-20 Catalog Charts

| Chart | Built variants | Example surfaces | Control point |
| --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | default+no-crds | raw/extra manifests; tpl-powered values | tpl:controlled-by-empty-defaults |
| `bitnami/mongodb@19.0.7` | existing-secret-replicaset+generated-passwords | tpl-powered values | tpl:controlled-by-empty-defaults |
| `bitnami/nginx@24.0.2` | existing-tls-ingress+http-clusterip | NGINX config blocks; raw/extra manifests; sidecars | extension-slots:controlled-by-empty-defaults |
| `external-secrets/external-secrets@2.5.0` | default+no-crds | raw/extra manifests; tpl-powered values | tpl:controlled-by-empty-defaults |
| `grafana/grafana@10.5.15` | existing-secret-ingress+generated-passwords | sidecars; monitoring config; Secret/env injection | extension-slots:controlled-by-empty-defaults |
| `grafana/loki@7.0.0` | simple-scalable-minio+single-binary-filesystem | raw/extra manifests; Secret/env injection; tpl-powered values | tpl:controlled-by-empty-defaults |
| `grafana/tempo@1.24.4` | local-persistent+s3-query-observability | volumes/mounts; tpl-powered values | extension-slots:controlled-by-empty-defaults |
| `hashicorp/consul@2.0.0` | default-control-plane+secure-mesh-existing-secrets | controller/gateway config; tpl-powered values | extension-slots:controlled-by-empty-defaults |
| `hashicorp/vault@0.32.0` | default+ha-raft-ui | sidecars; volumes/mounts; Secret/env injection | extension-slots:controlled-by-empty-defaults |
| `jetstack/cert-manager@v1.20.2` | crds-enabled+default | raw/extra manifests; tpl-powered values | tpl:controlled-by-empty-defaults |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default+no-crds | raw/extra manifests; monitoring config; tpl-powered values | tpl:controlled-by-empty-defaults |
| `prometheus-community/prometheus@29.8.0` | default+server-only-ephemeral | raw/extra manifests; monitoring config | extension-slots:controlled-by-empty-defaults |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default+sync-secret-rotation | chart-specific tpl/raw/config slots | extension-slots:controlled-by-empty-defaults |

## Top-20 Charts Without Extension Slots

These charts still have normal Helm choices and production review work. They do
not currently expose NGINX-like raw manifest, tpl snippet, config block,
sidecar, or add-on slots in the chart facts.

| Chart | Built variants | Current hard gap | Route |
| --- | --- | --- | --- |
| `bitnami/mysql@14.0.3` | generated-passwords+existing-secret | ha (curated proof lane - bespoke teaching needed) | use the supported base; route Helm-input changes through a reviewed `cub installer` base and post-render changes through `cub variant create` |
| `bitnami/postgresql@18.6.7` | generated-passwords+existing-secret | ha (curated proof lane - bespoke teaching needed) | use the supported base; route Helm-input changes through a reviewed `cub installer` base and post-render changes through `cub variant create` |
| `bitnami/rabbitmq@16.0.14` | generated-passwords+existing-secret | ha (curated proof lane - bespoke teaching needed) | use the supported base; route Helm-input changes through a reviewed `cub installer` base and post-render changes through `cub variant create` |
| `bitnami/redis@25.5.3` | default+reuse-existing-secret | - | use the supported base; route Helm-input changes through a reviewed `cub installer` base and post-render changes through `cub variant create` |
| `ingress-nginx/ingress-nginx@4.15.1` | default+admission-disabled | - | use the supported base; route Helm-input changes through a reviewed `cub installer` base and post-render changes through `cub variant create` |
| `longhorn/longhorn@1.11.2` | default+ui-ingress | - | use the supported base; route Helm-input changes through a reviewed `cub installer` base and post-render changes through `cub variant create` |
| `metrics-server/metrics-server@3.13.0` | default+external-tls-ca | existing-secret (chart ships no Secret toggle) | use the supported base; route Helm-input changes through a reviewed `cub installer` base and post-render changes through `cub variant create` |

## How To Use This

| User change | Route |
| --- | --- |
| Leave the extension slot empty or disabled. | Use the supported catalog base. |
| Fill `serverBlock`, `extraDeploy`, raw manifests, sidecars, scrape configs, or similar values. | Create a new reviewed `cub installer` base variant and rerun render parity, scans, gates, and receipts. |
| Change target, region, labels, approval policy, observation policy, or other ConfigHub metadata after render. | Use a derived ConfigHub variant with `cub variant create`. |

NGINX is the clearest concrete example. Its supported bases keep
`serverBlock`, `streamServerBlock`, `extraDeploy`,
`cloneStaticSiteFromGit`, metrics, and sidecar slots empty or disabled. See
[NGINX Configuration Files](../../docs/user/nginx-configuration-files.md).

## Files

| File | Purpose |
| --- | --- |
| `data/extension-slots/extension-slots.csv` | One row per top-100 chart where chart facts surface extension slots. |
| `data/quirk-coverage/summary.md` | Quirk-axis coverage summary, including broader top-500 counts. |
| `data/outcome-coverage/feature-outcomes.csv` | One row per chart feature, including extension-slot status. |

Regenerate:

~~~sh
npm run extension-slots
npm run extension-slots:verify
~~~
