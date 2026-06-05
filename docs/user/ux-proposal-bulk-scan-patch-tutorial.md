# UX Proposal: Bulk Scan And Bulk Patch Tutorial

**UNOFFICIAL/EXPERIMENTAL**

Companion to [Tutorial Sequence](./tutorial-sequence.md).

This is a UX proposal, not a shipped GUI. It turns the bulk operations tutorial
into an intent-first operating story over rendered ConfigHub Units.

## Shared Mapping

All tutorial UX proposals use the same map:

```text
Human: express the desired base, environment, region, customer, delivery, or operation.
CLI: use cub installer for render/base work; use cub variant create for derived ConfigHub variants.
Proof: run checks, gates, and receipts before the change is called ready.
```

## Current CLI Friction

The CLI UX exposes each primitive:

```text
select Space
write label selector
run scan function
create changeset
bulk patch labels
bulk patch gates
dry-run mutating function
review path-level mutation output
apply function
re-scan changed Units
bulk approve revisions
verify bulk operation result
```

Those are the right backend primitives, but the user intent is:

```text
Harden this reviewed release as a group.
```

## Simpler Human Intent

A Creator-style operating flow can present:

```text
Bulk harden release
From: NGINX/http-clusterip
Scope: all NGINX workload Units in helm-nginx-http-clusterip
Change:
  mark scan disposition reviewed
  add production-review gates
  set nginx image to nginx:1.25.5
Review:
  6 selected workload Units
  one image path changes on deployment-nginx-nginx
  all changes in changeset nginx-bulk-hardening
Checks:
  vet-format before patch
  approved mutation path
  vet-format after patch
Status: ready to approve
Approve
```

The user should see the object set and the changed paths before anything
mutates.

## Guardrail

The important guardrail is:

```text
Bulk operations must be selector-scoped, changeset-bound, previewed, scanned,
and approved.

Data changes should use approved functions or allowed mutation paths, not ad hoc
editing of rendered objects.
```

This is not a new Helm render. It is a controlled operation over already
uploaded ConfigHub Units.

## Formal Shape

The same flow can map to:

```yaml
kind: BulkOperationCreatorContract
from:
  component: NGINX
  variant: http-clusterip
  space: helm-nginx-http-clusterip
scope:
  selector: Labels.Component = 'NGINX' AND Labels.Variant = 'http-clusterip'
create:
  changeset: nginx-bulk-hardening
extends:
  labels:
    ScanDisposition: reviewed
    Operation: bulk-scan-patch
  gates:
    delete: production-review
    destroy: production-review
  functions:
    - name: set-image
      args:
        container: nginx
        image: nginx:1.25.5
review:
  selectedUnits: 6
  allowedChangedPaths:
    - spec.template.spec.containers.?name=nginx.image
checks:
  - selectorMatchesExpectedUnits
  - vetFormatBeforePatch
  - dryRunMutationReviewed
  - vetFormatAfterPatch
  - approvedRevisions
receipts:
  - scanReceipt
  - changesetReceipt
  - mutationReceipt
  - approvalReceipt
```

## Mapping Back To Current Primitives

```text
Creator-style intent = scan, harden, review, and approve a rendered release.
Formal contract = selector, changeset, allowed mutations, checks, receipts.
cub function vet = scan substrate.
cub changeset create = review grouping substrate.
cub unit update --patch = metadata and gate substrate.
cub function set = approved data mutation substrate.
AX/FX = same operation over many releases or rows.
```

The product narrative should be "harden this release safely as a group," not
"copy a label selector through six different commands and remember which ones
need a changeset."
