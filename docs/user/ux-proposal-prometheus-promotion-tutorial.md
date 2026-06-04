# UX Proposal: Prometheus Promotion Tutorial

**UNOFFICIAL/EXPERIMENTAL**

Companion to [Tutorial Sequence](./tutorial-sequence.md).

This is a UX proposal, not a shipped GUI. It uses the Creator distinction from
[Creator Status](../reference/variant-creation-artifact.md#creator-status):
Creator is the simple product story, the Variant Creator contract is the formal
artifact, and `cub variant create` is the current substrate.

## Current CLI Friction

The CLI UX is exposing too many implementation steps to humans:

```text
setup
render
upload
clone space
set labels
set target
add gates
run checks
record receipts
```

A user is not trying to assemble those primitives by hand. They are trying to
extend a reviewed base safely.

## Simpler Human Intent

A Creator story can collapse that into the intent:

```text
Take this reviewed base.
Extend it for prod-us-east.
Add target, region, gates, and observation policy.
Show me what changes.
Create it if checks pass.
```

The user should see:

```text
Create variant
From: Prometheus/server-only-ephemeral
Extend with:
  environment: Prod
  region: us-east
  target: monitoring-prod-us-east
  gates: production-review
  observation: fresh-before-apply
Review:
  same Prometheus install shape
  changed ConfigHub fields only
  upstream links preserved
Status: ready to create
Create
```

## Guardrail

The important guardrail is still:

```text
If x/y changes Helm render inputs or Kubernetes object shape,
route back to a base variant.

If x/y is post-render ConfigHub refinement,
create a derived variant through Creator.
```

Tutorial 4 is a derived ConfigHub variant because production target, region,
gates, links, and observation policy do not require a new Helm render.

## Formal Shape

Underneath, the flow can emit or consume a formal contract:

```yaml
kind: VariantCreatorContract
from:
  component: Prometheus
  variant: server-only-ephemeral
  space: helm-prometheus-server-only
create:
  variant: prod-us-east
extends:
  environment: Prod
  region: us-east
  target: monitoring-prod-us-east
  gates:
    delete: production-review
    destroy: production-review
  observationPolicy: fresh-before-apply
review:
  installShape: same Prometheus server-only rendered object set
  changedFieldsOnly:
    - target
    - environment
    - region
    - gates
    - observationPolicy
checks:
  - sameRenderedObjectSet
  - allowedMutationPathsOnly
  - upstreamLinksPreserved
  - targetFactsAvailable
receipts:
  - cloneReceipt
  - mutationReceipt
  - checkReceipt
```

## Mapping Back To Current Primitives

```text
Creator = simple human intent.
Variant Creator contract = formal YAML/object model.
cub variant create + labels + targets + gates + checks = execution substrate.
AX/FX = same contract, different surface.
```

That is much easier to follow than asking a human to learn the whole CLI
choreography first. The CLI can remain accurate and powerful, but the product
narrative should be "extend this base safely," not "assemble the primitive
sequence by hand."
