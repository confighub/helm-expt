# Why Synced Is Not Working

**UNOFFICIAL/EXPERIMENTAL**

GitOps can say an application is synced while the workload is still unusable.

This is not a bug in GitOps. It is a boundary. A controller can apply the
declared objects and still leave the operator with a missing Secret, a waiting
pod, a webhook that is not ready, or a target capability mismatch.

## The False Green

A rendered object-set check can pass when every desired object exists and every
authored field matches.

That still does not prove:

- required Secrets or other target facts exist;
- pods reached readiness;
- controller-owned status or generated data appeared;
- no unexpected objects exist outside the desired set;
- the observation is fresh enough to trust.

The cub-scout example at
[confighub/cub-scout examples/helm-expt](https://github.com/confighub/cub-scout/tree/main/examples/helm-expt)
reproduces this boundary directly.

It uses a fixture where the desired objects are present, but a required Secret
is absent. The result is:

```text
object-set-matches:   PASS
prerequisites-met:    BLOCK
workloads-converged:  BLOCK
```

The pod reaches `CreateContainerConfigError`. The object-set check was not
wrong; it was incomplete for the question "is this install working?"

## What The Catalog Adds

helm-expt separates the proof into lanes:

```text
render parity
-> ConfigHub upload and scan
-> local live apply
-> GitOps/OCI sync
-> cub-scout live witness
-> lifecycle observation
```

Each lane answers a different question. A row should only be called passed for
the lane it actually passed.

## What To Check

For a real install, check at least:

```sh
cub-scout receipt verify \
  --file <rendered-objects.yaml> \
  --scope namespace/<namespace> \
  --predicate object-set-matches \
  --ttl 1h \
  --fail-on any-non-pass

cub-scout receipt verify \
  --prerequisites <target-facts.yaml> \
  --scope namespace/<namespace> \
  --predicate prerequisites-met \
  --ttl 1h \
  --fail-on any-non-pass

cub-scout receipt verify \
  --file <rendered-objects.yaml> \
  --scope namespace/<namespace> \
  --predicate workloads-converged \
  --ttl 1h \
  --fail-on any-non-pass
```

Use [Chain Of Proof](./chain-of-proof.md) for the boundary map and
[Current Proof Status](./current-proof-status.md) for current evidence.
