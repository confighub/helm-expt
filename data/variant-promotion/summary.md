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
| available-needs-receipt | 16 |
| blocked | 2 |
| missing-confighub-proof | 7 |
| proven | 53 |
| proven-with-watch | 121 |

Matrix values:

| Matrix value | Rows |
| --- | ---: |
| no | 2 |
| todo | 23 |
| watch | 121 |
| yes | 53 |

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
| `bitnami/apache@11.4.29/legacy` | missing-confighub-proof | run the ConfigHub proof lane first |
| `bitnami/contour@21.1.4/legacy` | missing-confighub-proof | run the ConfigHub proof lane first |
| `bitnami/elasticsearch@22.1.6/legacy` | missing-confighub-proof | run the ConfigHub proof lane first |
| `bitnami/opensearch@2.0.10/legacy` | missing-confighub-proof | run the ConfigHub proof lane first |
| `bitnami/phpmyadmin@20.0.0/legacy` | missing-confighub-proof | run the ConfigHub proof lane first |
| `bitnami/spark@10.0.3/legacy` | missing-confighub-proof | run the ConfigHub proof lane first |
| `bitnami/zookeeper@13.8.7/legacy` | missing-confighub-proof | run the ConfigHub proof lane first |
| `prometheus-community/kube-prometheus-stack@86.1.0/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts kube-prometheus-stack --base no-crds --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/kube-state-metrics@7.4.0/cluster-metrics-readonly` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts kube-state-metrics --base cluster-metrics-readonly --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/kube-state-metrics@7.4.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts kube-state-metrics --base default --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/prometheus-adapter@5.3.0/apiservice-v1-capability` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts prometheus-adapter --base apiservice-v1-capability --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/prometheus-adapter@5.3.0/cluster-metrics-readonly` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts prometheus-adapter --base cluster-metrics-readonly --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/prometheus-adapter@5.3.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts prometheus-adapter --base default --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0/cluster-metrics-readonly` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts prometheus-blackbox-exporter --base cluster-metrics-readonly --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/prometheus-operator-crds@29.0.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts prometheus-operator-crds --base default --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/prometheus@29.8.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts prometheus --base default --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/prometheus@29.9.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts prometheus --base default --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/prometheus@29.9.0/server-only-ephemeral` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts prometheus --base server-only-ephemeral --variant-promotion-proof --cleanup-spaces |
| `rook-release/rook-ceph-cluster@v1.19.5/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts rook-ceph-cluster --base default --variant-promotion-proof --cleanup-spaces |
| `rook-release/rook-ceph@v1.19.5/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts rook-ceph --base default --variant-promotion-proof --cleanup-spaces |

## Regenerate

~~~sh
npm run variant-promotion:status
npm run variant-promotion:status:verify
~~~
