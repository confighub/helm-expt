# Live Parity

**UNOFFICIAL/EXPERIMENTAL**

Live parity answers a narrow question:

```text
Does regular Helm and the ConfigHub/cub installer path reach the same live
outcome for the same chart, version, values, and base variant?
```

It is stricter than render parity. Render parity checks YAML. Live parity checks
what happens after Kubernetes accepts the objects.

## Current Status

The repo tracks two live parity lanes.

| Lane | Current result | What it means |
| --- | --- | --- |
| Selected live Helm-vs-ConfigHub comparison | 20 pass, 0 watch, 0 blocked | The selected top-20 rows compare regular Helm against ConfigHub delivery paths. |
| Two-cluster kind parity for all top-20 bases | 34 pass, 1 watch, 7 blocked, 0 semantic parity defects | Regular Helm runs in one vanilla kind cluster and `cub installer` output runs in another. |

Use the generated reports for exact rows:

- [Live Helm-vs-ConfigHub Parity](../../data/live-helm-confighub-compare/summary.md)
- [Two-Cluster Kind Parity](../../data/live-kind-parity/summary.md)
- [Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md)

The current rerun queue has 9 non-pass rows and no semantic parity defects.
The useful next work is not one generic rerun; it is split by row type.

| Next step | Rows | What to do first |
| --- | ---: | --- |
| runtime review | 6 | Inspect readiness, waits, storage, capacity, or app initialization. |
| stage prerequisite | 1 | Stage or model CRDs, APIs, Secrets, storage, or another prerequisite. |
| lifecycle route | 1 | Choose the hook or lifecycle observation route. |
| operating policy | 1 | Record the operating-policy decision. |

## How To Read Results

| Result | Meaning |
| --- | --- |
| `pass` | The lane reached the expected live outcome for that exact chart/base row. |
| `watch` | Object parity passed, but a runtime condition still needs review, more time, or target-specific policy. |
| `blocked` | A receipt exists and the row hit a prerequisite, lifecycle, storage, hook, runtime, or operating-policy blocker. |
| `fail` | The receipt found a real failed outcome. Treat this as a defect until classified. |
| `missing` | No committed receipt exists for that exact row yet. |

The current two-cluster parity non-pass rows do not report semantic parity
defects. They point at target prerequisites, controller readiness, storage,
hooks, or operating policy.

That distinction matters. A blocked row can still prove that the model is
working: the harness found the same object set and then surfaced the real
cluster requirement that plain Helm would also leave the user to understand.

## Rerun Rule

Use the generated rerun plan:

[Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md)

Run live parity reruns serially. Do not run two live parity commands at the same
time from different terminals or agents. The harness creates and prunes
parity-owned kind clusters, so concurrent runs can delete each other's cluster
and produce a false infrastructure failure.

Current command families:

```sh
# Selected ConfigHub/OCI live comparison rows
npm run live-parity:top20 -- --from-rank <n> --to-rank <n> --continue-on-fail

# Strict two-cluster parity for one chart/base
npm run kind-parity:run -- --chart <repo/chart> --version <version> --base <base>

# Regenerate the rerun queue after receipts change
npm run live-parity:rerun-plan
```

After a live rerun, regenerate the matching summary and then the outcome/status
surfaces if the result changed.

## What Users Should Claim

Use the narrowest true claim.

| Evidence | Claim |
| --- | --- |
| Render parity only | The `cub installer` base renders equivalent Kubernetes objects under recorded inputs. |
| Local live pass | The rendered objects reached the expected state in a local Kubernetes target. |
| GitOps/OCI live pass | ConfigHub OCI was reconciled by Argo or Flux and observed. |
| Live parity pass | Regular Helm and the ConfigHub/`cub installer` path reached the same recorded live outcome. |
| Watch or blocked row | The row has useful live evidence, but it still needs the listed runtime, prerequisite, hook, storage, or policy follow-up. |

Do not say "all variants are live-proven" unless the exact chart/base rows have
passing receipts in the relevant lane.
