# Promote the reviewed Helm result

This example starts with the reviewed NGINX configuration produced from a
supplied Helm values file. The saved base stays at three replicas. Development
changes the real Deployment to four replicas, and staging receives that change
through ConfigHub promotion.

## What happened

| Step | Space | Namespace | Replicas | Result |
| --- | --- | --- | ---: | --- |
| Saved reviewed base | `byo-nginx-ai-values-24-0-2-reviewed` | `nginx` | 3 | unchanged |
| Development change | `byo-nginx-ai-values-24-0-2-development` | `nginx-development` | 4 | recorded revision |
| Staging promotion | `byo-nginx-ai-values-24-0-2-staging` | `nginx-staging` | 4 | pass |

The staging configuration Unit points to development revision
`3`, has no pending upstream
change, and records the promoted `spec.replicas: 4` mutation. The pinned
container image, existing-Secret reference, security settings, and ClusterIP
Service stayed in place.

The reviewed base still records the public input:

`oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/byo-nginx-ai-values:24.0.2-r001@sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683`

## README ownership

Each Space has one README. The development and staging README Units are not
linked through the application promotion chain, so improving the explanation
does not create a pending application change.

## Promotion preview limitation

`cub variant promote byo-nginx-ai-values-24-0-2-staging --dry-run -o mutations` left the stored staging configuration
unchanged, but the CLI printed no mutation preview. The real promotion is
visible in staging revision `3`
with source `UpgradeUnit`.

## Run or verify it

```bash
HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROMOTION=1 \
CUB_CONTEXT=river-bear \
npm run byo-helm-values:promotion-sync

CUB_CONTEXT=river-bear npm run byo-helm-values:promotion-hub-verify
```

## Limits

- The dry-run command left staging unchanged but printed no useful mutation preview. That CLI limitation remains open.
- This receipt proves one development-to-staging field promotion in ConfigHub.
- The reviewed three-replica base and the promoted four-replica staging result were each deployed through Argo CD in separate live runs.
- Rollback, chart upgrade, Flux delivery, and fleet rollout have not run for this configuration.

Receipt: [`runs/byo-helm-values-promotion-proof/receipt.yaml`](../../runs/byo-helm-values-promotion-proof/receipt.yaml)
