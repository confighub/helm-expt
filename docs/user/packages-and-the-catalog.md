# Packages and the catalog

**UNOFFICIAL/EXPERIMENTAL**

This page explains what the catalog contributes to ConfigHub's packages. It
covers where its packages come from, how to install one, and how to check
one. It is written for someone who knows `cub` and has not read the rest of
this repository.

## What a package is

A ConfigHub package is a directory with an `installer.yaml` and the
Kubernetes configuration it installs. The configuration is arranged as one
or more bases, each a kustomize directory. One command installs a package:

```sh
cub package install cert-manager --space cert-manager-base --namespace cert-manager
```

That command does four things:

- It pulls the package from `ghcr.io/confighub/packages/cert-manager`.
- It asks for any inputs the package needs.
- It renders the chosen base.
- It uploads one Unit per Kubernetes resource into the Space.

Releasing those Units to a cluster is a separate step, as for any other Unit.

## Two repositories build packages

Two repositories build packages. They use the same format, the same
installer and the same registry, and `cub` installs packages from either the
same way. They differ in where a package's configuration comes from.

| Repository | Builds packages for | Takes the configuration from |
| --- | --- | --- |
| `confighub/packages` | Software whose project publishes its own install manifests: Argo CD, Flux, Sveltos | Those manifests, copied at each upstream release |
| This catalog | Software installed from a Helm chart: 124 charts, 180 chart versions | The chart, rendered with `helm template` once per base and kept as plain YAML |

The installer never runs Helm when it installs a package. A chart is rendered
when its package is built. That makes a package from this catalog plain
configuration that you can read, diff and change in ConfigHub. The
`confighub/packages` repository plans this kind of package as its "Helm
charts" milestone, and this catalog is where those packages are built.

## Finding a package's name

Each chart is published under its own chart name. For example, the
`jetstack/cert-manager` chart is installed as `cert-manager`. Three exceptions
apply:

- **Shared names:** when two chart repositories publish a chart with the same
  name, each package is named `<repository>-<chart>`. For example,
  `bitnami-redis` and `cloudpirates-redis`.
- **Unclear names:** a chart whose name means nothing without its repository
  gets a fuller name. For example, `minio-operator` and `ack-iam-controller`.
- **Reserved names:** a name another repository already publishes is never
  taken.

[`data/ghcr-packages/packages.csv`](../../data/ghcr-packages/packages.csv)
lists every name with its chart and its published versions. Each chart's
directory also holds an `upstream.yaml` with the same facts, for example
[`packages/jetstack/cert-manager/upstream.yaml`](../../packages/jetstack/cert-manager/upstream.yaml).

A package's version is its chart's version with a leading `v`. Without a
version, `cub` installs the newest. To install an older version that the
catalog keeps, name it:

```sh
cub package install cert-manager:v1.21.0 --space cert-manager-base --namespace cert-manager
```

## Argo CD comes in two packages

`argocd` and `argo-cd-helm` both install Argo CD, from different sources:

| Package | Built from | Versioned by | Bases |
| --- | --- | --- | --- |
| `argocd` | Argo CD's own install manifests | Argo CD (`v3.6.3`) | cluster, namespace-only, and a high-availability version of each |
| `argo-cd-helm` | The community argo-helm chart | The chart (`v10.7.0`) | `default`, and `no-crds` for a cluster that already has Argo CD's CRDs |

Use `argocd` unless you already run Argo CD from the argo-helm chart and want
a package that matches it.

## How a package is published

Merging a package change to this repository's `main` branch runs the
[publish workflow](../../.github/workflows/packages-publish.yml). It
publishes every package version the registry does not have yet, and it
signs each one. A version is published once and never overwritten. A
merged update therefore publishes exactly the version it added.

The signature names the workflow that published the package. To check it:

```sh
cosign verify ghcr.io/confighub/packages/cert-manager:v1.21.1 \
  --certificate-identity-regexp '^https://github.com/confighub/helm-expt/\.github/workflows/packages-publish\.yml@refs/heads/main$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

A published package is the package directory with two fields of
`installer.yaml` set:

- `metadata.name`, set to the published name. `cub` names the install's
  record after it.
- `installerMetadata.version`, set to the tag. `cub package show` reports it.

Nothing else is changed.

The same packages were published earlier to a Google registry under names
like `jetstack-cert-manager`. Those copies stay where they are, and
[Installer Package OCI Refs](installer-oci-packages.md) still describes
them.

## What the catalog adds to a package

A package says what to install. The catalog also keeps the evidence behind
each package, so you can see what it does before you install it:

- **Source:** the exact chart archive it was rendered from, with its sha256.
- **Values:** the values each base was rendered with.
- **Object count:** a reviewed count of the objects each base renders. A
  new chart version that adds or drops an object is caught before it is
  published.
- **Pages:** a page for each chart, listing its bases, what each base needs
  from the cluster, and the commands to install it.

Start from the [Catalog](https://confighub.github.io/helm-expt/site/charts/index.html) to read
those pages.
