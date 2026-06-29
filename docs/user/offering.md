# ConfigHub Helm Catalog Offering

**UNOFFICIAL/EXPERIMENTAL**

We port popular public Helm charts to ConfigHub without changing the intended
end-to-end semantics of the supported bases.

The difference is that the install is no longer one obscure rendering step.
It is split into visible, verifiable stages:

```text
public Helm chart
-> cub installer recipe/package
-> named base variants
-> exact rendered Kubernetes objects
-> scans, gates, receipts
-> ConfigHub / OCI / GitOps / live observation
```

Helm is still the renderer. ConfigHub is the layer that makes the rendered
objects durable, comparable, promotable, and auditable.

For how this fits the broader generated-config and AI/GitOps thesis, see
[Generative GitOps Fit](./generative-gitops-fit.md).

That broader thesis is larger than this repo. `helm-expt` is the working Helm
import path into it: render public charts once, prove the captured object set,
hold it as ConfigHub data, expose base and derived variants, and then deliver
or observe selected rows through live lanes.

## Why This Helps

First, it makes changes safer. When a person or AI agent changes chart inputs,
base variants, or post-render ConfigHub variants, the pipeline can compare the
exact object set, scan it, and show the receipt trail before the change is
promoted.

Second, it keeps users closer to the chart author's supported path. Many Helm
failures come from accidentally driving a chart away from the path its authors
expected. The catalog makes supported bases explicit, records where a custom
choice belongs, and flags target or lifecycle gaps before they become
production surprises. The point is to keep the user on the right path, and to
make departures from that path visible before they become operational risk.

Render parity is the starting point, not the final product claim. It proves the
`cub installer` path preserved Helm's intended object set for the recorded
inputs. The stronger value is in the next questions: what must the target
already provide, which lifecycle action must happen before or after apply, what
did the cluster actually observe, and where does the proof stop?

For example, kube-prometheus-stack with `no-crds` is not merely "the same YAML
minus CRDs." It is a base whose success depends on compatible CRDs and admission
certificate material being present or staged. The catalog records that contract
as target facts, lifecycle evidence, and bounded receipts instead of treating a
green render as a complete install.

For a day-2 example, see
[Helm Upgrade Crash Example](./helm-upgrade-crash-example.md). It shows how a
risky chart upgrade becomes staged, reviewed, rehearsed, gated, and observed
instead of being treated as one opaque production mutation.

## What Is Free To Try

The public lane is for low-friction use of public chart bases:

- browse chart versions, base variants, proof status, pain reports, and gaps;
- run `cub installer setup --pull <package> --base <base>`;
- inspect rendered objects, receipts, scans, and current proof status;
- verify locally with the repo's proof and live-test commands.

The first path should feel closer to `helm install redis` than to a platform
migration.

For the short route picker across direct render, one-shot upload, public
catalog packages, and ConfigHub-managed operations, see
[Choose Your Path](./choose-your-path.md).

## When ConfigHub Matters

Use ConfigHub-managed workflows when you need:

- private charts, private values, or customer overlays;
- derived variants for environment, region, customer, or target;
- approvals, links, target facts, scans, gates, and receipts;
- GitOps or OCI delivery with managed proof;
- bulk scan, patch, promote, observe, and audit operations;
- full stacks, old-version support, patch SLAs, and production support.

## Current Proof Boundary

The current catalog proves a lot, but not everything:

- 20 top-chart entries have public catalog bases;
- 110 charts have recipe/package proof artifacts;
- 199 chart/base rows have render parity against regular Helm;
- 198 of those rows have the stricter in-ConfigHub proof lane marked pass;
- local, GitOps, parity, lifecycle, and production support lanes are tracked
  separately.

A green render check is not a production support claim. Production support
requires a target-scoped decision and fresh receipts. The current path from
review-ready to supported is described in
[Production Support Decisions](./production-support-decisions.md).

The same boundary applies to the broader product. Field-complete provenance,
full change authority, reverse live-to-desired flow, universal hook execution,
fleet-wide bounded propagation, and trust from signatures all remain bounded
frontiers. They are tracked in
[Current Proof Status](./current-proof-status.md#product-frontiers).

The catalog is also meant to expose hard cases. For example, the strict
cub-scout witness found Kubernetes 1.30 CRD capability issues in cert-manager
and External Secrets, and a Grafana RBAC server-normalization watch item:
workloads converged, but strict rendered-object/live parity stayed blocked
until the target behavior is modeled or accepted.

That is the point of the model: tell the user what is true, what is watch, what
is blocked, and what decision is needed next.

## Send A Problem Chart

The catalog should improve when it is challenged. If a public Helm chart breaks
the model, or if the catalog output for a supported chart does not match the
Helm behavior you expect, send the chart and the values that expose the problem
with the
[problem chart issue template](https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml).

The expected response is not a vague claim that the chart is supported. The
expected response is a public fixture and a receipt:

- `pass`: the chart works under the stated contract;
- `watch`: the main path works, but a runtime condition or extra object needs
  review;
- `blocked`: a prerequisite, lifecycle behavior, target capability, or runtime
  failure prevents a green claim;
- `refused`: the chart or option is outside the public catalog boundary, with a
  named reason.

This is part of the free public value. A hard chart is useful adversarial input.
Private charts, private values, production remediation, and fleet rollout work
belong in managed ConfigHub workflows.

## Next

- [Catalog dashboard](../../site/index.html)
- [Chart Use Guide](../../data/chart-use-guide/summary.md)
- [Static offering page](../../site/offering.html)
- [Generative GitOps Fit](./generative-gitops-fit.md)
- [Choose Your Path](./choose-your-path.md)
- [What You Get](./what-you-get.md)
- [Choosing Commands](./choosing-commands.md)
- [Helm Upgrade Crash Example](./helm-upgrade-crash-example.md)
- [Current Proof Status](./current-proof-status.md)
