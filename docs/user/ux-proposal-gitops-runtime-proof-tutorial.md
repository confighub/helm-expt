# UX Proposal: GitOps And Runtime Proof Tutorial

**UNOFFICIAL/EXPERIMENTAL**

Companion to [Tutorial Sequence](./tutorial-sequence.md).

This is a UX proposal, not a shipped GUI. It applies the same intent-first
model to the GitOps/runtime lane: the user asks to publish and prove a reviewed
base, while the system maps that intent to OCI, Argo/Flux, checks, and
receipts.

## Shared Mapping

All tutorial UX proposals use the same map:

```text
Human: express the desired base, environment, region, customer, delivery, or operation.
CLI: use cub installer for render/base work; use cub variant create for derived ConfigHub variants.
Proof: run checks, gates, and receipts before the change is called ready.
```

## Current CLI Friction

The CLI UX exposes a long chain:

```text
install local cluster plugin
create kind rig
install Argo CD
create cluster Space
create OCI target
create root Application
render workload
upload workload Units
publish OCI revision
wait for Argo sync
inspect Kubernetes resources
inspect ConfigHub live status
verify receipt index
```

Each step is useful, but the human story is shorter.

## Simpler Human Intent

A Creator-style flow can present:

```text
Publish to GitOps
From: NGINX/http-clusterip
For: helm-expt-oci-demo
Target: ConfigHub OCI target
Controller: Argo CD
Namespace: nginx
Review:
  6 workload Units plus installer record
  OCI revision will be published
  Argo Application will sync nginx
Checks:
  render pass
  ConfigHub upload pass
  Argo Synced/Healthy
  Kubernetes deployment Ready
Status: runtime proof ready
Create and prove
```

The user should not need to understand every cluster bootstrap detail before
they understand the promise:

```text
Publish this reviewed object set.
Let GitOps pull it.
Confirm the cluster is running what ConfigHub published.
Record the receipt.
```

## Guardrail

The important guardrail is:

```text
GitOps proof is not just upload proof.
It must show the controller pulled the intended artifact and the cluster reached
the expected live state.
```

The Creator-style UX should distinguish:

```text
rendered
uploaded
published
synced
healthy
observed
```

## Formal Shape

The same flow can map to:

```yaml
kind: DeliveryCreatorContract
from:
  component: NGINX
  variant: http-clusterip
  package: packages/bitnami/nginx/24.0.2
create:
  space: helm-expt-oci-demo-nginx
  namespace: nginx
delivery:
  target: helm-expt-oci-demo-cluster/oci
  controller: argo
  application: nginx
review:
  expectedWorkloadUnits: 6
  installerRecord: present
checks:
  - renderPass
  - confighubUploadPass
  - ociRevisionPublished
  - controllerSyncedHealthy
  - runtimeDeploymentReady
receipts:
  - renderReceipt
  - uploadReceipt
  - ociPublicationReceipt
  - gitopsSyncReceipt
  - runtimeObservationReceipt
```

## Mapping Back To Current Primitives

```text
Creator-style intent = publish and prove a reviewed base through GitOps.
Formal contract = target, controller, expected Units, checks, receipts.
cub lk + chart-install-test = local proof substrate.
ConfigHub OCI + Argo CD = delivery substrate.
AX/FX = same delivery proof over one chart or a wave of charts.
```

The product narrative should be "publish this base and prove it is live," not
"manually line up cluster bootstrap, OCI target, Argo refresh, status columns,
and receipt indexes."
