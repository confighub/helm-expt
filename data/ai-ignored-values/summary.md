# I set a value. Why did the rendered object not change?

The retained answer labels supplied values for bitnami/redis 25.5.3 as
effective or ignored. This check compares those labels with literal presence in
one committed render. It rejects a label that contradicts that literal check;
it does not independently establish whether the chart used the supplied key.

## Literals present (answer labels these effective)

- `image.registry=docker.io`
- `auth.existingSecret=redis-existing-secret`

## Literals absent (answer labels these ignored)

- `commonLabel.team=team-checkout` The correct path is `commonLabels.team`.
- `sidecarResources.requests.cpu=sidecar-cpu-750m`

The answer identifies a misspelled path and an unexposed field as possible causes.
This retained-render check does not run Helm, inspect template evaluation or
compare a render with and without those keys. Treat the proposed diagnosis as
something to investigate, not a causal conclusion proved by this gate.

## The gate

- Every value the answer calls effective appears in the committed render.
- Every value the answer calls ignored is absent from the committed render.

The self-test flips one label each way, an effective value relabelled ignored and an
ignored value relabelled effective, and confirms the gate rejects both. The render
is authoritative for these literal-presence observations only.

## The limit

A template can transform a value or use it to choose a branch without emitting its
literal. Conversely, the same literal can appear for an unrelated reason. Absence
does not prove a key was ignored, and presence does not prove the supplied key
caused that output.

To test influence, preserve the exact chart, dependencies, capabilities and other
inputs, then compare controlled renders with and without the key. Account for
random or environment-dependent output. Even an unchanged object set establishes
no observed effect for that tested case, not that the key is unused in every
configuration. No such rerender is recorded by this example.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The reachability facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-ignored-values.yaml)
- [The render](../../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml)

Run:

```bash
npm run ai-ignored-values:verify
npm run ai-ignored-values:self-test
```
