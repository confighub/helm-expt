# UX Proposal: Redis Quick Start Tutorial

**UNOFFICIAL/EXPERIMENTAL**

Companion to [Tutorial Sequence](./tutorial-sequence.md).

This is a UX proposal, not a shipped GUI. It uses the same Creator-style idea
described in [Creator Status](../reference/variant-creation-artifact.md#creator-status):
make the human intent simple, then map it to formal contracts, AX/FX, and the
current CLI primitives.

## Current CLI Friction

The CLI UX is exposing too many implementation steps to a first-time human:

```text
install plugin
check auth
setup package
choose base
render manifests
verify render
upload rendered objects
set component labels
set variant labels
verify uploaded Units
inspect ConfigHub Space
```

Those are real steps, but they are not the story a new user is trying to tell.

## Simpler Human Intent

A Creator-style flow can collapse the tutorial into:

```text
Import Helm chart
Chart: bitnami/redis
Version: 25.5.3
Base: default
Namespace: redis
Create reviewed ConfigHub base
Show me what Helm would render
Upload it as Redis/default
Verify render and uploaded Units
```

The user should see:

```text
Create base
From: bitnami/redis@25.5.3
Base: default
For: demo Redis
Change: render chart, create ConfigHub Units, attach proof labels
Review: 14 Redis Kubernetes objects plus installer record
Checks: Helm-equivalent render, uploaded Unit count
Status: ready to create
Create
```

## Guardrail

The important guardrail is:

```text
If a choice changes Helm render inputs or Kubernetes object shape,
make or choose a base variant.

If a choice only refines an already-reviewed ConfigHub object set,
route it to a derived ConfigHub variant.
```

For Tutorial 1, `redis/default` is a base variant. The flow is about creating
the reviewed starting point.

## Formal Shape

The same flow can emit or consume a formal object:

```yaml
kind: BaseCreatorContract
from:
  chart: bitnami/redis
  version: 25.5.3
create:
  component: Redis
  variant: default
  space: helm-redis-default
render:
  base: default
  namespace: redis
review:
  expectedUnits:
    kubernetesObjects: 14
    records: 1
checks:
  - helmEquivalentRender
  - uploadedUnitCount
  - installerRecordPresent
receipts:
  - renderReceipt
  - uploadReceipt
```

## Mapping Back To Current Primitives

```text
Creator-style intent = create a reviewed Redis/default base.
Formal contract = chart, base, namespace, labels, checks, and receipts.
cub installer setup = render substrate.
cub installer upload = ConfigHub Unit creation substrate.
AX/FX = same contract executed by an agent or function.
```

This is easier to follow than asking the user to learn render directories,
label syntax, upload metadata, and verification commands before they understand
what the tutorial is proving.
