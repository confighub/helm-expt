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
| available-needs-receipt | 163 |
| proven-with-watch | 29 |

Matrix values:

| Matrix value | Rows |
| --- | ---: |
| todo | 163 |
| watch | 29 |

## Watch Rows

Watch means a receipt proved useful mechanics but recorded a named product
caution. Do not treat watch as a production gate until the linked issue is
resolved and the receipt reruns as pass.

| Rows | Reason | Tracking |
| ---: | --- | --- |
| 29 | server-side promotion mechanics passed, but changeset-bound promote failed and required the no-changeset fallback | [#682](https://github.com/confighub/helm-expt/issues/682) |

| Row | Evidence | Next action |
| --- | --- | --- |
| `aqua/trivy-operator@0.32.1/default` | runs/trivy-operator-default-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `aqua/trivy-operator@0.32.1/no-crds` | runs/trivy-operator-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-cd@9.5.15/default` | runs/argo-cd-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-cd@9.5.17/default` | runs/argo-cd-9517-default-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-cd@9.5.17/no-crds` | runs/argo-cd-9517-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-events@2.4.21/default` | runs/argo-events-default-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-events@2.4.21/no-crds` | runs/argo-events-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-rollouts@2.40.9/default` | runs/argo-rollouts-default-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-rollouts@2.40.9/no-crds` | runs/argo-rollouts-no-crds-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `argo-cd/argo-workflows@1.0.14/controller-default-reviewed` | runs/argo-workflows-controller-default-reviewed-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |

## First TODO Rows

| Row | Status | Next action |
| --- | --- | --- |
| `argo-cd/argo-cd@9.5.15/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts argo-cd --base no-crds --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-workflows@1.0.14/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts argo-workflows --base default --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-workflows@1.0.14/minimal-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts argo-workflows --base minimal-crds --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argocd-image-updater@1.2.2/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts argocd-image-updater --base default --variant-promotion-proof --cleanup-spaces |
| `autoscaler/cluster-autoscaler@9.57.0/controller-default-reviewed` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts cluster-autoscaler --base controller-default-reviewed --variant-promotion-proof --cleanup-spaces |
| `autoscaler/cluster-autoscaler@9.57.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts cluster-autoscaler --base default --variant-promotion-proof --cleanup-spaces |
| `autoscaler/vertical-pod-autoscaler@0.9.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts vertical-pod-autoscaler --base default --variant-promotion-proof --cleanup-spaces |
| `autoscaler/vertical-pod-autoscaler@0.9.0/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts vertical-pod-autoscaler --base no-crds --variant-promotion-proof --cleanup-spaces |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts aws-ebs-csi-driver --base default --variant-promotion-proof --cleanup-spaces |
| `bitnami/apache@11.4.29/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts apache --base default --variant-promotion-proof --cleanup-spaces |
| `bitnami/contour@21.1.4/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts contour --base default --variant-promotion-proof --cleanup-spaces |
| `bitnami/contour@21.1.4/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts contour --base no-crds --variant-promotion-proof --cleanup-spaces |
| `bitnami/elasticsearch@22.1.6/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts elasticsearch --base default --variant-promotion-proof --cleanup-spaces |
| `bitnami/elasticsearch@22.1.6/ha` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts elasticsearch --base ha --variant-promotion-proof --cleanup-spaces |
| `bitnami/memcached@8.5.5/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts memcached --base default --variant-promotion-proof --cleanup-spaces |
| `bitnami/mongodb@19.0.7/existing-secret-replicaset` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts mongodb --base existing-secret-replicaset --variant-promotion-proof --cleanup-spaces |
| `bitnami/mongodb@19.0.9/existing-secret-replicaset` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts mongodb --base existing-secret-replicaset --variant-promotion-proof --cleanup-spaces |
| `bitnami/mongodb@19.0.9/generated-passwords` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts mongodb --base generated-passwords --variant-promotion-proof --cleanup-spaces |
| `bitnami/mongodb@19.1.0/existing-secret-replicaset` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts mongodb --base existing-secret-replicaset --variant-promotion-proof --cleanup-spaces |
| `bitnami/mongodb@19.1.0/generated-passwords` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts mongodb --base generated-passwords --variant-promotion-proof --cleanup-spaces |

## Regenerate

~~~sh
npm run variant-promotion:status
npm run variant-promotion:status:verify
~~~
