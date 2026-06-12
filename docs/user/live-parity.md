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

The repo tracks two live parity lanes. The two-cluster lane includes all
top-20 bases plus a small next80 expansion set. The selected live
Helm-vs-ConfigHub lane focuses on rows where ConfigHub delivery through OCI/Argo
also matters.

| Lane | Current result | What it means |
| --- | --- | --- |
| Selected live Helm-vs-ConfigHub comparison | 36 pass, 2 watch, 0 blocked | Selected top-20 and nearby rows compare regular Helm against ConfigHub direct apply and ConfigHub OCI/Argo delivery paths. |
| Two-cluster kind parity for all top-20 bases | 42 pass, 0 watch, 0 blocked, 0 semantic parity defects | Regular Helm runs in one vanilla kind cluster and `cub installer` output runs in another. |
| Broader two-cluster kind parity corpus | 70 pass, 0 watch, 0 blocked, 0 semantic parity defects | The same two-cluster method has moved into selected next80 proof-grade charts. |

Use the generated reports for exact rows:

- [Live Helm-vs-ConfigHub Parity](../../data/live-helm-confighub-compare/summary.md)
- [Two-Cluster Kind Parity](../../data/live-kind-parity/summary.md)
- [Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md)
- [Active Proof Queue](../../data/status-dashboard/active-proof-queue.csv)

The current selected rerun queue has two active watch rows and no semantic
parity defects. Both are ingress-nginx rows where the chart's default
`Service.type=LoadBalancer` shape needs a target that can assign an external
address. Rows with target prerequisites or lifecycle behavior should cite the
matching target-fact, lifecycle, or runtime receipt rather than treating render
parity as a production claim.

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
Use the `semantic_parity`, `related_lifecycle_evidence`, and `meaning` columns
in [Two-Cluster Kind Parity](../../data/live-kind-parity/summary.md) to make
that distinction without reading the raw receipt first.

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

Some live rows require a target profile. A target profile describes a capability
of the test cluster, not a change to the chart.

| Target profile | Use it when | Example |
| --- | --- | --- |
| `kind-ingress-nginx` | A chart renders an Ingress that should be reconciled on kind. This installs a target ingress controller and proves Ingress status behavior. | `npm run live-parity:top20 -- --chart nginx --base existing-tls-ingress --target-profile kind-ingress-nginx` |
| `kind-loadbalancer` | A chart renders a `Service.type=LoadBalancer` and the test should prove the cloud-shaped Service path on kind. This uses `cloud-provider-kind`. | `npm run live-parity:top20 -- --chart ingress-nginx --base default --target-profile kind-loadbalancer` |

Use `--preflight` before starting a guarded target-profile run:

```sh
npm run live-parity:top20 -- --preflight --chart ingress-nginx --base default --target-profile kind-loadbalancer
```

`kind-loadbalancer` is deliberately guarded. `cloud-provider-kind` observes kind
clusters host-wide, so the harness refuses to start it while another kind
cluster is running. Wait for other live lanes to finish first, then run the
ingress-nginx rows serially.

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
