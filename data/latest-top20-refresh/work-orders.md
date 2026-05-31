# Latest Top-20 Work Orders

This file is the human-readable companion to `variant-work-orders.yaml`.

## What Changed

The latest Helm repository snapshot shows:

```text
14 top-20 proofs are current
6 top-20 proofs have newer chart versions available
```

The newer chart versions are listed in `review.csv` and summarized in
`summary.md`.

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

## Latest Chart Version Wave

Create new proof paths for:

| Chart | Current proof | Latest chart |
| --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` |
| `bitnami/mongodb` | `19.0.7` | `19.0.9` |
| `bitnami/nginx` | `24.0.2` | `24.0.4` |
| `bitnami/postgresql` | `18.6.7` | `18.6.10` |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` |

## Redis Promotion Variants

Redis is already on the latest chart version. The next work is not a chart
update; it is a product proof for post-render ConfigHub variant creation.

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
