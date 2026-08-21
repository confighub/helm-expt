# AICR platform variant parity

An AI can suggest a platform change. This gate decides whether the suggestion
changed only the field the operator asked for, in exactly the Applications the
catalog says that field controls.

The accepted example changes the CPU starter's Prometheus StorageClass from
`gp3` to `standard`. The object set stays at 7,
only `kube-prometheus-stack` changes, and the only changed field is
`spec.source.helm.values::prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName`.

The refused example asks for the same StorageClass change but also moves the
Application to another namespace. The extra edit looks valid as YAML, but it was
not requested and is outside the selected control point, so no candidate file is
written.

| Request | Result | Object identities | Declared reach | Exact fields |
| --- | --- | --- | --- | --- |
| `cpu-starter-standard-storage` | **pass** | pass | pass | pass |
| `cpu-starter-overbroad-storage` | **refused** | pass | pass | refused |

## Files

- [Accepted request](../../examples/aicr/platform-variants/cpu-starter-standard-storage.yaml)
- [Accepted candidate](./cpu-starter-standard-storage.yaml)
- [Accepted receipt](../../runs/aicr-platform-variant/accepted-receipt.yaml)
- [Refused request](../../examples/aicr/platform-variants/cpu-starter-overbroad-storage.yaml)
- [Refused receipt](../../runs/aicr-platform-variant/refused-receipt.yaml)
- [Control-point record](../../examples/aicr/control-points/cpu-starter.yaml)

## Boundary

This is a configuration check. It does not contact ConfigHub or Kubernetes and
does not run a GPU workload. An accepted candidate may be kept as files or OCI,
or retained as a ConfigHub variant for review and promotion. Deployment and
workload evidence remain separate.
