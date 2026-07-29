# Kube Prometheus Stack through Argo CD and Flux

This is a fresh-install test of the public
`prometheus-community/kube-prometheus-stack@85.3.3` `no-crds` preset. The result is
**pass**.

`cub installer setup --output-oci` first wrote and read back the selected
non-secret configuration. That output contained 113
files at object-set digest
`sha256:e536005bf01a5aa0cd2dba5dcbfa1917c84e80341a2eae8f5bcbd0440d276b39`.

A chart-specific step then added the work Helm normally performs around those
objects. One public OCI at
`oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-kube-prometheus-stack-staged:85.3.3-no-crds@sha256:6b4c294a8e4c481b4367f3386599488c149dc7baf4af0a880f0acc5ef0199234`
contains four paths:

1. `stages/crds` creates the Namespace and establishes ten CRDs.
2. `stages/prepare` runs the chart's certificate creation Job.
3. `stages/workload` applies the 112 non-secret chart objects.
4. `stages/finish` runs the chart's webhook patch Job.

Argo CD uses sync waves from the root kustomization. Flux uses one
`OCIRepository` and four `Kustomization` objects joined with `dependsOn`.
They ran on separate fresh clusters and requested the same OCI manifest digest.

| Controller | Digest observed | Stage results | Runtime checks | Result |
| --- | --- | --- | --- | --- |
| Argo CD | `sha256:6b4c294a8e4c481b4367f3386599488c149dc7baf4af0a880f0acc5ef0199234` | crds: pass; prepare: pass; workload: pass; finish: pass | pass | pass |
| Flux | `sha256:6b4c294a8e4c481b4367f3386599488c149dc7baf4af0a880f0acc5ef0199234` | crds: pass; prepare: pass; workload: pass; finish: pass | pass | pass |

Each passing runtime result means the ten CRDs were Established, the chart's
create and patch Jobs completed, the admission Secret contained `ca`,
`cert`, and `key`, all three webhook CA bundles matched, the operator
Service had a ready endpoint, a server-side dry run passed, and the six named
workloads were ready.

## Secrets

The rendered OCI and the staged delivery OCI contain no Secret objects. The
Alertmanager configuration Secret and a fresh Grafana credential were supplied
separately to each throwaway cluster. Their names and required keys are recorded;
their values are not.

## Limits

- This is a fresh-install receipt, not an upgrade receipt.
- It proves this chart, version, preset, artifact digest, and the two named
  controller paths. It does not prove every Helm hook.
- The route is explicit and repeatable, but ConfigHub does not yet select it
  automatically.
- Receipt: `runs/kps-gitops-lifecycle-proof/receipt.yaml`.
