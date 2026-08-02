# How ConfigHub delivers configuration through OCI

**UNOFFICIAL/EXPERIMENTAL.** This page explains the path from a Helm chart or
another source package to a running Kubernetes configuration.

The short version is: **source package in, managed configuration in ConfigHub,
release OCI out**. Delivery uses the Kubernetes objects that were reviewed in
ConfigHub. It does not render the Helm chart again.

## Three ConfigHub terms

- A **Component** is the software and all the configurations that belong to it.
- A **Variant** is one complete configuration. A base variant is the shared
  starting point. A deployment variant is the configuration for one
  environment, region, customer, or other operating context.
- A **Target** says where a deployment variant is intended to run. It is an
  address for delivery, not a connection from ConfigHub into the cluster.

## The path, end to end

1. **Choose and render a source.** For Helm, `cub installer` pulls a public
   installer-package OCI and selects one preset configuration. AICR and other
   sources have their own generation step.
2. **Check the Kubernetes objects.** The result is ordinary Kubernetes YAML.
   You can inspect it before signing up for ConfigHub.
3. **Upload the exact objects as a base variant.** Each object becomes a
   ConfigHub Unit. The source record keeps the chart version, values,
   assumptions, prerequisites, and lifecycle work beside those Units.
4. **Create and review deployment variants.** Bind each deployment variant to
   a Target. ConfigHub can show diffs, run checks, require approval, and
   promote a revision through environments.
5. **Publish one release OCI.** `cub release publish <space>` packages the
   reviewed Units in that Space. The current pull URL has this form:
   `oci://oci.hub.confighub.com:443/space/<space>`.
6. **Deliver without rendering again.** Argo CD or Flux pulls that release OCI
   and applies the same Kubernetes objects. A separate direct local test can
   pull and apply the artifact to check that it is portable.

## The two OCI artifacts are different

| Artifact | What it contains | When it is used |
| --- | --- | --- |
| Installer-package OCI | A chart plus preset configurations, values, and supporting files | Before ConfigHub, when a user chooses and renders a configuration |
| ConfigHub Space release OCI | The exact reviewed Units from one ConfigHub Space | After review, when Argo CD or Flux delivers the configuration; a local test can also pull it directly |

An installer package may offer several preset configurations. A Space release
contains one selected and reviewed configuration. Do not use an installer
package URL as if it were a Space release URL.

## Publishing and consuming a Space release

`cub cluster up` creates a temporary kind cluster, installs Argo CD, and creates
the ConfigHub Space and OCI target used by the cluster:

```sh
cub auth login
cub cluster up --name myrig --space myrig-cluster
```

This is the current command. Older evidence may contain
`cub-lk-kind-vanilla`, which is a historical target-class name rather than an
instruction to install or run another tool.

After uploading an application's Kubernetes objects to a Space, set that
Space's release target and publish it:

```sh
cub space update my-app --release-target myrig-cluster/oci
cub release publish my-app
```

You can inspect the stored Kubernetes configuration before publishing it:

```sh
cub k8s types --space my-app
cub k8s get deploy --space my-app
cub k8s get all --space my-app --show data
```

These commands read the desired configuration stored in ConfigHub. They do not
read live cluster state.

Argo CD reads the published release with an OCI source:

```yaml
source:
  repoURL: oci://oci.hub.confighub.com:443/space/my-app
  targetRevision: latest
  path: .
```

Flux uses the same Space release:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 1m
  url: oci://oci.hub.confighub.com:443/space/my-app
  ref:
    tag: latest
  secretRef:
    name: confighub-oci
```

When the test is finished:

```sh
cub cluster down --name myrig --force
```

## Hooks, CRDs, and other setup work

Some charts need more than an ordinary apply. A CRD may need to exist before a
custom resource. A setup Job may need to finish before the main workload. A
webhook may need a certificate.

The catalog records that work with the selected base instead of hiding it in a
Helm hook annotation. Each supported delivery path must say how it performs the
step, how it waits, and what receipt proves completion. Users can still use
hooks and chart-specific setup; ConfigHub makes those decisions visible and
repeatable.

See [What happens to Helm hooks](chart-hooks-what-happens.md) and
[Target prerequisites](target-prerequisites.md).

## Direct local apply

A release OCI is portable, so `oras` and `kubectl` can consume it in a local or
CI test. ConfigHub's managed delivery path is pull-based through Argo CD or
Flux. A plain `kubectl apply` does not by itself solve every installation and
upgrade case.

| Case | What a safe direct path must do |
| --- | --- |
| CRDs and custom resources are in one release | Apply CRDs first, wait for them, then apply dependent objects |
| An upgrade removes an object | Prune the removed object under an explicit ownership rule |
| A live edit conflicts with reviewed configuration | Show the choice: keep live, accept desired, or force the reviewed change |

Argo CD or Flux is the long-running path because the controller can own
reconciliation and pruning. Pruning still has to be enabled and tested: Argo
CD automated pruning is off by default, and a Flux Kustomization needs
`spec.prune: true`. Direct apply remains useful for a controlled test or an
environment that does not run a GitOps controller.

## Credentials

Delivery credentials and application Secrets are separate.

**OCI pull credentials** let Argo CD or Flux read a private ConfigHub Space
release. `cub cluster up` installs the Argo CD pull Secret. A Flux test copies
the same credential into `flux-system` without printing it or placing it on a
command line.

**Application Secrets** belong to the workload. A preset may render a Secret,
refer to an existing Secret, or declare that the target must provide one.
Those choices are part of the source record and target prerequisites, not the
OCI registry login.

## What has been proved

Two receipts cover different claims:

- The [routed-hook delivery proof](../../data/oci-hook-delivery-proof/summary.md)
  shows that Argo CD and Flux can consume one ConfigHub release OCI and
  complete the same setup Job. A separate direct local test consumed the same
  artifact and completed the Job.
- The [NGINX catalog delivery proof](../../data/catalog-oci-delivery-proof/summary.md)
  starts from the real `bitnami/nginx@24.0.2` `http-clusterip` preset. It checks
  that `cub installer` reproduces the committed objects, publishes those Units
  once, and records the same release digest under Argo CD and Flux. A separate
  direct local test records the same digest.

The NGINX receipt is the first exact catalog-base result. It does not prove
delivery for every chart or preset. Each additional catalog configuration
needs its own receipt before its page can make the same claim.

Maintainers can rerun that exact test in a scratch ConfigHub organization:

```sh
CUB_CONTEXT=<scratch-context> \
HELM_EXPT_ALLOW_SCRATCH_ORG=1 \
npm run catalog-oci:proof
```
