# Kube Prometheus Stack default package upgrade

This test answers one question: can the maintained `default` package move from
`85.3.3` to `86.1.0` while running the chart-specific
CRD and admission-webhook work in a visible order?

For this exact version pair and kind target, the result is **pass**.

## What ran

1. Render the two maintained installer packages and match each object set to its committed chart render.
2. Install 10 CRDs before the 124 85.3.3 objects.
3. Create the admission Secret, apply the workload, patch the webhooks, check 6 workloads, and remove the temporary Jobs.
4. Apply the 86.1.0 CRDs, keep the existing admission Secret, apply the candidate objects, rerun the webhook step, and repeat the checks.

| Comparison | Count |
| --- | ---: |
| Current objects | 124 |
| Candidate objects | 124 |
| Added | 0 |
| Removed | 0 |
| Changed | 105 |
| Unchanged | 19 |

The operator reports chart label `kube-prometheus-stack-86.1.0` after the
upgrade. The admission Secret kept the same Kubernetes UID.

## Boundary

This is a direct package-route test on one throwaway kind cluster. It does not
claim that ConfigHub selects the route automatically, or that this default path
has been repeated through Argo CD, Flux, rollback, production, or other values.

Receipt: [`runs/kps-default-package-upgrade-proof/receipt.yaml`](../../runs/kps-default-package-upgrade-proof/receipt.yaml).
