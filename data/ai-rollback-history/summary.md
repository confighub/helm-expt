# Can I roll back to exactly what ran before?

An operator asks a spine question about bitnami/redis. The assistant answers
yes and points at the retained revisions; the gate checks that against the committed
receipt of the live Upgrade App rollback, so the answer rests on a rollback that
actually ran.

## The answer: yes, to exact revisions

- A retained change set, `rollback-to-25-5-3`, restored 14 units
  to their exact pre-upgrade revisions (revision 4),
  moving the chart from 27.0.0 back to 25.5.3.
- The change set is Closed, and 1 unit that did
  not change was left alone.
- The restored result was published as its own immutable OCI and reconciled on the
  same two clusters, so the rollback is exact objects, not a fresh re-render.

## The gate

- The rollback restores to the claimed target version.
- It restores the claimed number of units.
- Its change set is complete.
- It is the claimed change set.

The self-test mutates the claim three ways, a wrong target version, a wrong restored
count, and a wrong change set, and confirms the gate rejects each. So the claim is the
answer, and the rollback receipt is the authority.

## The limit

This restores the desired Kubernetes objects to exact prior revisions. It does not
reverse database data or an irreversible migration, which object rollback cannot see.
The live run and its two-cluster evidence are the Upgrade App proof this points to.

## Open the evidence

- [The rollback facts the gate derived](./rollback-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-rollback-history.yaml)
- [The live Upgrade App rollback](../redis-upgrade-app-proof/summary.md)

Run:

```bash
npm run ai-rollback-history:verify
npm run ai-rollback-history:self-test
```
