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
| proven | 76 |
| proven-with-watch | 121 |

Matrix values:

| Matrix value | Rows |
| --- | ---: |
| no | 2 |
| watch | 121 |
| yes | 76 |

## Watch Rows

Watch means a receipt proved useful mechanics but recorded a named product
caution. For the changeset fallback rows, the server fix is now present in
ConfigHub v0.1.80; those rows remain watch until their receipts are rerun and
show the changeset-bound path passing.

| Rows | Reason | Tracking |
| ---: | --- | --- |
| 121 | server-side promotion mechanics passed, but changeset-bound promote failed and required the no-changeset fallback | [#682 fixed; rerun required](https://github.com/confighub/helm-expt/issues/682) |

| Row | Evidence | Next action |
| --- | --- | --- |
| `aqua/trivy-operator@0.32.1/default` | runs/trivy-operator-default-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `aqua/trivy-operator@0.32.1/no-crds` | runs/trivy-operator-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `argo-cd/argo-cd@9.5.17/default` | runs/argo-cd-9517-default-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `argo-cd/argo-cd@9.5.17/no-crds` | runs/argo-cd-9517-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `argo-cd/argo-events@2.4.21/default` | runs/argo-events-default-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `argo-cd/argo-events@2.4.21/no-crds` | runs/argo-events-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `argo-cd/argo-rollouts@2.40.9/default` | runs/argo-rollouts-default-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `argo-cd/argo-rollouts@2.40.9/no-crds` | runs/argo-rollouts-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `argo-cd/argo-workflows@1.0.14/controller-default-reviewed` | runs/argo-workflows-controller-default-reviewed-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |
| `argo-cd/argo-workflows@1.0.14/default` | runs/argo-workflows-default-confighub-proof/latest/variant-promotion-receipt.yaml | ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass |

## First TODO Rows

| Row | Status | Next action |
| --- | --- | --- |
| — | — | — |

## Regenerate

~~~sh
npm run variant-promotion:status
npm run variant-promotion:status:verify
~~~
