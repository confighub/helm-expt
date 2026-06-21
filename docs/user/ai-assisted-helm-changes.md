# AI-Assisted Helm Changes

**UNOFFICIAL/EXPERIMENTAL.** AI is useful here because Helm customization can be
large, repetitive, and easy to misread. The safe path is to let AI propose
changes against explicit desired state, then make ConfigHub show, check, and
gate those changes before they reach a cluster.

## Safe Shape

```text
AI proposes a change
ConfigHub shows the exact object diff
checks and gates run
a human or policy approves
delivery publishes the reviewed desired state
live observation records what happened
```

AI should not silently rewrite live state, bypass target prerequisites, or hide
where a value came from.

## Good AI Tasks

| Task | Why it fits |
| --- | --- |
| Explain the diff between a base and a variant | The objects are explicit and versioned. |
| Suggest a derived variant for dev, staging, prod, region, or customer | The variant can be reviewed before delivery. |
| Propose a base variant when a values file changes rendered objects | The route goes back through recipe/package proof. |
| Summarize watch and blocked rows for one chart | The matrix already names the reason and evidence. |
| Suggest a bulk patch, then preview affected Units | ConfigHub can show the planned mutation. |
| Triage a broken chart | The failure can be routed to render, target, lifecycle, image, runtime, or model gap. |

## Bad AI Tasks

| Task | Why it is unsafe |
| --- | --- |
| Patch the live cluster without updating desired state | The live fix may be overwritten or unaudited. |
| Invent a supported values path without a recipe receipt | The render claim becomes unproved. |
| Treat a green GitOps sync as workload health | Sync is not convergence. |
| Hide a hook, CRD install, or Secret lifecycle inside a script | The model depends on visible routes. |
| Force server-side apply conflicts without review | Manual live changes need an explicit reconcile decision. |

## User Story

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

The important point is not that AI writes YAML. The point is that ConfigHub keeps
AI-assisted changes visible, reviewable, and bounded.

