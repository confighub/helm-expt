# Installer Package OCI Refs

**UNOFFICIAL/EXPERIMENTAL**

The catalog should let a user try a chart without cloning this repo. That is
why each chart version now has an installer package OCI ref.

Current status: the refs below are published in Google Artifact Registry and
have publication receipts, but they still require registry read auth. The local
setup path does not require a ConfigHub account. A public no-auth mirror is the
next access step.

The user-facing command is:

```sh
cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/<repo>-<chart>:<version> \
  --base <preset> \
  --work-dir ./out \
  --non-interactive
```

For example:

```sh
cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3 \
  --base default \
  --work-dir ./out \
  --non-interactive \
  --namespace redis
```

`cub installer setup` pulls the package into the work directory, writes the
selected inputs under `out/spec`, and writes the rendered Kubernetes files under
`out/manifests`. If the preset separates secret material, it also writes files
under `out/secrets`.

## What The Package Contains

An installer package is the catalog artifact for one chart version. It contains:

- the package metadata and `installer.yaml`;
- the available preset chart configurations, called bases in the repo;
- the files needed to render each supported preset locally;
- the recorded inputs behind those presets;
- links back to the catalog evidence: rendered output, checks, receipts, hooks,
  CRDs, target prerequisites, and other chart extras.

The package does not replace Helm charts. The catalog starts from ordinary Helm
charts, then publishes reviewed package artifacts so users can pull the ready
presets directly once they have access to the package registry.

## Two OCI Things, Not One

There are two different OCI paths:

| OCI path | What it is for | Who uses it |
| --- | --- | --- |
| Installer package OCI | The package a user pulls with `cub installer setup --pull oci://...`. | A person, script, or agent trying a catalog preset. |
| ConfigHub delivery OCI | A rendered and reviewed object bundle that Argo, Flux, or another controller can pull later. | A delivery controller after the config is managed. |

The first OCI gets the package onto your machine. The second OCI is for delivery
after ConfigHub has recorded and managed the rendered objects.

## Publication Status

The generated package catalog records both the intended package ref and the
publication status:

- `published-receipt` means a publication receipt is committed for that ref.
  It does not by itself mean anonymous pull access is enabled.
- `assigned-ref` means the catalog has assigned the package ref, but no
  publication receipt is committed yet.

Until a row has a publication receipt, maintainers can still use the local
source package path under `packages/...` from a repo checkout. Users who are
pulling from OCI should follow rows that have a published package, or treat an
unpublished row as a preview of the intended address.

## Public Pull Access

Publishing and public pull access are separate. The current catalog refs have
publication receipts in Google Artifact Registry, but anonymous pulls are still
blocked by the registry policy. There are two clean ways to finish the public
path:

- allow anonymous read access on the Google Artifact Registry repository, or use
  a project where that policy is allowed;
- publish the same packages to a public GHCR mirror using credentials with
  package write permission, then make the container packages public.

Until one of those is done, examples that use the current GAR refs require
registry read auth. They still do not require a ConfigHub account for local
setup.

## Where To Find The Refs

Use these generated files when you need exact refs for all chart versions:

- [Installer OCI package summary](../../data/installer-oci-packages/summary.md)
- [Installer OCI package CSV](../../data/installer-oci-packages/packages.csv)
- [Installer OCI package JSON](../../data/installer-oci-packages/packages.json)

The verifier is:

```sh
npm run installer-oci:catalog:verify
```

This checks that the package refs, setup commands, package paths, bases, and
publication statuses match the current repo.

Maintainers publish packages with:

```sh
npm run installer-oci:publish -- --package packages/bitnami/redis/25.5.3
```

or, for the full catalog:

```sh
npm run installer-oci:publish
```

The publish command requires registry credentials with package write permission.
For GHCR, use a token with `write:packages`. After a successful push, the script
writes a publication receipt under `runs/installer-oci/...`; regenerate the
catalog so the row changes from `assigned-ref` to `published-receipt`.

For Brian's consumer pathway, see the upstream
[Package Consumer Guide](https://github.com/confighub/installer/blob/main/docs/consumer-guide.md).
