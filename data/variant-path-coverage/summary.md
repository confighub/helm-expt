# Variant Path Coverage

This generated report tracks proof status at the chart, base-variant, and
variant-path level. It exists because Helm quirks do not always belong to the
whole chart. Some appear only in a base variant, a diff between bases, a derived
ConfigHub variant, or an upgrade/customization path.

## Rows By Path Type

- base-to-base-diff: 2
- base-variant: 189
- derived-confighub-variant: 10
- upgrade-simulation: 4

## Path Type Meanings

| Path type | Meaning |
| --- | --- |
| `base-variant` | A render-time `cub installer` base. This is where Helm values, CRDs, topology, storage, generated-vs-existing Secret choices, and other object-shape changes belong. |
| `base-to-base-diff` | A comparison between two rendered bases. Use it to see what a variant changes before treating it as a deployable choice. |
| `derived-confighub-variant` | A post-render ConfigHub variant created from an uploaded base. It should not hide a Helm rerender. |
| `upgrade-simulation` | A simulated change path. It records expected consequences but is not live operation proof. |

## Rows By Live Status

- blocked: 34
- fail: 23
- not-attempted: 10
- not-tested: 4
- not-tested-by-diff: 2
- pass: 130
- watch: 2

## Live Status Meanings

| Live status | Meaning |
| --- | --- |
| `pass` | At least one live lane for this exact path passed. Check the row to see which lane and receipt. |
| `missing` | No committed live receipt exists for this exact path yet. This is backlog, not failure. |
| `blocked` | A committed receipt exists and recorded a prerequisite, runtime, or infrastructure block. Inspect the receipt before changing the recipe. |
| `watch` | A committed receipt exists and object parity or sync was not the problem, but readiness or target behavior still needs review. |
| `not-attempted` | The row is an intended derived-variant path without target-bound live evidence in this matrix. |
| `not-tested` | The row is a simulated operation path, not a live operation run. |
| `not-tested-by-diff` | The row is a diff; live evidence belongs to the base variants, not the diff artifact. |

## First Non-Pass Rows With Receipts Or Explicit Scope

| Chart | Path | Type | Live status | Remaining gap |
| --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | `no-crds` | base-variant | blocked | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `argo-cd/argo-workflows@1.0.14` | `controller-default-reviewed` | base-variant | fail | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `argo-cd/argo-workflows@1.0.14` | `default` | base-variant | fail | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | `default` | base-variant | blocked | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | `no-crds` | base-variant | blocked | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | `default` | base-variant | fail | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `bitnami/apache@11.4.29` | `default` | base-variant | blocked | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `bitnami/contour@21.1.4` | `default` | base-variant | blocked | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `bitnami/contour@21.1.4` | `no-crds` | base-variant | blocked | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `bitnami/elasticsearch@22.1.6` | `default` | base-variant | fail | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `bitnami/elasticsearch@22.1.6` | `ha` | base-variant | fail | confighub_upload_variant_scan_safe_ops;local_kind_kubectl_apply;confighub_oci_argo_live;live_helm_vs_confighub_dual_compare |
| `bitnami/nginx@24.0.2` | `customer-acme-prod` | derived-confighub-variant | not-attempted | target/live evidence may be separate |

## How To Use This Matrix

Open [coverage-matrix.csv](./coverage-matrix.csv) when asking:

- which base variants have render and installer proof;
- which diffs introduce target facts or object-shape changes;
- which derived variants are post-render ConfigHub changes;
- which upgrade or rollback paths are simulated rather than live-proven;
- which rows still need GitOps or live evidence.

This matrix does not replace per-chart receipts. It points to them.

## Regenerate

~~~sh
npm run variant-paths:generate
npm run variant-paths:verify
~~~
