# AI-Assisted Helm Changes

AI can change Helm values or Kubernetes YAML faster than most teams can review
the result. ConfigHub records the proposed objects, shows the exact diff, runs
the checks attached to that configuration, and keeps the approval with the
revision that was reviewed.

## What should happen

```text
AI proposes a change
ConfigHub shows the exact object diff
the configured checks run
the required person approves that revision
delivery publishes the reviewed desired state
live observation records what happened
```

AI can explain or propose the change. It must not silently rewrite live state,
skip target requirements, or hide where a value came from.

## Useful AI tasks

| Task | Why it fits |
| --- | --- |
| Explain the diff between a base and a variant | The objects are explicit and versioned. |
| Suggest a derived variant for dev, staging, prod, region, or customer | The variant can be reviewed before delivery. |
| Propose a base variant when a values file changes rendered objects | The route goes back through recipe/package proof. |
| Summarize watch and blocked rows for one chart | The matrix already names the reason and evidence. |
| Suggest a bulk patch, then preview affected Units | ConfigHub can show the planned mutation. |
| Triage a broken chart | The failure can be routed to render, target, lifecycle, image, runtime, or model gap. |

## Work that still needs control

| Task | Why it is unsafe |
| --- | --- |
| Patch the live cluster without updating desired state | The live fix may be overwritten or unaudited. |
| Invent a supported values path without a recipe receipt | The render claim becomes unproved. |
| Treat a green GitOps sync as workload health | Sync is not convergence. |
| Hide a hook, CRD install, or Secret lifecycle inside a script | The model depends on visible routes. |
| Force server-side apply conflicts without review | Manual live changes need an explicit reconcile decision. |

## Example

```text
I want prod Redis to use an existing Secret and different resource requests.
```

The AI should answer:

```text
Secret mode changes rendered objects, so use or create a base variant.
Resource requests may be a declared input, base edit, or derived ConfigHub
variant depending on whether the recipe exposes them.
Preview the object diff before delivery.
Run checks.
Approve.
Observe live result.
```

The repository also contains a complete AICR training example. The unchecked
proposal asks for eight H100 nodes on a four-node target, changes a pinned image
to `latest`, and leaves an API key placeholder. The corrected object stays
within the target limit, keeps the pinned image, and refers to an existing
Secret.

The [live ConfigHub result](../../data/ai-change-review-live-proof/summary.md)
shows that corrected object being stored, blocked until its exact revision is
approved, and dry-run again after approval. It also records the current policy
gap for custom AICR objects. Nothing was applied to Kubernetes.

The YAML, diff, check results, approval, and receipt remain available for review
whether the original suggestion came from a person, a script, or an AI agent.
