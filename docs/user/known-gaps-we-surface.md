# Known Gaps We Surface

**UNOFFICIAL/EXPERIMENTAL.** Some findings are not product wins yet. They are
useful because they are visible, named, and backed by a receipt instead of
surprising a user later.

The rule is simple:

```text
If the path is awkward, incomplete, or unsafe by default, mark it watch or
blocked and explain the route to fix it.
```

## Current Watch Findings

| Finding | Why it matters | Evidence |
| --- | --- | --- |
| Fixed placeholder credentials | A deterministic demo password is useful for repeatable renders, but it must not look like a generated production secret. | [default credential check](../../data/default-credential-check/summary.md) |
| cub-direct no prune | Plain apply does not delete objects removed from desired state. Argo CD and Flux remove omitted objects only when pruning is enabled; cub-direct needs a prune/delete-set path. | [prune gap proof](../../data/prune-gap-proof/summary.md) |
| cub-direct CRD ordering | A first install that applies CRDs and custom resources together can fail unless CRDs are installed and established first. | [CRD ordering gap](../../data/crd-ordering-gap/summary.md) |
| cub-scout drift field coverage | Drift detection is valuable, but field coverage must be stated. The current proof catches some drift and misses container env-var drift. | [drift detection gap](../../data/drift-detection-gap/summary.md) |
| SSA conflict ergonomics | Server-side apply can protect manual live edits by reporting a conflict, but the user needs a plain reconcile or force path. | [SSA conflict gap](../../data/ssa-conflict-gap/summary.md) |

## How To Read These

`watch` does not mean ignore. It means the project has evidence and a named
limitation, but should not present the path as solved.

`blocked` means the path needs a prerequisite, model change, product change, or
explicit refusal before a user should rely on it.

The useful product behavior is not pretending these gaps are gone. The useful
behavior is making them part of the workflow: visible before delivery, linked to
evidence, and routed to the next fix.
