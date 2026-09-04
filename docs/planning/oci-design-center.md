# OCI is the design center

Every result the workshop produces is an OCI image, every stack is an index of
images, every release is a flattened image, and one receipt links them. This
note fixes that as the design center for the Catalog, the workshop plugin, and
the site, and says what follows from it.

## Why OCI

ConfigHub is OCI-centric: every configuration in an organization sits behind an
OCI endpoint, a Space release is one OCI manifest, and Argo CD, Flux, and kubectl
all pull the same artifact. The doctrine already names OCI as the single
transport. The Catalog already publishes 71 chart variants as certified bundles
by digest, and the eks-inference platform composes eight of them. What was
missing is the other direction: the workshop's own verbs produced text, so a
verified result could be read but not handed on. The design center closes that.

## The artifact

One shape, the certified bundle the Catalog already publishes: an OCI artifact
of type `application/vnd.confighub.config.bundle.v1` whose layer is a
reproducible tar.gz of rendered configuration, with the receipt attached to the
same digest as a referrer of type `application/vnd.confighub.record.v1+json`.
The receipt records the producer, the source, the render inputs, every file with
its hash, the checks that ran and did not run, and the digest of the layer.

Verified means: pulled by digest, every listed file re-hashed against the
receipt, the layer bytes matched, and, where a signature is present, the
signature checked. The plugin's `cub config verify` does the first three today;
signing is the open item below.

## The three forms and the digest rule

- A **variant** is an image: one component at one recorded set of inputs.
- A **stack** is an index of images: an OCI image index whose entries are the
  component digests, with the stack manifest and its certify verdict attached
  to the index digest. The manifest stays a producer-side source file; the
  index is the published form, and the form the Catalog holds.
- A **release** is a flattened image: the whole stack rendered into one
  artifact, because a reconciler pulls one manifest, not an index.

One receipt links the three. The identity of a certified bundle is the OCI
manifest digest; the object-set hash lives inside the receipt and never
substitutes for it. The site already keeps a catalog identity, a rendered
identity, and a release identity apart, and this rule is why.

## ConfigHub-ready, as a lane

Every certified image is built to be a ConfigHub variant, and that is now checked
rather than asserted. The ConfigHub-ready lane (`npm run confighub-ready:run`)
uploads every certified image into a disposable organization as a base variant,
one at a time, counts its Units, records the outcome, and deletes the Space;
`npm run confighub-ready:verify` fails when a certified image has no recorded
outcome or any recorded refusal. Published images upload from their digest,
which is the design center's path; unpublished ones upload from the bytes their
receipts list. The first run recorded 94 images: 93 uploaded as base variants,
211 Units in all, and one render-late wrapper chart recorded as not applicable,
because upload applies to rendered configuration. The receipt and summary are in
`data/confighub-ready/`.

## The choice rule

Where a user or an assistant is offered a choice, every choice is a pre-rendered
image with a receipt. An "AI menu" selects among digests; it does not render on
demand. Where the choice space is combinatorial, presets bound it, and a
parity-gated on-demand variant becomes a new pre-rendered image once it is
certified. The KServe NIM entry already holds sixteen model-by-GPU-shape
manifests as files; under this rule each is a variant image. No choice without a
digest.

## What the workshop plugin does under this rule

- `cub config check <name> --out oci://…` and `cub app check <name> --out oci://…`
  render, check, push the certified bundle, attach the receipt, and print the
  digest.
- `cub stack sandbox <name> --out oci://…` publishes the flattened stack with the
  certify findings in its receipt: the release form.
- `cub stack publish <name> --out oci://…` copies each component's bundle into
  the target repository by digest, publishes render and authored components as
  bundles first, creates the index, and attaches the manifest and verdict: the
  Catalog form.
- `cub config verify oci://…@sha256:…` pulls a bundle, finds its receipt, and
  re-hashes everything.
- A bundle-form component whose receipt is attached in the registry needs no
  local receipt: the resolver discovers it.

## What this changes in the Catalog

Stack manifests are not Catalog objects; indexes are. As of cub-workshop v0.6.0
the shipped stacks name every component as an image by reproducible digest, with
the bytes seeded in the plugin's cache so certify works offline while hash
verification against the receipt still runs; `scripts/seed-cache.mjs` rebuilds
that and pushes the same digests to a public registry. Two pushes still wait on
a registry credential: the four certified AICR bundles (the publisher now stages
them; `node scripts/publish-certified-bundles.mjs --receipt <aicr receipt>`
after `gcloud auth login`) and the nine workshop renders (the seed script with
the public registry as both `--registry` and `--public`). Until then the
manifests name images that exist only in the cache and the receipts.

## The Catalog as an OCI endpoint

A catalog of images should behave the way ConfigHub and OCI stores behave: every
entry reachable at a stable name by any OCI client, not only through links on a
website. Today the certified bundles live under provider-specific paths on two
registries, and the site points at them. The Catalog should instead front them
as one endpoint, in the shape ConfigHub already uses for its own Spaces:

- **Stable names.** `oci://catalog.confighub.com/<chart>/<version>/<variant>` for
  a variant image, `…/<stack>/<version>` for an index, each resolvable by tag and
  by digest, with the publishing registry an implementation detail behind it.
- **Standard behavior.** Pull by digest with `oras`, `crane`, `docker`, or a Flux
  `OCIRepository`; the referrers API returns the attached receipt, verdict, and
  signature; `/v2/_catalog` and tag listing enumerate what exists, so an assistant
  can discover the menu of pre-rendered choices without scraping a page.
- **Push, gated.** A maintainer's `cub config check --out oci://catalog…` is an
  offer: the endpoint accepts the artifact into a staging namespace, the catalog
  reproduces the render and compares digests, and only a reproduced bundle is
  promoted to its stable name. Author, not authority, at the registry.
- **Same shape as the product.** ConfigHub exposes every configuration at an OCI
  endpoint; the Catalog exposing every variant the same way is what makes
  `upload` a matter of pointing an organization at a digest, and what lets a
  catalog entry chain into a private org as a base.

A thin registry gateway that mirrors the published bundles under the stable names
and serves the referrers API is enough for the first version; the reproduction
gate on push comes with the maintainer-push verb. This is filed as its own job.

Status, 2026-09-02: a read-side prototype exists, `scripts/catalog-oci-gateway.mjs`.
It indexes the published catalog receipts, serves `/v2/_catalog`, tags, manifests,
and blobs under `<chart>/<version>/<variant>` by proxying the publishing registry,
and answers the referrers endpoint with a synthesized artifact whose one layer is
the receipt, so `oras discover` and `cub config verify` find it. Run it with
`node scripts/catalog-oci-gateway.mjs --repo . --port 5010`, then
`cub config verify oci://localhost:5010/traefik/41.0.2/default@<digest>`. Its first
audit, every published bundle verified through it, found that 70 of 71 artifacts no
longer carry the guide their receipt lists; that is filed as its own issue and is the
kind of drift the endpoint exists to expose. Push and hosting remain open.

## Open items

- Signing: keyless cosign for user outputs, the catalog's key for its own; the
  mechanism runs in CI already.
- Consuming an index: `cub stack sandbox oci://…index@sha256:…` and fleet
  placements by index digest.
- The product half: ConfigHub importing an index as a set of base Spaces with
  links from the attached manifest, which is what makes "into your own org" one
  command. That is a product decision, recorded here and not implemented.
- Secrets never enter an artifact; the push refuses them, as upload does.
