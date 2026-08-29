# How is this candidate different from production?

An application team asks the second most common question in the demand sample. The
candidate is the reuse-existing-secret release, and production is the default release, both
committed renders of bitnami/redis 25.5.3. The assistant does the easy part, the compare and
the plain summary; the gate does the safe part, refusing any change the two renders
do not support and refusing to miss one.

## The difference

- Production renders 14 objects, the candidate renders 13.
- Added: none.
- Removed: v1|Secret|redis|redis.
- Changed: apps/v1|StatefulSet|redis|redis-master, apps/v1|StatefulSet|redis|redis-replicas.
- Unchanged: 11.

The candidate stops generating the in-cluster Secret and reads an existing one
instead, so the generated Secret is removed and the two StatefulSets change to
reference it. Everything else is identical. This is a desired-configuration diff of
two exact object sets, kept separate from any live-cluster drift.

## The gate

- Every added, removed, and changed object the answer lists is present in the diff
  of the two renders.
- Every added, removed, and changed object the diff produces is present in the
  answer.
- Nothing is misclassified, so a changed object cannot be reported as added, and an
  unchanged object cannot be reported as changed.

The self-test mutates the answer three ways, an invented added object, a dropped
removed object, and an unchanged object relabelled as changed, and confirms the gate
rejects each. So the answer is the assistant, and the two renders are the authority.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The diff facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-config-diff.yaml)
- [Production render](../../recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml)
- [Candidate render](../../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml)

Run:

```bash
npm run ai-config-diff:verify
npm run ai-config-diff:self-test
```
