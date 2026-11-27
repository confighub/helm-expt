# Catalog Configuration OCI On GitHub's Registry

**UNOFFICIAL/EXPERIMENTAL**

The Catalog publishes configuration as OCI artifacts that are not installer
packages: certified config bundles, the literal bundles of the NVIDIA chart
bases, the NIMService variants, and the Timoni Redis configuration. They now go
to GitHub's registry:

```text
oci://ghcr.io/confighub/configs/catalog/<name>:<tag>
```

The [catalog OCI workflow](../../.github/workflows/catalog-oci-publish.yml)
publishes them after a change to their inputs is merged to `main`, and signs
each manifest digest keylessly as that workflow. Nobody pushes them by hand
and no registry credential is stored anywhere: the workflow uses its own
GitHub token, and Sigstore records the signature against the workflow's
identity. Installer packages are published separately, to
`ghcr.io/confighub/packages`.

Until now these artifacts sat in a Google registry,
`europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt`, pushed by a
maintainer with local credentials and not signed. Those copies stay where they
are, with their receipts, and the Catalog records them as the earlier location.

## Check a signature

```sh
cosign verify \
  --certificate-identity-regexp '^https://github.com/confighub/helm-expt/.github/workflows/catalog-oci-publish.yml@refs/heads/main$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/confighub/configs/catalog/<name>@<manifest digest>
```

A passing check shows that the workflow on `main` of this repository signed
that exact manifest. It says nothing about whether the configuration suits a
cluster; the entry's page holds that evidence.

## Which artifacts the workflow rebuilds

The workflow does not download what was pushed to Google and push it again,
where it can avoid it. It builds each artifact from committed files and
refuses to publish an artifact that was published before unless the build
gives the same manifest digest, so the GitHub copy and the Google copy are one
artifact at two addresses.

| Kind | Artifacts | Built from | Same digest as the Google copy |
| --- | ---: | --- | --- |
| Certified config bundle | 185 | the bundle receipt under `data/certified-bundles/receipts/catalog/` and the files it lists | all 185 |
| NVIDIA literal bundle | 41 | the plan under `data/nvidia-literal-bundles/` and its staged files | all 41 |
| NIMService variant | 38 | the plan beside each variant under `data/aicr-nim-operator-models/catalog-entries/` | 37; one variant was never published, and is published for the first time on GitHub |
| Timoni Redis configuration | 1 | not rebuilt; copied at its recorded digest | the same, because it is a copy |

`npm run catalog-oci:generate` writes the full list, one row per artifact, to
[data/catalog-oci/artifacts.csv](../../data/catalog-oci/artifacts.csv).

How each kind is rebuilt, and why one is not:

- **NVIDIA literal bundles and NIMService variants** are written byte by byte
  by their own modules, including the gzip container, so every machine builds
  the same digest. Their receipts are already refused unless they match.
- **Certified bundles** were tarred by the maintainer's `tar` and compressed by
  `gzip -n`. The publisher writes the same tar layout itself and compresses
  with the system zlib through Python, which gives the published bytes on macOS
  and on Linux. It does not use GNU gzip or the zlib Node ships, because both
  produce different bytes. The guide inside a published bundle is the one
  written before publication, whose upload command reads `<bundle>`; the
  committed guide was rewritten afterwards to name the published reference, so
  the publisher puts that one line back before building.
- **The Timoni Redis configuration** cannot be rebuilt: `oras push` stamped its
  manifest with the time of the push, and no committed file records that time.
  The workflow reads it from the Google registry at the digest its receipt
  records, checks the digest, and pushes the same bytes.

If the committed files of a published certified bundle stop building its
recorded digest, the publisher copies that bundle the same way, and the list
says so.

## Tags

A tag is published once and never moved or overwritten. Each tag ends with the
first twelve hex digits of the manifest digest, after a word that says what it
is: `bundle-` for a certified bundle, the render revision (`r001-`) for an
NVIDIA bundle, and the upstream commit (`upstream-<commit>-`) for a NIMService
variant. The revision and the commit stay, because they mean something to a
reader; the digest goes on the end, because the route and guide files can
change under the same revision. The Timoni artifact keeps `8.10.1-default`,
because it is one copy at one digest.

