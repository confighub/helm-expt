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

## What Is Free To Try

The public lane is for low-friction use of public chart bases:

- browse chart versions, base variants, proof status, pain reports, and gaps;
- run `cub installer setup --pull <package> --base <base>`;
- inspect rendered objects, receipts, scans, and current proof status;
- verify locally with the repo's proof and live-test commands.

The first path should feel closer to `helm install redis` than to a platform
migration.

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
- 100 charts have recipe/package proof artifacts;
- 156 chart/base rows have render parity against regular Helm;
- local, GitOps, parity, lifecycle, and production support lanes are tracked
  separately.

A green render check is not a production support claim. Production support
requires a target-scoped decision and fresh receipts. The current path from
review-ready to supported is described in
[Production Support Decisions](./production-support-decisions.md).

The catalog is also meant to expose hard cases. For example, the strict
cub-scout witness found Kubernetes 1.30 CRD capability issues in cert-manager
and External Secrets: workloads converged, but strict rendered-object/live
parity blocked because live CRDs omitted rendered `selectableFields` fields.

That is the point of the model: tell the user what is true, what is watch, what
is blocked, and what decision is needed next.

## Next

- [Catalog dashboard](../../site/index.html)
- [Static offering page](../../site/offering.html)
- [What You Get](./what-you-get.md)
- [Choosing Commands](./choosing-commands.md)
- [Current Proof Status](./current-proof-status.md)
