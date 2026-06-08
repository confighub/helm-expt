# Prometheus High-Fanout Example

**UNOFFICIAL/EXPERIMENTAL**

`prometheus-community/kube-prometheus-stack` is a useful main-chart example
because one Helm values choice changes a large operational surface.

The catalog has two base variants:

| Base | Use it when | What changes |
| --- | --- | --- |
| `default` | This release should install the Prometheus Operator CRDs. | Renders 124 Helm objects, including 10 CRDs. |
| `no-crds` | The cluster already manages those CRDs elsewhere. | Renders 114 Helm objects and omits the 10 CRDs. |

The important point is that `no-crds` still renders Prometheus custom resources.
It only works when the target cluster already has the Prometheus Operator CRDs.
That prerequisite is part of the deployable contract.

## User Flow

Choose the base:

```text
kube-prometheus-stack/default
  install CRDs with the stack

kube-prometheus-stack/no-crds
  require CRDs to exist before delivery
```

Render one base:

```sh
cub installer setup \
  --pull packages/prometheus-community/kube-prometheus-stack/85.3.3 \
  --base no-crds \
  --work-dir .tmp/demo/kps-no-crds \
  --non-interactive \
  --namespace monitoring
```

Check the catalog and generated demo:

```sh
npm run high-fanout:verify
```

Read:

| File | Shows |
| --- | --- |
| [KPS catalog](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md) | The two bases, receipts, gates, and package links. |
| [high-fanout summary](../../data/high-fanout-demo/summary.md) | Object counts, removed CRDs, and the current GitOps/OCI prerequisite result. |
| [prometheus-kps.csv](../../data/high-fanout-demo/prometheus-kps.csv) | Spreadsheet rows for the two bases and the base-to-base delta. |

## What The Current Evidence Says

`default` has render parity and local live evidence. `no-crds` has render parity
and a GitOps/OCI receipt that blocked because the target cluster did not have the
required CRDs.

That is useful evidence. It means the model caught the prerequisite before
pretending the workload was healthy.

## Why This Matters

For high-fanout charts, a small Helm input can alter many Kubernetes objects and
cluster prerequisites. ConfigHub should make that explicit:

```text
base choice
-> rendered object set
-> prerequisites
-> scans and gates
-> delivery receipts
-> live observations
```

This is the same reason variants are more valuable than raw rendering. The user
is not just asking "can Helm template this chart?" They are asking which
deployable contract is safe for this target.
