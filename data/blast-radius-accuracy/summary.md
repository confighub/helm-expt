# Blast-Radius Accuracy

This generated report scores whether a value-source-map prediction matched an
actual committed rerender diff. It is intentionally narrow. A value-source map
is not trusted because it exists; it becomes stronger when a rerender proves
that the predicted affected objects match the actual affected objects.

## Current Status

| Metric | Count |
| --- | ---: |
| Measured cases | 3 |
| Passing measured cases | 3 |
| Failing measured cases | 0 |
| Unmeasured value-source rows | 10 |
| Total rows | 13 |

The measured cases now cover three different risk shapes:

- kube-prometheus-stack `crds.enabled=false`: the prediction says exactly the
  Prometheus Operator CRD objects are affected, and the committed `default`
  and `no-crds` rendered object sets confirm that exactly 10 CRD objects are
  removed.
- Redis `auth.password`: the prediction says the generated Secret and the two
  Redis StatefulSets are affected when moving to `reuse-existing-secret`, and
  the committed rendered object sets confirm one removed Secret and two changed
  StatefulSets.
- NGINX `ingress.enabled + tls.existingSecret`: the prediction says the
  reviewed `existing-tls-ingress` base adds an Ingress and changes the NGINX
  Deployment to mount the backend TLS Secret, and the committed rendered object
  sets confirm exactly that.

This is useful evidence, not a general guarantee. The broader blast-radius
claim stays partial until more value paths are measured across more charts.

## Measured Cases

| Chart | Value path | Variants | Predicted objects | Actual affected objects | False negatives | False positives | Result |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `crds.enabled` | `default` -> `no-crds` | 10 | 10 | 0 | 0 | `pass` |
| `bitnami/redis@25.5.3` | `auth.password` | `default` -> `reuse-existing-secret` | 3 | 3 | 0 | 0 | `pass` |
| `bitnami/nginx@24.0.2` | `ingress.enabled + tls.existingSecret` | `http-clusterip` -> `existing-tls-ingress` | 2 | 2 | 0 | 0 | `pass` |

## Unmeasured Value-Source Rows

These rows have field reachability evidence but no scored actual rerender diff
yet.

| Chart | Value path | Predicted objects | Evidence |
| --- | --- | ---: | --- |
| `bitnami/redis@25.5.3` | `replica.replicaCount` | 1 | [value-source-map](../../recipes/bitnami/redis/25.5.3/value-source-map.yaml) |
| `bitnami/redis@25.5.3` | `releaseName` | 3 | [value-source-map](../../recipes/bitnami/redis/25.5.3/value-source-map.yaml) |
| `bitnami/redis@25.5.3` | `namespace` | 4 | [value-source-map](../../recipes/bitnami/redis/25.5.3/value-source-map.yaml) |
| `bitnami/redis@25.5.3` | `image.digest` | 2 | [value-source-map](../../recipes/bitnami/redis/25.5.3/value-source-map.yaml) |
| `bitnami/redis@27.0.0` | `replica.replicaCount` | 1 | [value-source-map](../../recipes/bitnami/redis/27.0.0/value-source-map.yaml) |
| `bitnami/redis@27.0.0` | `releaseName` | 3 | [value-source-map](../../recipes/bitnami/redis/27.0.0/value-source-map.yaml) |
| `bitnami/redis@27.0.0` | `namespace` | 4 | [value-source-map](../../recipes/bitnami/redis/27.0.0/value-source-map.yaml) |
| `bitnami/redis@27.0.0` | `image.digest` | 2 | [value-source-map](../../recipes/bitnami/redis/27.0.0/value-source-map.yaml) |
| `bitnami/redis@27.0.0` | `auth.password` | 3 | [value-source-map](../../recipes/bitnami/redis/27.0.0/value-source-map.yaml) |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `grafana.adminPassword` | 2 | [value-source-map](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/value-source-map.yaml) |

## Regenerate

~~~sh
npm run blast-radius:accuracy
npm run blast-radius:accuracy:verify
~~~
