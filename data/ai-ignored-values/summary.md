# I set a value. Why did the rendered object not change?

A Helm user supplies values to bitnami/redis 25.5.3 and some do not take
effect. The assistant does the easy part, saying which values reached the render and
which did not; the gate does the safe part, refusing to call a value effective when
its literal is absent, or ignored when it is present.

## Reached the render

- `image.registry=docker.io`
- `auth.existingSecret=redis-existing-secret`

## Did not reach the render, so they were ignored

- `commonLabel.team=team-checkout` The correct path is `commonLabels.team`.
- `sidecarResources.requests.cpu=sidecar-cpu-750m`

Each ignored value was accepted by Helm but never used by the chart, because the key
is misspelled, on the wrong path, or a field the chart does not expose. Helm does not
warn, so the render simply does not change.

## The gate

- Every value the answer calls effective appears in the committed render.
- Every value the answer calls ignored is absent from the committed render.

The self-test flips one label each way, an effective value relabelled ignored and an
ignored value relabelled effective, and confirms the gate rejects both. So the answer
is the assistant, and the render is the authority.

## The limit

This proves reachability against one committed render. The full method removes each
key and re-renders to confirm the object set is unchanged. A value whose literal
never reaches the render was certainly not used; this slice is the deterministic part
of that method, with no live render.

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
