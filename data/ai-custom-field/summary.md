# The chart does not expose the field I need. Must I fork it?

An application team needs a field on bitnami/redis 25.5.3 that the chart
exposes no value for. The assistant answers no, and proposes the smallest post-render
edit; the gate checks that the edit is real, so the answer rests on something the
render supports.

## The answer: no fork

- Keep the chart unchanged.
- Add `example.com/backup-policy: nightly` at `spec.template.metadata.annotations` on the object
  `apps/v1|StatefulSet|redis|redis-master`.
- That object exists in the render, and the field is not already there, so the edit
  adds exactly one field to one object and nothing else.

On an upgrade, this one-field edit is checked for overlap against the new render, so
a later chart change to the same object is not lost silently.

## The gate

- The target object exists in the render.
- The field is not already present where the edit would add it, so the edit is a real
  addition rather than a no-op or a collision.
- The answer concludes no fork is needed.

The self-test mutates the answer two ways, an edit that targets a missing object and
an edit that adds a field the render already carries, and confirms the gate rejects
each. So the answer is the assistant, and the render is the authority.

## The limit

Whether the chart exposes a value for this field is the premise, not something this
proof checks, because that needs the chart's values schema. What the gate proves is
that the post-render workaround is real, which is what "must I fork it?" turns on.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The edit facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-custom-field.yaml)
- [The render](../../recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml)

Run:

```bash
npm run ai-custom-field:verify
npm run ai-custom-field:self-test
```
