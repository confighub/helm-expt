# Resolve one exact Catalog record

Use the repository adapter to retrieve one complete BaseVariantRecord without
sending the entire Catalog to an assistant:

```sh
node scripts/lookup-catalog-record.mjs --name bitnami-redis-25-5-3-default
```

The command needs Node.js and this checkout. It reads the committed-data path
`data/base-variant-records/records.json` in this checkout; it does not fetch a
newer Catalog, contact a registry or cluster, or install anything. Local edits
to that file affect the result and its reported file hash.

The JSON response binds the exact Catalog file SHA-256 and the selected record's
canonical SHA-256. It returns the **whole record**, preserving source identity,
configuration digest and its role, inputs, lifecycle requirements, ownership,
assessment stages, evidence status and claim limits. It points to the existing
[BaseVariantRecord schema](../../schemas/base-variant-record.schema.json).
This envelope adds lookup identity; it does not replace the Catalog schema.

Record names are exact, case-sensitive identifiers from `metadata.name` in
[the record index](../../data/base-variant-records/records.json). No fuzzy match,
latest-version substitution or fallback occurs. A record name alone is not an
immutable reference: retain the returned hashes for repeatable review.

## Check the expected configuration identity

Pass `--configuration-digest SHA256` alongside `--name` to require the recorded
`spec.configuration.digest`. Both bare lowercase SHA-256 and `sha256:`-prefixed
forms are accepted. Obtain the expected value from the exact reviewed record;
do not reuse a package manifest or chart source digest.

The response preserves `spec.configuration.digestRole`. Current records use
canonical object sets, inventory files or literal YAML file hashes; these
represent different evidence and must not be relabeled as equivalent. A match
compares the value in the index. It does not recompute the rendered configuration,
verify an artifact signature, check a target, or establish runtime safety.

A mismatch returns a structured `digest-mismatch` result without a record. A
missing name returns `not-found`, also without a record. Neither case chooses
another version or relaxes a gate.

## Exit codes and integration

- **0:** `found`; one full record is available. Its evidence may still be blocked,
  incomplete or unsuitable for the intended deployment.
- **3:** `not-found`; inspect the record index and choose an exact identity.
- **4:** `digest-mismatch`; investigate the changed source or pin before retrying.
- **2:** invalid request or Catalog; stderr contains a sanitized JSON error and
  stdout is empty. Unknown or repeated options are rejected.

`--help` runs alone. The lookup is read-only; no approval or managed operation
is implied by a successful result. The reusable function lives in
[scripts/lib/catalog-record-lookup.mjs](../../scripts/lib/catalog-record-lookup.mjs).
Its tests preserve complete records and exercise missing identities, digest
mismatches, duplicate names, malformed requests and record size bounds.

This supplies a shared exact-lookup primitive for
[#1861](https://github.com/confighub/helm-expt/issues/1861). It is currently a
local repository command, not new cub syntax, a shipped plugin command or a
hosted API. Actual live-chat API calls, constrained checks, approval/job handling
and equivalent cub/plugin demonstrations remain separate acceptance work.
