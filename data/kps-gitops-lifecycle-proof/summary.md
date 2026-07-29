# Kube Prometheus Stack through Argo CD and Flux

This test installs the public `prometheus-community/kube-prometheus-stack@85.3.3` `no-crds` preset, then
upgrades it to `86.1.0`. The result is **pass**.

`cub installer setup --output-oci` wrote and read back both selected
non-secret configurations. The 85.3.3 output contained
113 files at object-set digest
`sha256:e536005bf01a5aa0cd2dba5dcbfa1917c84e80341a2eae8f5bcbd0440d276b39`; the 86.1.0 output
contained 113 files at
`sha256:ab82bd85549b650c4b2b2ff26258e0b39e69247a22ce7bcc51553186b22fb6bc`.

A chart-specific step then added the work Helm normally performs around those
objects. The install OCI is
`oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-kube-prometheus-stack-staged:85.3.3-no-crds@sha256:0e37d8b94457ff9f13b77fd5898a18981cfbc4c8f879fc45e07bf2e306ad9e59`
and the upgrade OCI is
`oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-kube-prometheus-stack-staged:86.1.0-no-crds@sha256:f1213d6e8ce657b672bd341eb266d89ac95908d674df1375f9e0eef4dd787513`.
Each contains four paths:

1. `stages/crds` creates the Namespace and establishes ten CRDs.
2. `stages/prepare` runs the chart's certificate creation Job.
3. `stages/workload` applies the 112 non-secret chart objects.
4. `stages/finish` runs the chart's webhook patch Job.

Argo CD uses sync waves from the root kustomization. Flux uses one
`OCIRepository` and four `Kustomization` objects joined with `dependsOn`.
Each controller ran on its own fresh cluster. It installed the first digest,
removed the two completed hook Jobs before replacement, moved to the second
digest, and reran the four stages.

| Controller | Install digest | Install stages | Upgrade digest | Upgrade stages | Checks after upgrade | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Argo CD | `sha256:0e37d8b94457ff9f13b77fd5898a18981cfbc4c8f879fc45e07bf2e306ad9e59` | crds: pass; prepare: pass; workload: pass; finish: pass | `sha256:f1213d6e8ce657b672bd341eb266d89ac95908d674df1375f9e0eef4dd787513` | crds: pass; prepare: pass; workload: pass; finish: pass | pass | pass |
| Flux | `sha256:0e37d8b94457ff9f13b77fd5898a18981cfbc4c8f879fc45e07bf2e306ad9e59` | crds: pass; prepare: pass; workload: pass; finish: pass | `sha256:f1213d6e8ce657b672bd341eb266d89ac95908d674df1375f9e0eef4dd787513` | crds: pass; prepare: pass; workload: pass; finish: pass | pass | pass |

Each passing upgrade result means the ten updated CRDs were Established, the
chart's replacement create and patch Jobs completed, the admission Secret
contained `ca`, `cert`, and `key`, all three webhook CA bundles matched,
the operator Service had a ready endpoint, a server-side dry run passed, and
the six named workloads were ready.

## Secrets

Neither rendered OCI nor either staged delivery OCI contains Secret objects.
The Alertmanager configuration Secret and a fresh Grafana credential were
supplied separately to each throwaway cluster. Their names and required keys
are recorded; their values are not.

## Limits

- This proves the named 85.3.3 to 86.1.0 path, preset, artifact
  digests, and controllers. It does not prove other versions or values.
- It proves removal before hook-Job replacement. Automatic post-success cleanup,
  rollback, long-running soak, and wider stored-object migration remain open.
- The route is explicit and repeatable, but ConfigHub does not yet select it
  automatically.
- Receipt: `runs/kps-gitops-lifecycle-proof/receipt.yaml`.
