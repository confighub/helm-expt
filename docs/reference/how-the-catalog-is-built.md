# How the catalog is built, and why the records are shaped this way

This page holds the reasoning that used to sit on the reference pages. The
pages link here so a person mid-task gets the lookup, and a person asking why
gets this.

## Retained versions

Retained versions stay pullable from this catalog's own registry, with their
receipts unchanged. Packages are republished here at exact digests. When an
upstream's terms or availability change, the catalog records the measured fact
instead of removing the entry. Where a reviewed successor exists, the
component's page and catalog row link it.

The retention is deliberate rather than a failure to update: a retained entry
stays byte-for-byte reproducible while upstream moves, and refreshing the
catalog creates a new entry beside the old one instead of overwriting it. The
upstream drift record is what this discipline buys: when a publisher
republishes different bytes under the same version string, this catalog can
say so, with both digests.

The public `changes.json` file computes the current retained-version count, the
oldest registry receipt, and the number of version strings whose upstream bytes
were replaced. Those numbers come from package receipts and drift records. They
are not maintained by hand.

A chart enters the catalog only after its chart license and the source of that
license information are recorded. Normal refreshes add entries and do not
rewrite old packages. If a legal or factual correction is required, the package
must be marked and the reason recorded. A correction must never look like an
ordinary refresh.

## Package versions

A package's version is its chart's version with a leading `v`, the rule
ConfigHub uses for all of its installer packages. A chart that writes its
versions without the `v` gets one added: a new package of
`traefik/traefik` 42.0.0 is written as `metadata.version: v42.0.0` in
`installer.yaml` and published with the tag `v42.0.0`. A chart that already
writes the `v`, such as `jetstack/cert-manager` v1.21.1, keeps it, and never
gets a second one.

Packages made before this rule keep the version they were published under,
with no `v` added. Their tags, digests, signatures and receipts are public, and
renaming them would break every pinned reference. So `traefik/traefik` 41.4.0
stays `41.4.0`.

The package directory is still named by the chart version,
`packages/<repo>/<chart>/<chart version>/`, for old and new packages alike. Only
`metadata.version` and the registry tag carry the `v`. The generators and the
publisher choose the version with `installerPackageVersion` in
`scripts/lib/installer-package-version.mjs`, which returns the published
spelling for a package that exists and the `v` rule for anything new.
`tests/installer-package-version.test.mjs` checks every package in the
repository against the rule, and the publisher refuses a new package that does
not follow it.

## Package revisions

A published tag is never overwritten. When a package version turns out to be
wrong, the usual fix is the next chart version, built by the corrected proof
declaration. When there is no next chart version, because upstream has stopped
publishing the chart, the fix is a package revision: the same chart version,
packaged again with the correction, beside the version it corrects.

Revision `n` of chart version `V` lives in `packages/<repo>/<chart>/V-rn/` and
`recipes/<repo>/<chart>/V-rn/`, and is published with the tag `vV-rn`. The
version it corrects stays where it is, published under its own tag, with its
receipts unchanged. The revision's source lock names it `V-rn`, like
everything else in the catalog, so it is an entry of its own, and records the
chart version it was rendered from as `chartVersion: V` and the revision as
`packageRevision: n`. The catalog orders `V-rn` after `V` and before the next
chart version.

A proof declaration builds a revision by passing `packageRevision` to
`scripts/lib/proof-kit.mjs`, and keeps building the version it corrects
without it. The first is `ingress-nginx/ingress-nginx` `4.15.1-r1`: the
ingress-nginx repository is archived, so 4.15.1 is its last chart version, and
the published 4.15.1 default base leaves out the Jobs that create the admission
webhook certificate. `HELM_EXPT_PACKAGE_REVISION=1 node
scripts/ingress-nginx-proof.mjs` builds and checks the revision.

`cub package install <name>` without a version installs the highest tag of the
form `vX.Y.Z`, and a revision tag is not of that form. A revision is installed
by naming it, as in `cub package install ingress-nginx:v4.15.1-r1`, until the
installer treats a `-rN` tag as a revision of its release.

## Base patches

A base is the Helm render of one preset, and the package check compares what
`cub installer setup` renders from it with Helm, object by object. A base may
also carry kustomize patches in its `kustomization.yaml`, declared as the
variant's `basePatches`, when the Helm render cannot be delivered as it is. The
declaration then says exactly which differences the patches make
(`allowedSemanticDiff`), the package check fails on any other difference, and
the Helm equivalence receipt classifies each patched object as
`package-base-patch`. The ingress-nginx `4.15.1-r1` default base uses them to
turn the chart's admission certificate hooks into Argo CD Sync hooks.

## The matrix taxonomy

The master matrix keeps one row per chart, version, and base. Layer marks the
path from the source chart, through bases and target inputs, to derived
variants. Rows carry lane dispositions rather than one status, because a lane
that has not run is different from a lane that failed, and both are different
from a lane that passed on another version.

## What a passing verifier means

A breaking chart should become a repeatable test, a named limit, or a required
setup step. It must not disappear into prose.

A passing verifier means committed evidence is self-consistent. It does not
replace fresh live evidence for a new target. You still need to test on your
own cluster before production.
