# Deploy the reviewed Helm values result

This run starts with the same five NGINX objects produced by the
bring-your-own values review. It supplies the required Secret separately,
publishes the objects from ConfigHub, and lets Argo CD reconcile them on one
throwaway cluster created with `cub cluster up`.

## What passed

- Public input OCI: `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/byo-nginx-ai-values:24.0.2-r001@sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683`
- ConfigHub source: `byo-nginx-ai-values-24-0-2-reviewed`
- ConfigHub source match: **pass**
- Catalog checks selected: `digest-pinned-images`, `lifecycle-route-evidence`, `probes-declared`, `vet-placeholders`, `vet-schemas`
- ConfigHub release digest: `sha256:e9e5938c021fa294cde478c6537bd869d42792213e4e6ce1c541954c61020397`
- Required Secret supplied out of band: **pass**
- Argo CD: **Synced / Healthy**
- NGINX Deployment: **3/3 replicas ready**
- Live image: `registry-1.docker.io/bitnami/nginx@sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f`
- Live Service: `ClusterIP`

The Application reported the same digest that ConfigHub published. The live
Deployment uses the `ai-provider-credentials` Secret and keeps the reviewed
container security settings. All five reviewed Kubernetes object identities
were present.

## What was temporary

The ConfigHub delivery Space and the kind cluster were deleted after the
checks. The persistent `byo-nginx-ai-values-24-0-2-reviewed` Space remains in the
demo org.

## Run it again

```bash
HELM_EXPT_ALLOW_BYO_HELM_VALUES_DEPLOY=1 \
CUB_CONTEXT=river-bear \
npm run byo-helm-values:deploy-run
```

## Limits

- The Secret value was a fake proof value and is not present in this receipt.
- The persistent base has no release target, so this run imported the same public OCI into a temporary delivery Space owned by the throwaway cluster target.
- This proves one fresh Argo CD deployment on one local kind cluster.
- Promotion, rollback, upgrade, Flux delivery, fleet rollout, and ConfigHub observation storage did not run.

Receipt: [`runs/byo-helm-values-deploy-proof/receipt.yaml`](../../runs/byo-helm-values-deploy-proof/receipt.yaml)
