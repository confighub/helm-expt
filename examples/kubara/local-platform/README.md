# Kubara local platform example

Kubara turns one platform description into the Helm charts and cluster-specific
values that Argo CD uses to run a Kubernetes platform. This example uses Kubara
v0.12.0's local evaluation profile. It enables Argo CD, cert-manager, External
Secrets, a small portal, Prometheus, Metrics Server, and Traefik for one test
cluster.

ConfigHub does not replace Kubara. Kubara decides which platform services belong
together and generates their source configuration. ConfigHub can keep the exact
rendered objects as a base variant, show changes between cluster classes, apply
policy, and promote a reviewed platform change through a fleet.

This Space requires approval before apply because it changes cluster-wide
platform configuration, even when the target is not production.

## What is here

- `source/config.yaml` is the Kubara platform description.
- `source/values-helm-expt-paths.yaml` is a normal Kubara values override. It
  points the generated Argo CD ApplicationSets at this example's committed
  directories.
- `source/values-homer-links.yaml` replaces the generated portal's placeholder
  link with a useful project link. Kubara and Argo CD load it through the
  normal `values-*.yaml` convention.
- `catalog-alignment.yaml` maps every exact Kubara-selected public dependency
  and first-party component against the current ConfigHub Catalog. It records
  missing upstream packages and Kubara compatibility profiles, verified upstream
  digests, every older retained version, the future adapter contract, and the
  additive-only rule.
- `generated/` is the Helm source and cluster values produced by Kubara v0.12.0.
- `rendered/release-objects.yaml` is the exact 77-object render of the generated
  Argo CD chart.
- `route-intent.yaml` records the CRDs, Helm hook Job, External Secrets
  prerequisite, and two rendered Secrets that need special handling.
- `oci-layout/` contains the same literal render as a local OCI artifact.
- `generation-receipt.yaml` states what ran and what has not run.
- `confighub-upload-receipt.yaml` records the live Space, Unit, source digest,
  omitted Secrets, and approval required for cluster-wide system configuration.
- `../../../runs/kubara-oci-delivery-proof/receipt.yaml` records approval, ordered
  route work, portable OCI delivery, Argo CD reconciliation, Metrics Server health,
  and cleanup.

The temporary `.env` used by Kubara is not committed. It contained only local
evaluation placeholders, but it is still treated as a credential file.

## Why the route record matters

The rendered file is not the whole installation procedure.

Argo CD custom resources need three CRDs first. The upstream Argo CD chart also
uses a pre-install and pre-upgrade Job to create its Redis Secret. A
`ClusterExternalSecret` needs the External Secrets CRD and a working
`ClusterSecretStore`. Finally, `cub variant upload` deliberately leaves Secret
objects out of ConfigHub.

Those requirements are recorded beside the render so an operator or an
automation can perform them in the right order and keep a receipt. They are not
described as ordinary objects that can be applied in any order.

## Reproduce it

Download Kubara v0.12.0 and verify the release checksum in `source-lock.yaml`.
Then run:

```bash
KUBARA_BIN=/path/to/kubara \
  npm run kubara-example:generate

npm run kubara-example:verify
```

The generator creates a temporary `.env`, runs `kubara generate --helm`, builds
the pinned Argo CD chart dependencies, renders the chart, and creates the local
OCI layout. It also renders the downstream Homer chart with both values files
to prove that the override replaces Kubara's generated placeholder. It removes
the temporary directory when it finishes.

## Show the adapted four-cluster organization shape

The live proof organization mirrors `source/config.yaml` as the untargeted
`hx-platform/platform-contract` Unit. This proof does not publish its Space. An
exact label plan groups all existing proof Spaces with `ExampleCohort`, reserves
`KubaraVersion` for Kubara-derived surfaces, separates definitions from target
instances, and gives lifecycle, prerequisite, wiring, and platform-binding
surfaces distinct roles. The plan is offline; apply and live verification require
the active `cub` context to name the `Kubara` organization.

```bash
npm run kubara-org-shape:plan
npm run kubara-org-shape:apply
npm run kubara-org-shape:verify
npm run kubara-org-shape:receipt-verify
```

The script uses an explicit 53-Space allowlist and performs only Unit
create/update and exact reconciliation of labels it owns. Re-running it makes no
live change after convergence; each apply refreshes the observation timestamp in the
[receipt](../../../runs/kubara-org-shape-proof/receipt.yaml). That receipt proves
the mapping; it does not claim to rebuild the historical four-cluster platform.

## Kubara-native one-cluster delivery result

Generation, Helm rendering, route analysis, local OCI packaging, and ConfigHub
upload have run. The demo org stores all 75 non-Secret objects in one Unit because
it had reached its Link quota; the two rendered Secrets were omitted as the command
promises. ConfigHub required approval and published a private release.

The live delivery proof installed the Argo CD CRDs first, supplied the target-owned
Secrets, ran the Redis initializer, and packaged 69 prepared objects as a portable
OCI. Bootstrap Argo CD reconciled that exact digest. Kubara Argo CD became ready and
created one Metrics Server Application, which became Synced and Healthy.

The test used one kind cluster, one selected service, and a temporary OCI registry.
The `ClusterExternalSecret` and gRPC Ingress were deferred because their controllers
and target data were not present. The full seven-service profile and a multi-cluster
promotion wave have not run.
