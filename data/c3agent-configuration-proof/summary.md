# c3agent configuration, promotion, and delivery proof

This test began with a disabled c3agent fleet configuration. The three private
runtime images were pinned by digest and the Kubernetes objects referred to a
Secret without containing any credential value.

The development configuration was packed as local OCI, imported as a ConfigHub
base, changed in development, promoted to staging, changed again, promoted to
production, published as a ConfigHub release OCI, and reconciled by Argo CD on a
throwaway kind cluster.

## What passed

| Step | Result | Evidence |
| --- | --- | --- |
| Generate exact objects | pass | Ten objects; object set `sha256:69ed070f05ae42962086e776d3637b760ade2a819f2b643ba18d39599df8cbef`. |
| Pack and pull local OCI | pass | `sha256:7b95d59fd8a76f13235233244d387a3b30a191e30c2fb9e79bebe2611cc0e529`. |
| Keep a ConfigHub base | pass | Three Kubernetes Units retained the same OCI source digest. |
| Promote settings | pass | hx-c3agent-20260820t213-base -> hx-c3agent-20260820t213-dev -> hx-c3agent-20260820t213-staging -> hx-c3agent-20260820t213-prod. |
| Publish release OCI | pass | `sha256:5cb37af571514dcfe0896de81e65fd6d1ea765dd6f9fdd6b8f8652b1da51ce8f`. |
| Reconcile through Argo CD | pass | Synced and Healthy at the same digest. |
| Reconcile Kubernetes objects | pass | Two Deployments present with zero desired replicas; no Pods and no Secret. |
| Start c3agent | not-run | Deliberately outside this test. |
| Run an agent task | not-run | Deliberately outside this test. |

## The reviewed changes

| Environment | Max tasks | Max budget | Poll interval |
| --- | ---: | ---: | ---: |
| Development | 3 | 8 | 5s |
| Staging | 5 | 12.5 | 10s |
| Production | 5 | 12.5 | 10s |

Only the fleet ConfigMap changed. The image selections, Services, RBAC, and
disabled Deployment definitions stayed the same.

## What this does not prove

- The c3agent source and runtime images are private. This is an advanced configuration example, not an anonymous starter package.
- The two Deployments stayed at zero replicas. Argo and Kubernetes reconciled the exact objects, but no c3agent process became ready and no agent task ran.
- The required Secret, PostgreSQL service, persistent storage, image pull credentials, and task-level RBAC review remain activation work.
- This proof used one local kind cluster and Argo CD. It does not prove Flux or a fleet rollout.

The source configuration and local proof are in
`examples/c3agent/fleet-config/`. The full machine receipt is
`runs/c3agent-configuration-proof/receipt.yaml`.
