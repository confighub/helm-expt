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
| available-needs-receipt | 30 |
| blocked | 2 |
| proven-with-watch | 160 |

Matrix values:

| Matrix value | Rows |
| --- | ---: |
| no | 2 |
| todo | 30 |
| watch | 160 |

## Watch Rows

Watch means a receipt proved useful mechanics but recorded a named product
caution. Do not treat watch as a production gate until the linked issue is
resolved and the receipt reruns as pass.

| Rows | Reason | Tracking |
| ---: | --- | --- |
| 160 | server-side promotion mechanics passed, but changeset-bound promote failed and required the no-changeset fallback | [#682](https://github.com/confighub/helm-expt/issues/682) |

| Row | Evidence | Next action |
| --- | --- | --- |
| `aqua/trivy-operator@0.32.1/default` | runs/trivy-operator-default-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `aqua/trivy-operator@0.32.1/no-crds` | runs/trivy-operator-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-cd@9.5.15/default` | runs/argo-cd-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-cd@9.5.15/no-crds` | runs/argo-cd-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-cd@9.5.17/default` | runs/argo-cd-9517-default-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-cd@9.5.17/no-crds` | runs/argo-cd-9517-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-events@2.4.21/default` | runs/argo-events-default-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-events@2.4.21/no-crds` | runs/argo-events-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-rollouts@2.40.9/default` | runs/argo-rollouts-default-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-rollouts@2.40.9/no-crds` | runs/argo-rollouts-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |

## First TODO Rows

| Row | Status | Next action |
| --- | --- | --- |
| `prometheus-community/kube-prometheus-stack@85.3.3/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts kube-prometheus-stack --base no-crds --variant-promotion-proof --cleanup-spaces |
| `prometheus-community/kube-prometheus-stack@86.1.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts kube-prometheus-stack --base default --variant-promotion-proof --cleanup-spaces |
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
| `runix/pgadmin4@1.62.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts pgadmin4 --base default --variant-promotion-proof --cleanup-spaces |
| `sealed-secrets/sealed-secrets@2.18.6/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts sealed-secrets --base default --variant-promotion-proof --cleanup-spaces |
| `sealed-secrets/sealed-secrets@2.18.6/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts sealed-secrets --base no-crds --variant-promotion-proof --cleanup-spaces |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0/sync-secret-rotation` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts secrets-store-csi-driver --base sync-secret-rotation --variant-promotion-proof --cleanup-spaces |
| `stakater/reloader@2.2.12/controller-default-reviewed` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts reloader --base controller-default-reviewed --variant-promotion-proof --cleanup-spaces |

## Regenerate

~~~sh
npm run variant-promotion:status
npm run variant-promotion:status:verify
~~~
