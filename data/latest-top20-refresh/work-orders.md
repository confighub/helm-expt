# Latest Top-20 Work Orders

This file is a stable note for the latest top-20 refresh lane. The generated
status now lives in the refresh, promotion-readiness, and replacement-decision
reports linked below.

## What Changed

The current Helm repository snapshot shows:

```text
13 top-20 proofs are current
7 top-20 proofs have newer chart versions available
```

The newer chart versions are listed in `review.csv`, summarized in
`summary.md`, and routed by `../refresh-survival/summary.md`.

## Rule

Do not replace a supported catalog entry just because upstream Helm published a
new chart version.

The new version becomes supported only after it has:

- a new versioned recipe path;
- a new versioned `cub installer` package path;
- source and dependency locks;
- supported variants;
- rendered objects and object inventory;
- Helm-equivalence proof against regular Helm;
- scan and gate receipts;
- ConfigHub upload, scan, safe-ops, and server-side variant receipts;
- live e2e observation receipts;
- updated catalog, production-disposition, top-100, and top-500 outputs.

## Retained Candidate Wave

Proof-complete candidate paths have been retained for:

| Chart | Current proof | Retained candidate | Current latest upstream |
| --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | `9.5.17` |
| `bitnami/mongodb` | `19.0.7` | `19.0.9` | `19.1.0` |
| `bitnami/nginx` | `24.0.2` | `24.0.4` | `25.0.0` |
| `bitnami/postgresql` | `18.6.7` | `18.6.10` | `18.7.0` |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | `86.1.0` |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | `29.9.0` |

Redis also now has a newer upstream version:

```text
bitnami/redis 25.5.3 -> 27.0.0
```

It does not yet have a retained candidate proof for that newer version.

Candidate status:

```text
data/latest-top20-refresh/candidates/
npm run top20:latest-candidates:verify
npm run top20:latest-promotion-readiness:verify
npm run top20:latest-replacement-decisions:verify
```

The retained candidates have proof-complete root paths. Three are still aligned
with latest upstream; three have already been superseded by newer upstream
versions. The replacement-decision report records which case applies before any
supported catalog row changes.

## Redis Promotion Variants

Redis now has both work types:

- refresh `bitnami/redis@25.5.3` to a retained candidate for `27.0.0`;
- keep the product proof for post-render ConfigHub variant creation.

Target examples:

```text
Redis/default -> Redis/prod-us-east
Redis/default -> Redis/prod-eu-west
```

These must use `cub variant create` plus the Variant Creator contract. They must
not rerender Helm. The preview must show cloned Units, upstream links, target
assignment, changed labels/paths, target-fact status, and receipts.

## Kubara Overlay Variant

The Kubara-style example is intentionally more complex than the public catalog:

```text
managed wrapper chart
  + platform values
  + customer overlay values
  + dependency closure
  + target facts
```

The first planned golden is:

```text
ExternalDNS/managed-aws -> ExternalDNS/customer-acme-prod
```

The rule is the same as the rest of the harness:

```text
rendered-object change -> cub installer recipe/package base
post-render refinement -> ConfigHub variant Creator
```

This example should stay in the managed/commercial lane until the experience is
polished, because it requires private/customer overlay values, target facts,
approvals, gates, and receipts.
