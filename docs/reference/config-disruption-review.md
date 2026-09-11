# Review a configuration change for static disruption risks

The repository adapter compares two local manifest files and returns JSON. It
uses the same [classifier](../../scripts/lib/config-disruption-review.mjs) as the
[retained proof cases](../../data/config-disruption-review/report.json).
It needs Node.js, Python 3 and PyYAML. It needs no account or cluster.

From the repository root, compare the retained Prometheus bases:

```sh
node scripts/review-config-disruption.mjs \
  --before recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/release-objects.yaml \
  --after recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/no-crds/r001/rendered/release-objects.yaml
```

The candidate omits ten CRDs. The result flags their compatibility/lifecycle
risk; it does not establish that a delivery controller will delete them.
Pruning, ownership and retention policy remain unassessed.

## Input and result contract

Use exactly one `--before FILE` and one `--after FILE`, or `--help` alone.
Inputs may contain YAML object documents or a JSON array of objects. Empty
comment-only YAML documents are skipped; explicit null documents are rejected. Use `[]`
for an explicitly empty object set. Paths resolve from the caller's working
directory. Inputs are local regular files; no URL retrieval, rendering,
cluster operation or output-file write occurs.

The adapter rejects malformed objects, duplicate identities or mapping keys,
YAML aliases, non-object documents, and inputs exceeding its size, nesting or
object-count limits. Each file is limited to 10 MiB, 1,000 JSON objects or YAML documents (including
empty separators), and 64 levels
of nesting; parsing has a five-second timeout. Convert an alias-based manifest
to explicit objects before review. Split oversized inputs into coherent scopes
and retain each scope's identity; separate reviews do not prove dependencies
between those scopes.

Successful output has kind `ConfigDisruptionReview`, schema version `1`, the
SHA-256 of each input file's exact bytes, object counts, and a `review` object.
The review binds object identities to canonical before/after hashes, changed
JSON Pointer paths and static rules. Field values and local paths are omitted.
Object names and field names remain visible; this is not an anonymization
service, and callers decide where to disclose the report.

Exit code **0** means a valid comparison was produced, including a
`review-required` result. It never means approved, deployable or safe.
Exit code **2** means the request could not be reviewed; stdout is empty and
stderr contains a sanitized JSON error. Fix the inputs or prerequisites and
retry; do not interpret an error as an empty diff.

## Interpreting the categories

- `replace-immutable-field`: an apps/v1 Deployment selector changed. The API
  rejects an in-place patch; replacement requires a separate delivery decision.
- `recreate-workload`: an apps/v1 workload Pod template changed. The resulting
  strategy affects replacement; OnDelete and partitioned rollouts need care.
- `crd-or-apiversion-change`: API compatibility or CRD lifecycle needs review.
- `unclassified`: the classifier cannot establish the change's runtime effect.

`no-config-change` means the supplied object sets compare identically. It does
not establish live health. Rules are scoped hazard indicators, not an exhaustive
assessment of every changed field. Review all changed paths and the returned
`unassessed` list.

The adapter currently supports repository and local agent use. It is not new
`cub` syntax, a packaged plugin, a hosted API, or a completed live-chat API demo.
Those entry paths remain tracked in [#1861](https://github.com/confighub/helm-expt/issues/1861).
Driver/drain and dependency-order rules, preview integration and target evidence
remain in [#1660](https://github.com/confighub/helm-expt/issues/1660).
Runtime continuity, rollback data safety and rollback success require separate
proofs under [#1582](https://github.com/confighub/helm-expt/issues/1582).

## Verification

Run `npm run disruption-review:verify` to check the retained proof and the
classifier and adapter tests. These verify configuration behavior and input
handling; they do not run a fleet upgrade.
