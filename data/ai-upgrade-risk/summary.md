# Can I upgrade this chart without breaking production?

An application team asks a spine question in the demand sample. Production runs
25.5.3 and the candidate is 27.0.0, both committed renders
of bitnami/redis. The assistant does the easy part, naming the breaking signals; the
gate does the safe part, refusing to invent a hazard or miss one.

## The verdict: low

- Objects removed by the upgrade: none.
- Objects whose immutable fields change (selector, service name, volume claim
  templates): none.
- Objects whose container image changes: none.

None of the breaking signals fire, so the upgrade applies in place. The candidate
still changes objects, but only in ways Kubernetes accepts on a running workload,
which is why the live Upgrade App proof reconciled the same upgrade on two clusters
without recreation.

## The gate

- Every removed, immutable-changed, and image-changed object the answer lists is
  present in the derived risk.
- Every such object the derivation finds is present in the answer.
- The verdict matches the derived verdict, so a low-risk upgrade cannot be reported
  as elevated, or the reverse.

The self-test mutates the answer three ways, an invented immutable change, an
invented removed object, and a flipped verdict, and confirms the gate rejects each.
So the answer is the assistant, and the two renders are the authority.

## The limit

This reads two committed desired-configuration renders. It does not run the upgrade
or inspect a live cluster, and it does not judge in-application data migrations,
which object comparison cannot see.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The risk facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-upgrade-risk.yaml)
- [Current render](../../recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml)
- [Candidate render](../../recipes/bitnami/redis/27.0.0/revisions/default/r001/rendered/release-objects.yaml)
- [The live Upgrade App proof](../redis-upgrade-app-proof/summary.md)

Run:

```bash
npm run ai-upgrade-risk:verify
npm run ai-upgrade-risk:self-test
```
