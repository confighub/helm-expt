# Blast-Radius Accuracy

This generated report scores whether a value-source-map prediction matched an
actual committed rerender diff. It is intentionally narrow. A value-source map
is not trusted because it exists; it becomes stronger when a rerender proves
that the predicted affected objects match the actual affected objects.

## Current Status

| Metric | Count |
| --- | ---: |
| Measured cases | 13 |
| Passing measured cases | 13 |
| Failing measured cases | 0 |
| Unmeasured value-source rows | 0 |
| Total rows | 13 |

Measured cases come from two measurement types:

- `committed-base-pair-rerender-diff`: two committed variant renders for the
  same recipe are diffed in place, so the actual side is already in the tree
  (for example `default` against `no-crds` or `reuse-existing-secret`).
- `single-value-rerender-diff`: a recorded case receipt under
  `case-receipts/` (written by `scripts/record-blast-radius-case.mjs`)
  captures a fresh re-render of the default variant with exactly one value
  overridden. The receipt carries the rendered diff and its render context;
  this verifier rescores the diff against the committed value-source-map, so
  a later map edit invalidates a stale receipt instead of keeping its score.
- `whole-release-rename-diff`: a recorded case receipt for the
  whole-release identity paths (`namespace`, `releaseName`). The renamed
  render's objects are mapped back to base identities (rename-aware pairing),
  then paired objects are content-diffed; the receipt records which fields
  changed per object.

A failing measured case is published, not suppressed: it records that the
value-source-map under-predicts that path (typically a whole-release path
where the release name or namespace reaches every object through labels,
selectors, and embedded DNS names). The route for a failing row is to make
the source map honest about whole-release scope — exhaustive enumeration or
a declared whole-release impact marker — and then re-record the case. The
benchmark catching our own maps first is the point.

This is useful evidence, not a general guarantee. The broader blast-radius
claim stays partial until more value paths are measured across more charts.

## Measured Cases

| Chart | Value path | Variants | Predicted objects | Actual affected objects | False negatives | False positives | Result |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `crds.enabled` | `default` -> `no-crds` | 10 | 10 | 0 | 0 | `pass` |
| `bitnami/redis@25.5.3` | `auth.password` | `default` -> `reuse-existing-secret` | 3 | 3 | 0 | 0 | `pass` |
| `bitnami/redis@27.0.0` | `auth.password` | `default` -> `reuse-existing-secret` | 3 | 3 | 0 | 0 | `pass` |
| `bitnami/nginx@24.0.2` | `ingress.enabled + tls.existingSecret` | `http-clusterip` -> `existing-tls-ingress` | 2 | 2 | 0 | 0 | `pass` |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `grafana.adminPassword` | `default` -> `default + grafana.adminPassword=blast-radius-probe` | 2 | 2 | 0 | 0 | `pass` |
| `bitnami/redis@25.5.3` | `image.digest` | `default` -> `default + image.digest=sha256:1111111111111111111111111111111111111111111111111111111111111111` | 2 | 2 | 0 | 0 | `pass` |
| `bitnami/redis@25.5.3` | `namespace` | `default` -> `default renamed namespace: redis -> brcprobens` | 14 | 14 | 0 | 0 | `pass` |
| `bitnami/redis@25.5.3` | `releaseName` | `default` -> `default renamed releaseName: redis -> redisprobe` | 14 | 14 | 0 | 0 | `pass` |
| `bitnami/redis@25.5.3` | `replica.replicaCount` | `default` -> `default + replica.replicaCount=4` | 1 | 1 | 0 | 0 | `pass` |
| `bitnami/redis@27.0.0` | `image.digest` | `default` -> `default + image.digest=sha256:1111111111111111111111111111111111111111111111111111111111111111` | 2 | 2 | 0 | 0 | `pass` |
| `bitnami/redis@27.0.0` | `namespace` | `default` -> `default renamed namespace: redis -> brcprobens` | 14 | 14 | 0 | 0 | `pass` |
| `bitnami/redis@27.0.0` | `releaseName` | `default` -> `default renamed releaseName: redis -> redisprobe` | 14 | 14 | 0 | 0 | `pass` |
| `bitnami/redis@27.0.0` | `replica.replicaCount` | `default` -> `default + replica.replicaCount=4` | 1 | 1 | 0 | 0 | `pass` |

## Unmeasured Value-Source Rows

These rows have field reachability evidence but no scored actual rerender diff
yet.

| Chart | Value path | Predicted objects | Evidence |
| --- | --- | ---: | --- |


## Regenerate

~~~sh
npm run blast-radius:accuracy
npm run blast-radius:accuracy:verify
~~~
