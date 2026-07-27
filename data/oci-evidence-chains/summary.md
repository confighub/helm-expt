# OCI Evidence Chains

These records answer six questions in the same order for every starting format:

1. What source did we start with?
2. Which exact configuration did we review?
3. Which ConfigHub Space, Unit, or revision held it?
4. Which OCI did we publish?
5. Which controller or command consumed that OCI?
6. What did we observe on the target?

The record is companion information for people and tools. Kubernetes controllers do
not need to read it. The format is experimental while the project looks for a
compatible public standard.

## Current Coverage

5/6 source paths reach a ConfigHub-managed OCI, delivery,
and a recorded live result. AICR currently stops after ConfigHub republishes the 17
reviewed Argo CD Applications. It does not yet claim EKS, H100, controller, or GPU
workload health.

| Starting format | Example | ConfigHub record | Output OCI | Delivery | Observation | Full record |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `aicr` | AICR EKS H100 training configuration captured as 17 Argo CD Applications | yes | yes | not run | not run | [record](./records/aicr-eks-h100-training-kubeflow.yaml) |
| `cub-installer` | A public NGINX installer package rendered once and delivered three ways | yes | yes | yes | yes | [record](./records/cub-installer-nginx-three-consumers.yaml) |
| `helm` | A team-supplied NGINX chart and values, reviewed and promoted to staging | yes | yes | yes | yes | [record](./records/helm-byo-nginx-staging.yaml) |
| `kubara` | A Kubara platform configuration prepared, approved, and delivered through Argo CD | yes | yes | yes | yes | [record](./records/kubara-local-platform-argocd.yaml) |
| `rendered-config` | Literal NGINX OCI promoted through ConfigHub and rolled out to two clusters | yes | yes | yes | yes | [record](./records/rendered-config-nginx-two-cluster-fleet.yaml) |
| `sveltos` | A Sveltos Kyverno profile expanded from a pilot to two clusters | yes | yes | yes | yes | [record](./records/sveltos-kyverno-two-cluster-fleet.yaml) |

## Why The Digests Can Differ

The input OCI and the ConfigHub release OCI are different artifacts, so their
manifest digests normally differ. The chain must say whether the Kubernetes content
was unchanged, changed deliberately, or gained ConfigHub's
`confighub.com/origin` annotation.

The digest used by Argo CD or Flux must match the output OCI named by that delivery
step. A live observation is separate: it records what the cluster showed at a
particular time and, where available, when that observation expires.

## Files

- [`chains.json`](./chains.json) contains every record for tools.
- [`matrix.csv`](./matrix.csv) is a compact source-by-boundary table.
- [`records/`](./records/) contains one readable YAML record per starting format.
- [`schemas/oci-evidence-chain.schema.json`](../../schemas/oci-evidence-chain.schema.json)
  defines the record fields.

## Verify

```sh
npm run oci-evidence:verify
```

This verification is network-free. It rebuilds the six records from committed
receipts, checks their digests and links, and refuses to call the AICR path delivered
or observed before that work has actually run.
