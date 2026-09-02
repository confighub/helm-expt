# What Config Workshop is, and what you can do with it

Config Workshop takes configuration other people have already tested, lets you
check it and run it, and lets you prove afterwards that what you ran is what was
checked. Here is what you can do with it.

## 1. Pull tested configuration as an image and run it anywhere

**You can pull a tested config as an image and run it anywhere.** Helm charts,
AICR recipes, Timoni modules, OCI packages, plain YAML, and Kubara-generated
platforms all come out the same way: flattened into a certified bundle, an OCI
image of the exact Kubernetes objects, that keeps the install order, the hooks,
the CRDs that must land first, and the facts a deployment needs to know, such as
which webhooks need a certificate and which namespaces must already exist. Any
OCI client pulls it by digest: Flux, Argo CD, kubectl, oras.

- **1a.** Every image is reachable by any OCI client, and through the catalog
  gateway by a stable name rather than a registry path.
- **1b.** Every certified image has been uploaded into a ConfigHub organization
  as a base variant and the outcome recorded: 93 of 94 images, 211 Units, one
  render-late wrapper chart marked not applicable, no refusals. The lane reruns
  and fails when an image has no recorded outcome; the receipt is
  [the ConfigHub-ready lane](../../data/confighub-ready/summary.md).
- **1c.** The operations every image climbs are the same: check, verify, deploy,
  upload, release, promote, roll back. The facts they need travel inside the
  image.
- **1d.** Updates flow without losing your changes. When the catalog fixes an
  image, the copy in your ConfigHub organization receives the fix, and the
  settings you changed stay yours.

## 2. Check, certify, and publish from the command line

**You can check, certify, and publish from the command line.** One install,
`cub plugin install confighub/cub-workshop`, gives four nouns, config, app,
stack, and fleet, and the free verbs over them: check a chart, check a workload
and learn what platform it needs, certify a composition, render it with no
infrastructure, publish the result as a verified image, verify any image from
its digest. The governed verbs underneath, upload, release, promote, gates, are
ConfigHub's own. The plugin proposes the surface; ConfigHub decides.

## 3. Ask for a whole platform, and have it checked before it runs

**You can ask for a whole platform and have it checked before it runs.** You
describe what you want, a web platform with monitoring and your shop app, and get
it as a list of parts the catalog already tested. Before anything runs, one
command checks the parts fit together and refuses if two of them fight or
something is missing. Then you can run it on your own clusters, or ask ConfigHub
to run it across many. Your AI assistant can do the choosing for you; the check,
not the assistant, decides. Every choice it can make is an image that already
exists with a receipt, so nothing is rendered on the fly.

What is recorded today: a platform generated from tested parts, governed, with
two applications running through it on four clusters; an assistant that composed
and certified a five-component stack from this site alone in six minutes; a
ten-cluster fleet generated from two manifests; an inference platform proven to
the scheduling boundary without a GPU. What is not yet real: a hosted place to
ask, cloud cluster provisioning and GPU runtime, and self-serve supply for chart
maintainers.

## 4. Prove that what you got is what was checked

**Verified, certified, signed.**

- **Verified** means the image's identity is its OCI manifest digest, its receipt
  is attached to that digest, and `cub config verify` pulls by digest, re-hashes
  every listed file, checks the layer, and refuses a digest with no receipt. It
  bites: run over every published catalog bundle, it refused 70 of 71 because
  their artifacts carry an older guide than their receipts name.
- **Certified** means the receipt records what was checked and what could not
  be checked, named rather than omitted; for a stack, the composition verdict.
  Certified never means "works on your cluster."
- **Signed** means who published it can be proven: key-based signing and
  verification exist today, keyless signing is open, and signing catalog bundles
  by default is open.

Put simply: you can pull any image by digest with any OCI client, prove its bytes
against a receipt that names what was and was not checked, and, with a key, prove
who published it. None of that needs you to trust this website.

## What this does not cover yet

Timoni is in the catalog but has no story of its own. Kustomize is onboarding
only. Live comparison against a running cluster exists and is under-told. SBOM
and provenance attestations alongside the receipt are absent, and the referrer
mechanism is where they would go. The sveltos fleet lives in its own repository.
