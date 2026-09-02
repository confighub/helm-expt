# What Config Workshop is

Config Workshop is three things.

## 1. A verified catalog

A catalog that standardizes many upstream formats into one OCI form. Helm
charts, AICR recipes, Timoni modules, OCI packages, plain YAML, and
Kubara-generated platforms all come out the same way: flattened into a certified
bundle, an OCI image of the exact Kubernetes objects, that keeps the routing
(install order, hooks, CRDs before the resources that need them) and the
lifecycle facts (webhooks that need certificates, setup Jobs, namespaces that
must already exist), with a receipt that says what was checked. The numbers are
a footnote: 112 components, 139 versions, 71 published as certified bundles
today, the rest as installer-package images.

- **Every image is pullable by any OCI client**, Flux, Argo CD, kubectl, or
  oras, and, through the catalog gateway, by a stable name rather than a
  registry path.
- **Every image has been uploaded into ConfigHub as a base variant and the
  outcome recorded**: 93 of 94, with one render-late wrapper chart marked not
  applicable and no refusals
  ([the ConfigHub-ready lane](../../data/confighub-ready/summary.md)). The lane
  reruns and fails when an image has no recorded outcome.
- **Updates flow without losing your changes.** When the catalog fixes an
  image, the copy in your ConfigHub organization receives the fix, and the
  settings you changed stay yours.

Verified, certified, signed, at the artifact level:

- **Verified.** The artifact is `application/vnd.confighub.config.bundle.v1`,
  its identity is the OCI manifest digest, and its receipt is attached as a
  referrer of type `application/vnd.confighub.record.v1+json`.
  `cub config verify oci://…@sha256:…` pulls by digest, discovers the receipt,
  re-hashes every listed file, checks the layer hash, and refuses a digest with
  no receipt. It bites: run through the gateway over all 71 published catalog
  bundles, it refused 70 because their artifacts carry an older README where
  receipts name a guide.
- **Certified.** The receipt records the render inputs and every check that
  ran, with the ones that could not run named rather than omitted; for stacks,
  the composition verdict. "Certified" never means "works on your cluster"; it
  means these checks passed and these did not run.
- **Signed.** Cosign signatures as referrers; key-based signing and
  `verify --key` exist today; keyless via OIDC is open. The catalog signs its
  installer indexes in CI; signing certified bundles by default is open.

Together, in one sentence: you can pull any image by digest from any OCI client,
prove its bytes against a receipt that names what was and was not checked, and,
with a key, prove who published it, without trusting this website.

**What you can do:** pull any tested configuration as an image, by digest, run
it with the reconciler you already have, and prove afterwards that what ran is
what was checked.

**What problem this solves:** you find out what a chart does to your cluster by
applying it, and when something breaks, "what actually got deployed, and who
checked it?" has no answer you can prove.

## 2. Platforms and stacks on demand

You describe what you want, a web platform with monitoring and your shop app,
and get it as a list of parts the catalog already tested. Before anything runs,
one command checks the parts fit together and refuses if two of them fight or
something is missing. Then you can run it on your own clusters, or ask ConfigHub
to run it across many. Your AI assistant can do the choosing for you; the check,
not the assistant, decides, and every choice it can make is an image that
already exists with a receipt.

Recorded today: a platform generated from tested parts, governed, with two
applications running through it on four clusters; an assistant that composed and
certified a five-component stack from this site alone in six minutes; a
ten-cluster fleet generated from two manifests; an inference platform proven to
the scheduling boundary without a GPU. Not yet: a hosted place to ask, cloud
cluster provisioning and GPU runtime, and self-serve supply for chart
maintainers.

**What you can do:** describe a platform and get tested parts, checked together
before anything runs, with your assistant allowed to choose.

**What problem this solves:** assembling a platform from a dozen charts is weeks
of trial, and an assistant's composition cannot be trusted without a gate.

## 3. A ConfigHub plugin to operate apps, platforms, and stacks correctly

The `workshop` plugin for cub speaks four nouns, config, app, stack, and fleet,
and the operations every image climbs: check, certify, sandbox, publish, verify,
then upload, release, promote, roll back. The lifecycle facts travel inside the
image, so the operations know the install order, the hooks, and the CRDs without
guessing, and a composition is refused before it renders when two parts claim
the same object. It is the prototype of the product surface; the governed verbs
underneath, upload, release, promote, and gates, are ConfigHub's own. One
install: `cub plugin install confighub/cub-workshop`.

**What you can do:** run the same operations on a chart, a workload, a platform,
or a whole fleet, from one command line, and be refused when they would go
wrong.

**What problem this solves:** a chart, a workload, and a platform are operated
with different tools today, none of them knows the lifecycle work the others
hide, and none of them refuses.

## What is not covered yet

Timoni is in the catalog but has no story of its own. Kustomize is onboarding
only, not a catalog format. Live comparison against a running cluster exists and
is under-told. SBOM and provenance attestations alongside the receipt are absent,
and the referrer mechanism is exactly where they would go. The sveltos fleet
lives in its own repository.
