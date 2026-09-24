# The values path I tried did not set the container field I need. Must I fork it?

An application team needs a field on bitnami/redis 25.5.3 that the chart
does not provide through the investigated values route. The assistant answers no,
and proposes the smallest post-render edit; the gate checks that the edit is real
and bound to the named Redis container.

## The answer: no fork

- Keep the chart unchanged.
- Add `terminationMessagePolicy: FallbackToLogsOnError` to the `redis` container at
  `spec.template.spec.containers` on `apps/v1|StatefulSet|redis|redis-master`.
- Applying that edit in memory changes exactly that StatefulSet and exactly one
  container field; the other 13 rendered objects are unchanged.

## The gate

- The target object exists in the render.
- The container list and named `redis` container exist at the requested
  location.
- The field is not already present on that container, so the edit is a real addition
  rather than a no-op or a collision.
- Applying the edit changes only the requested object and field in the committed render.
- The answer concludes no fork is needed.

The self-test rejects a missing target, an existing container field, a missing
container name, and a missing container-list location. So the answer is the
assistant, and the committed render is the authority for applicability.

## The limit

The source inspection used the archive pinned by
`recipes/bitnami/redis/25.5.3/source-lock.yaml` (SHA-256
`aa5360967bc1adadf69f0ce91d762f0bb4d80ca36758b37d7d8f1ef981257baf`). Its `values.yaml` (SHA-256
`57a8c24821e8a2e9566f1175b3462c489f001fa39cd4cab4244475a5d852f57e`) has no `terminationMessagePolicy` key, and
its `templates/master/application.yaml` (SHA-256 `304efe9343e0f4ea208096a4e056121e03995d8417094c8c0e4780d302abf51e`) has no
`terminationMessagePolicy` field. The template inserts
`master.extraPodSpec` at `spec.template.spec`, before its
static named container, rather than as a container-field extension.

The controlled render with `master.terminationMessagePolicy=FallbackToLogsOnError` has the same
`175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e` object-set SHA-256 and 0
changed objects as its bound baseline. This is a scoped observation about this input,
not proof that no other values route can reach the field. Inspect the chart values and
templates for the field you need; use values when a route exists, and use a post-render
edit when the selected route is not available and the edit is applicable. This static check does not test
cluster admission, deployment, upgrades or rollback.

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
