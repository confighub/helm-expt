# Deploy the promoted staging result

This run starts with the four-replica NGINX configuration promoted from
development to staging. It clones that exact configuration into a temporary
target-bound Space, supplies the required Secret separately, publishes the
objects from ConfigHub, and lets Argo CD reconcile them on one throwaway
cluster created with `cub cluster up`.

## What passed

- Public input OCI: `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/byo-nginx-ai-values:24.0.2-r001@sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683`
- ConfigHub source: `byo-nginx-ai-values-24-0-2-staging`
- ConfigHub source match: **pass**
- Catalog checks selected: `digest-pinned-images`, `lifecycle-route-evidence`, `probes-declared`, `vet-placeholders`, `vet-schemas`
- ConfigHub release digest: `sha256:708e6708202ec1a0d47d955db61449d961528cf4433d8b35f86462b997173b2d`
- Required Secret supplied out of band: **pass**
- Argo CD: **Synced / Healthy**
- NGINX Deployment: **4/4 replicas ready**
- Live image: `registry-1.docker.io/bitnami/nginx@sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f`
- Live Service: `ClusterIP`

The Application reported the same digest that ConfigHub published. The live
Deployment uses the `ai-provider-credentials` Secret and keeps the reviewed
container security settings. All five reviewed Kubernetes object identities
were present.

## What was temporary

The ConfigHub delivery Space and the kind cluster were deleted after the
checks. The persistent `byo-nginx-ai-values-24-0-2-staging` Space remains in the
demo org.

## Run it again

```bash
HELM_EXPT_ALLOW_BYO_HELM_VALUES_DEPLOY=1 \
CUB_CONTEXT=river-bear \
npm run byo-helm-values:staging-deploy-run
```

## Limits

- The Secret value was a fake proof value and is not present in this receipt.
- The persistent staging Space has no release target, so this run cloned its configuration Unit into a temporary target-bound delivery Space. The README was removed from that delivery copy before publication.
- This proves one fresh Argo CD deployment of the staging lane on one local kind cluster.
- Rollback, chart upgrade, Flux delivery, fleet rollout, and ConfigHub observation storage did not run.

Receipt: [`runs/byo-helm-values-staging-deploy-proof/receipt.yaml`](../../runs/byo-helm-values-staging-deploy-proof/receipt.yaml)
