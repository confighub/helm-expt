# What Config Workshop is

Config Workshop is three things.

## 1. A verified catalog

A catalog of tested configuration, all in one form. Helm charts, AICR recipes,
Timoni modules, OCI packages, plain YAML, and Kubara-generated platforms all
come out the same way: as an OCI image of the exact Kubernetes objects, with the
install order, the hooks, the CRDs that must land first, and the things a
deployment needs to know (which webhooks need a certificate, which namespaces
must already exist) kept alongside, and a receipt that says what was checked.
Today: 112 components, 139 versions.

- **Any OCI client can pull an image**: Flux, Argo CD, kubectl, or oras, by
  digest, or by a stable catalog name.
- **Every image works in ConfigHub.** Each one has been loaded into ConfigHub as
  a starting variant and checked, and that check reruns whenever the catalog
  changes.
- **Updates reach you without losing your changes.** When the catalog fixes an
  image, your copy in ConfigHub gets the fix, and the settings you changed stay
  yours.

Every image is verified, certified, and signed:

- **Verified** means the image's identity is its digest and its receipt is
  attached to that digest. `cub config verify` pulls the image, re-hashes every
  file against the receipt, and refuses an image that has no receipt. It bites:
  it refused 70 of our own 71 published bundles when their receipts drifted from
  the artifacts.
- **Certified** means the receipt names every check that ran and every check
  that could not run, rather than hiding the second list. Certified never means
  "works on your cluster"; it means these checks passed and these did not run.
- **Signed** means who published it can be proven: with a key today, keyless
  next.

In one sentence: you can pull any image by digest, prove its bytes against a
receipt that names what was and was not checked, and, with a key, prove who
published it, without trusting this website.

**What you can do:** pull any tested configuration as an image, run it with the
reconciler you already have, and prove afterwards that what ran is what was
checked.

**What problem this solves:** you find out what a chart does to your cluster by
applying it, and when something breaks, "what actually got deployed, and who
checked it?" has no answer you can prove.

## 2. Platforms and stacks on demand

You describe what you want, a web platform with monitoring and your shop app,
and get it as a list of parts the catalog already tested. Before anything runs,
one command checks the parts fit together and refuses if two of them fight or
something is missing. Then you run it on your own clusters, or ask ConfigHub to
run it across many. Your AI assistant can do the choosing for you; the check,
not the assistant, decides, and every choice it can make is an image that
already exists with a receipt.

Recorded today: a platform generated from tested parts with two applications
running through it on four clusters; an assistant that composed and certified a
five-component stack from this site alone in six minutes; a ten-cluster fleet
generated from two manifests; an inference platform proven up to the point where
a GPU would be needed. Not yet: a hosted place to ask, cloud cluster
provisioning and GPU runtime, and a way for chart maintainers to add their own
images.

**What you can do:** describe a platform and get tested parts, checked together
before anything runs, with your assistant allowed to choose.

**What problem this solves:** assembling a platform from a dozen charts is weeks
of trial, and an assistant's composition cannot be trusted without a gate.

## 3. A ConfigHub plugin to operate apps, platforms, and stacks correctly

The `workshop` plugin for cub works on four things, a config, an app, a stack,
and a fleet, with the same operations for each: check it, certify it, render it,
publish it, verify it, then upload, release, promote, and roll back through
ConfigHub. The image carries its install order, hooks, and CRDs, so the
operations never guess, and a composition is refused before it renders when two
parts claim the same object. One install:
`cub plugin install confighub/cub-workshop`.

**What you can do:** run the same operations on a chart, a workload, a platform,
or a whole fleet, from one command line, and be refused when they would go
wrong.

**What problem this solves:** a chart, a workload, and a platform are operated
with different tools today, none of them knows the lifecycle work the others
hide, and none of them refuses.
