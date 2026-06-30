# Installer Package OCI Refs

**UNOFFICIAL/EXPERIMENTAL**

The public catalog should let a user try a chart without cloning this repo.
That is why each chart version now has an installer package OCI ref.

The user-facing command is:

```sh
cub installer setup --pull oci://ghcr.io/confighub/helm-expt/<repo>-<chart>:<version> \
  --base <preset> \
  --work-dir ./out \
  --non-interactive
```

For example:

```sh
cub installer setup --pull oci://ghcr.io/confighub/helm-expt/bitnami-redis:25.5.3 \
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
presets directly.

## Two OCI Things, Not One

There are two different OCI paths:

| OCI path | What it is for | Who uses it |
| --- | --- | --- |
| Installer package OCI | The package a user pulls with `cub installer setup --pull oci://...`. | A person, script, or agent trying a catalog preset. |
| ConfigHub delivery OCI | A rendered and reviewed object bundle that Argo, Flux, or another controller can pull later. | A delivery controller after the config is managed. |

The first OCI gets the package onto your machine. The second OCI is for delivery
after ConfigHub has recorded and managed the rendered objects.

## Publication Status

The generated package catalog records both the intended public ref and the
publication status:

- `published-receipt` means a publication receipt is committed for that ref.
- `assigned-ref` means the catalog has assigned the public ref, but no
  publication receipt is committed yet.

Until a row has a publication receipt, maintainers can still use the local
source package path under `packages/...` from a repo checkout. Public users
should follow rows that have a published package, or treat an unpublished row
as a preview of the intended public address.

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
