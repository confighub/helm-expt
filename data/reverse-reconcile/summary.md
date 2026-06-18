# Reverse-Reconcile Receipts (move 2, design)

Generated rollup of `ReverseReconcileReceipt` design examples. Each row is machine-checked by `scripts/verify-reverse-reconcile.mjs`: **authorized** (default-deny policy), **bounded** (only authorized fields changed), **round-trip closed** (desired-after == observed live value, no residual drift), attributed, and honestly scoped.

This is a **design** for move 2 in [#974](https://github.com/confighub/helm-expt/issues/974): the reverse live-to-desired direction. The live observation is a fixture and the write-back is manual; the named frontier is the gated `cub` reverse-reconcile command. See [the design doc](../../docs/user/reverse-reconcile-design.md) and [the authority policy](authority-policy.yaml).

| Receipt | Chart | Env | Accepted change | Authority | Bounded | Round-trip | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `redis-prod-us-east-replica-incident` | bitnami/redis@25.5.3 | prod-us-east | `replica.replicaCount: 3 -> 4` | allow | yes | closed | design-example |

## Regenerate

~~~sh
npm run reverse-reconcile:generate
npm run reverse-reconcile:verify
~~~
