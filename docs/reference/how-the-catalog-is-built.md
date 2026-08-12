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