GitHub gets no `latest` tag. The Google copies of the certified bundles sit at
`:latest`, but every Catalog reference pins the manifest digest, and a tag
that moves cannot be signed once and left alone.

## What a workflow run does

For each artifact:

1. Reads the tag with no credentials. A tag already at the expected digest is
   skipped, so a run that follows a merge publishes only what the merge added,
   and a second run publishes nothing. A tag at another digest stops the run.
2. Pushes the blobs and the manifest by digest, with no tag.
3. Signs the digest with cosign.
4. Adds the tag. A tag on GitHub therefore always names a signed manifest, and
   a run that stops halfway leaves nothing a reader can find.
5. Reads the tag again with no credentials. GitHub creates a new package
   private, and when that read fails the run fails and names the setting to
   change: the package settings page, Change visibility, Public.
6. Verifies the signature against the workflow identity and writes a receipt.

`npm run catalog-oci:plan` prints what a run would push and writes nothing.
`REGISTRY=localhost:5001/configs/catalog SIGN=false npm run catalog-oci:publish`
runs the same steps against a registry of your own, unsigned, and writes no
receipt into the repository.

## When the pages switch to GitHub

Nothing is on GitHub until the first workflow run after the merge that adds
this, so the Catalog does not say otherwise. Each entry page keeps its Google
reference and says the GitHub copy is published and signed by the workflow
after a merge, with no receipt yet.

The workflow uploads the receipts of what it published as the
`catalog-oci-receipts` artifact of the run, and `npm run catalog-oci:observe`
writes the same receipts for everything already on GitHub, with no credential,
under `runs/catalog-oci/<name>/<tag>.yaml`. Once a receipt is committed with
`git add -f` and `npm run catalog-oci:generate` is rerun, the entry page cites
the GitHub reference, its digest and the `cosign verify` command, its upload
commands use the GitHub reference, and the Google reference is shown as the
earlier location. Committing receipts is the one step a person or the package
refresh job still takes, because the workflow can read the repository but not
write to it.

## Kept current

These artifacts derive from chart package versions and from retained upstream
samples. When a new chart package version lands with a render, a package base
and a flattening verdict that permits flattening,
`npm run certified-bundles` gives it a certified bundle without anyone editing
the generator: bases decided after the generator's list was written are
discovered. The verify chain refuses a change whose bundles were not
regenerated, so the change cannot merge without them, and on merge the workflow
publishes and signs them. The same holds for a new NVIDIA base
(`npm run nvidia-literal-bundles:generate`) and a new NIMService variant.

What still needs a person:

- A newly decided base whose render holds a Secret with data, or hook objects
  no recorded observation routes, gets no bundle. `npm run certified-bundles`
  names it on every run until it is listed with an adjudication or held.
- A certified bundle published earlier whose committed files change is not
  published again; the workflow keeps copying the recorded bytes, because the
  records still cite that digest.
- Receipts are committed by hand, as above.

## Left where they are

- The AICR mirror artifacts are planned and were never published. Their
  Applications name source packages at the Google location, so moving them
  means moving the source packages first and rendering the Applications again.
- Three certified bundles published under names without a chart version
  (`catalog-gatekeeper-gatekeeper-default`,
  `catalog-jetstack-cert-manager-crds-enabled` and
  `catalog-projectcalico-tigera-operator-default`) were superseded by
  versioned names and nothing cites them.
- Proof and demo repositories such as the rendered Bitnami nginx stay on the
  Google registry.
- The hand publishers (`scripts/publish-certified-bundles.mjs`,
  `scripts/publish-nvidia-literal-bundles.mjs`,
  `scripts/publish-nimservice-variants.mjs` and the Timoni proof's `--publish`)
  still write to the Google location and its receipts. A bundle they publish
  there is rebuilt to the same digest and published on GitHub by the workflow.
