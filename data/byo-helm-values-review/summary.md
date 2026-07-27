# Bring your own Helm chart and values

This example starts with a chart and a values file supplied by a person or
coding agent. It renders the Kubernetes objects before applying them, compares
the result with the checked catalog configuration, and keeps the requested
change without keeping the unsafe parts.

## The request

Run three NGINX replicas and supply the AI provider key used by the application.

The supplied values produced five Kubernetes objects. The review rejected that
render for six concrete reasons:

- **API key embedded in the Deployment:** `Deployment/nginx` at `spec.template.spec.containers[name=nginx].env[name=AI_API_KEY].value`. Use an existing Secret reference instead of a literal key.
- **container image no longer pinned by digest:** `Deployment/nginx` at `spec.template.spec.*Containers[].image`. Restore the reviewed image digest.
- **non-root execution disabled:** `Deployment/nginx` at `spec.template.spec.*Containers[].securityContext.runAsNonRoot`. Require the container to run as a non-root user.
- **privilege escalation enabled:** `Deployment/nginx` at `spec.template.spec.*Containers[].securityContext.allowPrivilegeEscalation`. Disable privilege escalation.
- **Service exposed as a LoadBalancer:** `Service/nginx` at `spec.type`. Keep ClusterIP unless external exposure is an explicit target decision.
- **root filesystem made writable:** `Deployment/nginx` at `spec.template.spec.*Containers[].securityContext.readOnlyRootFilesystem`. Restore the read-only root filesystem.

## The reviewed result

The reviewed values keep three replicas. They restore the pinned image,
`ClusterIP` Service, non-root execution, disabled privilege escalation, and
read-only root filesystem. The literal API key is removed. The Deployment now
refers to the existing `nginx/ai-provider-credentials` Secret instead.

The reviewed render contains five objects and no remaining finding from this
example. Packaging those files as a local OCI produced
`sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683`. Pulling that OCI back produced the same
object-set hash, `ded2b7c2624c74ae1dce2a947ad9d99a32a62f5114361970af61c9ca51449345`.

## Open the files

- Proposed values: [`examples/byo-helm-values/ai-values.yaml`](../../examples/byo-helm-values/ai-values.yaml)
- Proposed render: [`data/byo-helm-values-review/proposed-render.yaml`](./proposed-render.yaml)
- Reviewed values: [`examples/byo-helm-values/reviewed-values.yaml`](../../examples/byo-helm-values/reviewed-values.yaml)
- Reviewed render: [`data/byo-helm-values-review/reviewed-render.yaml`](./reviewed-render.yaml)
- Structured review: [`data/byo-helm-values-review/review.yaml`](./review.yaml)
- Receipt: [`runs/byo-helm-values-proof/receipt.yaml`](../../runs/byo-helm-values-proof/receipt.yaml)

Rerun the proof with:

```bash
HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROOF=1 npm run byo-helm-values:run
```

## Limits

- The proposed values are a deterministic fixture, not a transcript from a named AI model.
- The API key is deliberately fake. The check proves that a literal value reached a rendered Deployment.
- The reviewed package references an existing Secret that this proof does not create or read.
- The local OCI round trip passed. Public registry publication and ConfigHub upload are separate follow-on checks.
- No Kubernetes apply, workload health check, promotion, or controller delivery ran.
