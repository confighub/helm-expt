# UX Proposal: Prometheus Base Variant Tutorial

**UNOFFICIAL/EXPERIMENTAL**

Companion to [Tutorial Sequence](./tutorial-sequence.md).

This is a UX proposal, not a shipped GUI. It shows how a values choice that
changes the Prometheus install shape can be presented as a base-variant
creation flow.

## Current CLI Friction

The CLI path asks the user to reason through:

```text
choose package path
choose base
render into work directory
know which values were disabled
run proof checks
open generated catalog artifacts
understand why this is not a derived ConfigHub variant
```

The human intent is:

```text
Create the smaller Prometheus install shape I actually want to run.
```

## Simpler Human Intent

A Creator-style flow can present:

```text
Create base variant
From: prometheus-community/prometheus@29.8.0
Variant: server-only-ephemeral
Change: disable bundled components, disable persistence
Review: fewer rendered Kubernetes objects than default
Checks: Helm-equivalent render, package proof, catalog proof
Status: ready to create
Create
```

The review should make the routing obvious:

```text
This changes the Helm-rendered object set.
It must be a reviewed base variant.
It is not a post-render ConfigHub-only promotion.
```

## Guardrail

The important guardrail is:

```text
If x/y changes Helm values, object count, object shape, or lifecycle semantics,
route back to a maintained base variant.

If x/y changes only approved ConfigHub fields after upload,
route to a derived ConfigHub variant.
```

Tutorial 3 is deliberately on the base side of that boundary.

## Formal Shape

The same flow can map to:

```yaml
kind: BaseCreatorContract
from:
  chart: prometheus-community/prometheus
  version: 29.8.0
create:
  component: Prometheus
  variant: server-only-ephemeral
render:
  base: server-only-ephemeral
  namespace: monitoring
changes:
  renderInputs:
    - disable bundled components
    - disable persistence
review:
  installShape: server only, ephemeral storage
  route: baseVariant
checks:
  - helmEquivalentRender
  - prometheusProofPasses
  - packageProofPasses
receipts:
  - renderReceipt
  - packageReceipt
  - catalogReceipt
```

## Mapping Back To Current Primitives

```text
Creator-style intent = create a reviewed Prometheus base.
Formal contract = chart version, values route, checks, and receipts.
cub installer setup = render substrate.
npm proof scripts = verification substrate.
AX/FX = same base-creation contract executed without the human CLI choreography.
```

The product narrative should be "make this install shape reviewable," not
"remember which package directory and proof command to run."
