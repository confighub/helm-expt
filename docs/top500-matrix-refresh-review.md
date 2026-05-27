# Top-500 Matrix Refresh Review

## Verdict

Yes: recalculated. The current top-500 catalog analysis lives under:

```text
data/top500-catalog-analysis/
```

The retained source scan input is:

```text
data/top500-catalog-analysis/source/source-feature-scan.raw.json
```

That source scan is useful historical reconnaissance, but it is not the current
catalog proof model by itself. The generated catalog analysis now traces rows
to current recipes, installer packages, variants, rendered revision digests,
scans, gates, catalog status, or maintenance review where those artifacts
exist.

## What The Old Matrix Contains

Files reviewed:

```text
data/top500-catalog-analysis/source/source-feature-scan.raw.json
```

Raw JSON shape:

```text
rows: 500
scanned: 495
failed: 5
fields per row: 66
```

Classification counts:

```text
P0 blocked: archive unavailable/malformed: 5
P0 source/dependency risk: 154
P1 compiler policy needed: 165
P2 recipe/render/install policy: 174
P3 plain/static-ish: 2
```

Notable feature counts across scanned rows:

```text
lookup: 244
rand functions: 220
cert functions: 169
time/uuid functions: 140
required/fail checks: 309
tpl: 362
capabilities APIs: 281
capabilities kubeVersion: 319
semverCompare: 309
release-mode branching: 177
extra/raw manifest values: 254
files.Get: 129
values schema: 178
CRDs: 102
cluster roles: 250
validating webhooks: 58
mutating webhooks: 56
APIService: 17
stateful sets: 239
PVCs: 232
jobs: 179
daemon sets: 112
secrets: 355
declared dependencies: 183
dependency lock present: 233
vendored subcharts: 244
non-exact dependency constraints: 152
```

## Why It Should Be Recalculated

The old matrix answers:

```text
What Helm source features can cause pain?
```

The current project needs the matrix to answer:

```text
Can this chart become a simple, safe, correct ConfigHub catalog entry?
What proof exists?
What human/product review remains?
```

That means the new matrix must be generated from current artifacts, not from a
standalone source scan.

## New Sheet And JSON Shape

The new top-500 outputs should live under a new path, for example:

```text
data/top500-catalog-analysis/
  raw.json
  review.csv
  review.xlsx
  summary.md
```

Recommended front-sheet columns:

```text
rank
chart
version
source_status
recipe_status
package_status
variant_status
proof_status
catalog_status
next_action
```

Drill-down columns can include:

```text
source_digest
dependency_lock_status
capability_profile
target_fact_requirements
generated_fact_requirements
hook_policy
crd_policy
webhook_policy
rbac_policy
stateful_storage_policy
raw_extension_policy
render_status
regular_helm_digest
cub_install_digest_or_semantic_match
rendered_object_count
scan_status
scan_high
scan_medium
gate_decision
supported_variants
deferred_variants
maintenance_sla
legacy_patch_status
recipe_path
package_path
receipts_path
```

## Rule

Keep `data/top500-catalog-analysis/source/source-feature-scan.raw.json` as historical input until the new matrix
exists, but do not present it as current proof. Once the new matrix is
generated and reviewed, move or delete the old output from the public proof
surface.
