# Installer Package OCI Refs

**UNOFFICIAL/EXPERIMENTAL**

The catalog should let a user try a chart without cloning this repo. That is
why each chart version now has an installer package OCI ref.

Current status: the catalog records 110 published installer package OCI refs.
100 are public catalog chart packages; the extra refs are retained chart-version
packages used by refresh and comparison work. The refs are published in Google
Artifact Registry with public read access. The local setup path does not require
a ConfigHub account, a Google registry login, or a clone of this repo.

The user-facing command is:

```sh
cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/<repo>-<chart>:<version> \
  --base <preset> \
  --work-dir ./out \
  --non-interactive \
  --namespace <namespace>
```

For example:

```sh
cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3 \
  --base reuse-existing-secret \
  --work-dir ./out \
  --non-interactive \
  --namespace redis \
  --output-oci ./redis-rendered.oci
```

`cub installer setup` pulls the package into the work directory, writes the
selected inputs under `out/spec`, and writes the rendered Kubernetes files under
`out/manifests`. If the preset separates secret material, it also writes files
under `out/secrets`. The optional `--output-oci` flag writes the exact non-secret
rendered objects to a local OCI image layout or pushes them to an
`oci://host/repository:tag` reference. The installer reads that artifact back and
checks its object-set digest before returning.

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

The package should also make the install simpler. Most choices are fixed before
publication: chart version, base shape, values profile, source lock, known CRD
or hook decisions, and the evidence links. Only a small set of choices should be
left for install time, such as namespace, target-specific facts, image
overrides, or the name of an existing Secret. Those remaining choices should be
documented and restricted instead of exposing the whole Helm values surface
again.

This matters for fleets. A package release can be the thing a platform team
signs off. ConfigHub can then record which package, preset, and allowed inputs a
cluster, customer, or environment should run, and reconcile that desired record
through the delivery system already in use.

## Three OCI Roles

The catalog uses OCI for three different jobs:

| OCI path | What it is for | Who uses it |
| --- | --- | --- |
| Installer package OCI | A multi-preset source package pulled with `cub installer setup --pull oci://...`. | A person, script, or agent choosing and rendering one catalog preset. |
| Rendered OCI | One selected preset's exact non-secret Kubernetes objects, written by `cub installer setup --output-oci`. | Argo CD, Flux, another OCI consumer, or `cub variant upload`. No ConfigHub account is required to create it. |
| ConfigHub release OCI | A reviewed ConfigHub Space release, published after the objects are stored and managed. | Argo CD, Flux, or another delivery path that consumes the managed result. |

The input and output may both be OCI without being the same artifact. The installer
package can offer several presets and the files needed to render them. A rendered OCI
contains one chosen result. A ConfigHub release OCI contains the later managed
revision after variants, review, approval, or promotion.

To push the selected result directly:

```sh
cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3 \
  --base reuse-existing-secret \
  --work-dir ./out \
  --non-interactive \
  --namespace redis \
  --output-oci oci://REGISTRY/redis-reviewed:25.5.3
```

Registry write access is required for a push. A local `--output-oci` path needs no
registry credentials. Input values and files under `out/secrets` are not published
in the rendered OCI.

## Publication Status

The generated package catalog records both the intended package ref and the
publication status:

- `published-receipt` means a publication receipt is committed for that ref.
  Public catalog refs are also readable anonymously from the current Artifact
  Registry repository.
- `assigned-ref` means the catalog has assigned the package ref, but no
  publication receipt is committed yet.

Until a row has a publication receipt, maintainers can still use the local
source package path under `packages/...` from a repo checkout. Users who are
pulling from OCI should follow rows that have a published package, or treat an
unpublished row as a preview of the intended address.

## Public Pull Access

Publishing and public pull access are separate. For this catalog, both are now
in place:

- the 110 package refs have publication receipts;
- the Google Artifact Registry repository grants `roles/artifactregistry.reader`
  to `allUsers`;
- the project-level organization policy allows that public read binding for this
  public package project.

That means a user can run `cub installer inspect` or `cub installer setup
--pull` against the public catalog refs without Google Cloud credentials. Write
access is still private: maintainers need registry credentials to publish or
replace packages.

The registry setting is deliberately narrow: the `helm-expt` Artifact Registry
repository grants `roles/artifactregistry.reader` to `allUsers`. The project has
a project-level organization-policy override that permits that public read
binding. This does not grant anonymous write access, and it does not make other
project resources public.

Anonymous read was checked with empty local auth state:

```sh
tmpd=$(mktemp -d); tmpc=$(mktemp -d)

DOCKER_CONFIG="$tmpd" CLOUDSDK_CONFIG="$tmpc" GOOGLE_APPLICATION_CREDENTIALS= \
  cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3 \
    --base reuse-existing-secret \
    --work-dir ./out \
    --non-interactive \
    --namespace redis

rm -rf "$tmpd" "$tmpc"
```

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

For the full consumer pathway, see the upstream
[Package Consumer Guide](https://github.com/confighub/installer/blob/main/docs/consumer-guide.md).
