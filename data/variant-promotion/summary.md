# Variant Promotion Status

This generated view records whether each chart/version/base has a proven
server-side ConfigHub promotion path. It is separate from catalog promotion:
this is about a downstream Space created from an upstream Space using
`cub variant create`, then later catching up with upstream changes using
`cub variant promote`.

Status values:

| Status | Meaning |
| --- | --- |
| `proven` | A committed `VariantPromotionReceipt` proves `cub variant promote` for this chart/base. |
| `proven-with-watch` | A committed receipt proves core promotion mechanics, but records a caution such as a changeset integration bug. |
| `available-needs-receipt` | The base has ConfigHub upload proof and a server-side clone, but no promotion receipt yet. |
| `needs-server-variant` | The base uploads to ConfigHub, but the receipt does not yet show a downstream server-side variant clone. |
| `missing-confighub-proof` | Promotion cannot be tested until the ConfigHub proof lane exists. |
| `blocked-by-confighub-proof` | Promotion is blocked by the ConfigHub proof lane. |
| `n/a` | Promotion is not applicable for this row. |

## Counts

| Status | Rows |
| --- | ---: |
| blocked | 2 |
| missing-confighub-proof | 1 |
| proven | 167 |
| proven-with-watch | 29 |

Matrix values:

| Matrix value | Rows |
| --- | ---: |
| no | 2 |
| todo | 1 |
| watch | 29 |
| yes | 167 |

## Watch Rows

Watch means a receipt proved useful mechanics but recorded a named product
caution. For the changeset fallback rows, the server fix is now present in
ConfigHub v0.1.80; those rows remain watch until their receipts are rerun and
show the changeset-bound path passing.

| Rows | Reason | Tracking |
| ---: | --- | --- |
| 29 | server-side promotion mechanics passed, but changeset-bound promote failed and required the no-changeset fallback | [#682 fixed; rerun required](https://github.com/confighub/helm-expt/issues/682) |

| Row | Evidence | Next action |
| --- | --- | --- |
| `argo-cd/argo-cd@9.5.15/default` | runs/argo-cd-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `bitnami/mongodb@19.0.7/static-passwords` | runs/mongodb-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `bitnami/mongodb@19.0.9/existing-secret-replicaset` | runs/cl-mongodb-19-0-9-existing-secret-replicaset-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `bitnami/mongodb@19.1.0/existing-secret-replicaset` | runs/cl-mongodb-19-1-0-existing-secret-replicaset-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `bitnami/mongodb@19.1.0/static-passwords` | runs/cl-mongodb-19-1-0-static-passwords-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `bitnami/mysql@14.0.3/static-passwords` | runs/mysql-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `bitnami/nginx@24.0.4/existing-tls-ingress` | runs/cl-nginx-24-0-4-existing-tls-ingress-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `bitnami/nginx@24.0.4/http-clusterip` | runs/cl-nginx-24-0-4-http-clusterip-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `bitnami/nginx@25.0.0/existing-tls-ingress` | runs/cl-nginx-25-0-0-existing-tls-ingress-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `bitnami/nginx@25.0.0/http-clusterip` | runs/cl-nginx-25-0-0-http-clusterip-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |

## First TODO Rows

| Row | Status | Next action |
| --- | --- | --- |
| `argo-cd/argo-cd@9.5.17/no-crds` | missing-confighub-proof | run the ConfigHub proof lane first |

## Regenerate

~~~sh
npm run variant-promotion:status
npm run variant-promotion:status:verify
~~~
