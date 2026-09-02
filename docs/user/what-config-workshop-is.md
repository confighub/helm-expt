# What Config Workshop is

Config Workshop is four things.

## 1. A catalog of tested configuration, published as OCI images

Helm charts, AICR recipes, Timoni modules, OCI packages, plain YAML, and
Kubara-generated platforms, each flattened into the same form: an image of the
exact Kubernetes objects, with the install order, the hooks, the CRDs that must
land first, and the facts a deployment needs kept alongside, and a receipt of
what was checked. Any OCI client pulls one by digest; the catalog gateway serves
them by stable name. Every image has been uploaded into ConfigHub as a base
variant and the result recorded: 93 of 94, with one render-late wrapper chart
marked not applicable ([the lane](../../data/confighub-ready/summary.md)). When
the catalog fixes an image, your copy receives the fix without losing the
settings you changed.

You can pull a tested config as an image and run it anywhere.

## 2. A cub plugin, `workshop`

Four nouns, config, app, stack, and fleet, and the free verbs over them: check a
chart or a workload, certify a composition, render it with no infrastructure,
publish the result as a verified image, verify any image from its digest. The
governed verbs underneath, upload, release, promote, and gates, are ConfigHub's
own. One install: `cub plugin install confighub/cub-workshop`.

You can check, certify, and publish from the command line.

## 3. Platforms and stacks on demand

You describe what you want, a web platform with monitoring and your shop app,
and get it as a list of parts the catalog already tested. One command checks the
parts fit together and refuses if two of them fight or something is missing.
Then you run it on your own clusters, or ask ConfigHub to run it across many.
Your AI assistant can do the choosing; the check, not the assistant, decides,
and every choice it can make is an image that already exists with a receipt.

Recorded today: a platform generated from tested parts with two applications
running through it on four clusters; an assistant that composed and certified a
five-component stack from this site alone; a ten-cluster fleet generated from two
manifests; an inference platform proven to the scheduling boundary without a
GPU. Not yet: a hosted place to ask, cloud provisioning and GPU runtime, and
self-serve supply for chart maintainers.

You can ask for a whole platform and have it checked before it runs.

## 4. Verified, certified, signed

Verified: the image's identity is its digest, its receipt is attached to that
digest, and `cub config verify` re-hashes every listed file and refuses a digest
with no receipt. Certified: the receipt records what was checked and what could
not be checked, named rather than omitted; certified never means "works on your
cluster." Signed: who published it can be proven, with a key today, keyless
next.

You can prove that what you got is what was checked, without trusting this
website.

## Not covered yet

Timoni has no story of its own. Kustomize is onboarding only. Live comparison
against a running cluster exists and is under-told. SBOM and provenance
attestations alongside the receipt are absent. The sveltos fleet lives in its
own repository.
