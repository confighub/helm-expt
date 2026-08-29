# The review approved it. Does a governed promotion carry the same bytes?

The gated upgrade-risk review approved bitnami/redis 25.5.3 to
27.0.0 as low-risk, anonymously, from committed renders.
This proof checks that the governed ConfigHub promotion recorded in the live Upgrade
App carried that exact reviewed upgrade through the environments in order, and that
the promotion bore out the verdict. It reads a real promotion receipt, so the spine
is real, not modelled.

## The handoff

- The promotion moved 25.5.3 to 27.0.0, the same
  upgrade the review approved.
- The promoted candidate is an immutable digest (sha256:f7abbebaa196...).
- The path is base -> development -> staging, and development promotes first (wave
  1) with staging behind it (wave 2).
- Both promotions passed, and the candidate plan added nothing and deleted nothing,
  which is what a low-risk verdict predicts.

So the anonymous review is the front door and the governed promotion is the spine,
and they carry the same reviewed bytes from one to the other.

## The gate

- The promotion's from and to versions are the review's from and to versions.
- The promoted candidate is an immutable digest.
- The low verdict is borne out: the promotion added and deleted nothing.
- The promotion ran base to development to staging, development before staging, both
  passing.

The self-test mutates the claim three ways, a wrong candidate version, a flipped
verdict, and a reversed path, and confirms the gate rejects each. So the claim is the
handoff, and the live promotion receipt is the authority.

## The limit

This reads the committed receipt of a promotion that already ran on throwaway
clusters. It does not run a new promotion. The live run and its evidence are the
Upgrade App proof this one points to.

## Open the evidence

- [The handoff facts the gate derived](./handoff-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-promotion-handoff.yaml)
- [The gated upgrade-risk review](../ai-upgrade-risk/summary.md)
- [The live Upgrade App promotion](../redis-upgrade-app-proof/summary.md)

Run:

```bash
npm run ai-promotion-handoff:verify
npm run ai-promotion-handoff:self-test
```
