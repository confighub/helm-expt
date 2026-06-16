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
| available-needs-receipt | 172 |
| proven-with-watch | 20 |

Matrix values:

| Matrix value | Rows |
| --- | ---: |
| todo | 172 |
| watch | 20 |

## Watch Rows

Watch means a receipt proved useful mechanics but recorded a named product
caution. Do not treat watch as a production gate until the linked issue is
resolved and the receipt reruns as pass.

| Rows | Reason | Tracking |
| ---: | --- | --- |
| 20 | server-side promotion mechanics passed, but changeset-bound promote failed and required the no-changeset fallback | [#682](https://github.com/confighub/helm-expt/issues/682) |

| Row | Evidence | Next action |
| --- | --- | --- |
| `argo-cd/argo-cd@9.5.15/default` | runs/argo-cd-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `bitnami/mongodb@19.0.7/generated-passwords` | runs/mongodb-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `bitnami/mysql@14.0.3/generated-passwords` | runs/mysql-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `bitnami/nginx@24.0.2/http-clusterip` | runs/nginx-http-clusterip-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `bitnami/postgresql@18.6.7/generated-passwords` | runs/postgresql-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `bitnami/rabbitmq@16.0.14/generated-passwords` | runs/rabbitmq-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `bitnami/redis@25.5.3/default` | runs/redis-default-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `external-secrets/external-secrets@2.5.0/default` | runs/external-secrets-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `grafana/grafana@10.5.15/generated-passwords` | runs/grafana-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |
| `grafana/loki@7.0.0/single-binary-filesystem` | runs/loki-confighub-proof/latest/variant-promotion-receipt.yaml | resolve https://github.com/confighub/helm-expt/issues/682, then rerun the promotion receipt for a full pass |

## First TODO Rows

| Row | Status | Next action |
| --- | --- | --- |
| `aqua/trivy-operator@0.32.1/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts trivy-operator --base default --variant-promotion-proof --cleanup-spaces |
| `aqua/trivy-operator@0.32.1/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts trivy-operator --base no-crds --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-cd@9.5.15/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-cd --base no-crds --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-cd@9.5.17/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-cd --base default --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-cd@9.5.17/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-cd --base no-crds --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-events@2.4.21/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-events --base default --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-events@2.4.21/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-events --base no-crds --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-rollouts@2.40.9/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-rollouts --base default --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-rollouts@2.40.9/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-rollouts --base no-crds --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-workflows@1.0.14/controller-default-reviewed` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-workflows --base controller-default-reviewed --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-workflows@1.0.14/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-workflows --base default --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argo-workflows@1.0.14/minimal-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argo-workflows --base minimal-crds --variant-promotion-proof --cleanup-spaces |
| `argo-cd/argocd-image-updater@1.2.2/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts argocd-image-updater --base default --variant-promotion-proof --cleanup-spaces |
| `autoscaler/cluster-autoscaler@9.57.0/controller-default-reviewed` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts cluster-autoscaler --base controller-default-reviewed --variant-promotion-proof --cleanup-spaces |
| `autoscaler/cluster-autoscaler@9.57.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts cluster-autoscaler --base default --variant-promotion-proof --cleanup-spaces |
| `autoscaler/vertical-pod-autoscaler@0.9.0/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts vertical-pod-autoscaler --base default --variant-promotion-proof --cleanup-spaces |
| `autoscaler/vertical-pod-autoscaler@0.9.0/no-crds` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts vertical-pod-autoscaler --base no-crds --variant-promotion-proof --cleanup-spaces |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts aws-ebs-csi-driver --base default --variant-promotion-proof --cleanup-spaces |
| `bitnami/apache@11.4.29/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts apache --base default --variant-promotion-proof --cleanup-spaces |
| `bitnami/contour@21.1.4/default` | available-needs-receipt | node scripts/run-top20-confighub-proof.mjs --charts contour --base default --variant-promotion-proof --cleanup-spaces |

## Regenerate

~~~sh
npm run variant-promotion:status
npm run variant-promotion:status:verify
~~~
