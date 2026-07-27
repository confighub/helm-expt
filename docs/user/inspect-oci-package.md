# Inspect an existing OCI package

An OCI reference does not tell you whether it contains a Helm chart, a set of
Kubernetes objects, or files for another tool. Inspect the package before choosing
how to use it.

This command needs [ORAS](https://oras.land/docs/installation/). It does not need a
ConfigHub account, ConfigHub Server, or a Kubernetes cluster:

```sh
npm run oci:inspect -- oci://REGISTRY/REPOSITORY:TAG
```

The report resolves the package to an immutable digest, identifies the package role,
lists its layers, and checks any readable Kubernetes YAML or JSON. It reports object
kinds, namespaces, CRDs, Helm hook annotations, Jobs, Secrets, duplicate object
identities, and common unfinished-value markers. Use `--json` or `--report FILE` when
another tool needs the result.

## Inspect literal Kubernetes configuration

The committed AICR example contains 17 Argo CD `Application` objects:

```sh
npm run oci:inspect -- \
  oci-layout:examples/aicr/eks-h100-training-kubeflow/oci-layouts/argocd-config:0.14.0
```

The committed Kubara example contains 77 objects in one YAML layer. Its report names
three CRDs, four remaining Helm hook annotations, one Job, and two Secrets:

```sh
npm run oci:inspect -- \
  oci-layout:examples/kubara/local-platform/oci-layout:0.12.0-local
```

Pass an empty directory when you also want to keep the pulled files:

```sh
npm run oci:inspect -- OCI_REFERENCE --work-dir ./oci-inspection
```

Nothing is applied to Kubernetes.

## Inspect a cub installer package

A cub installer package is a source package. It can hold several ready-made configs,
but it does not contain one final set of Kubernetes objects until you choose and
render a config.

Inspect and render the public NGINX package at its recorded digest:

```sh
npm run oci:inspect -- \
  oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx@sha256:08947210de607a6b9b8e7b8423b024e3fe89a0fc2b09581f80e2401008e445a1 \
  --render \
  --base http-clusterip \
  --namespace nginx \
  --work-dir ./nginx-inspection
```

The command first reads `installer.yaml`, then renders the selected config with
`cub installer`. The report shows the available configs, package documentation,
requirements that must exist before install, and the six Kubernetes objects produced
by this config. It does not apply them.

Use `--render` only for packages identified as `cub installer source package`. A Helm
chart OCI still needs its release name, namespace, values, and Kubernetes capability
assumptions. Render those inputs with Helm or the chart's recorded catalog path before
expecting literal Kubernetes objects.

## Read the result

The report keeps four questions separate:

| Question | Where to look |
| --- | --- |
| What package did I receive? | Reference, resolved digest, package role, artifact type, and layers. |
| What Kubernetes configuration is present? | Object count, kinds, namespaces, and source files. |
| What may need special handling? | CRDs, hook annotations, Jobs, Secrets, requirements, and companion records. |
| Did the basic checks pass? | Parse result, duplicate identities, and unfinished-value markers. |

These are package and object checks. They do not prove that a cluster will admit the
objects, that Argo CD or Flux will reconcile them, that the workload will become
healthy, or that the package is signed by an owner you trust. Use the package's
delivery receipts and target-specific checks for those claims.

## Repository verification

The checked example reports are in
[data/oci-inspection](../../data/oci-inspection/summary.md).

```sh
npm run oci:inspect:verify
```

That command is network-free. It reopens the committed AICR, Kubara, and Helm-source
OCI layouts. It checks the committed public NGINX report against the publication
receipt, installer definition, and recorded render.

To pull and render the public NGINX package again:

```sh
npm run oci:inspect:verify-live
```

The broader [serverless guide](./serverless-mode.md) shows where OCI inspection can
sit before or after packaging, and how reviewed files can continue to GitOps or
ConfigHub.
