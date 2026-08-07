# Brief: the catalog consumer contract

Status: proposal, 2026-08-07, from detailed feedback by the catalog's first serious external consumer. Their integration reads catalog.json and the published package files browser-side over HTTPS, imports Units from `package_path`, and re-imports on upgrade. The feedback names exactly where our implicit contract bites a real integrator; this brief turns it into commitments and routed work.

## Commitments to adopt

1. **A digest for the bytes consumers fetch.** `published_digest` today is the SHA-256 of the installer `.tgz`, not of `upstream.yaml` — so the file consumers actually retrieve has no publisher digest, and they hash it themselves purely for change detection. Fix in two layers: add `rendered_yaml_sha256` per chart and base to catalog.json now, and note that the certified-bundle receipt (schema shipped in #1299) is the durable answer: a per-file SHA-256 manifest beside every artifact. This is the single change that most unblocks safe unattended ingestion.
2. **Publish `rendered_yaml_path` per chart and base.** Consumers currently construct `packages/<repo>/<chart>/<version>/bases/<base>/upstream.yaml` by convention; the string appears nowhere in the index. Every path a consumer needs must come from the JSON. Adopt that as a stated contract rule: no path reconstruction, ever.
3. **A change feed.** catalog.json is 4 MB (243 KB gzipped) and generated-at.txt shares its `max-age=600`, so neither works as a canary. Emit a few-KB `changes.json` — chart, version, base, digest, generated-at — from the same generator to the same static hosting, so a background poller becomes viable.
4. **Regeneration in CI with a named owner and cadence.** The catalog currently regenerates on a workstation (a temporary local path even leaked into a committed receipt — a hygiene bug to fix in the same pass), and fourteen charts already report update-available. This needs a scoped refresh workflow — the affected chart lanes only, never the full generator suite — plus an explicit owner and cadence decision.
5. **Never delete a published version.** Consumers record `package_path` and re-import from it; a vanished path becomes a broken upgrade instead of a clean signal. Additive-only retention is already our practice; state it as a commitment, and mark deprecations instead of removing files.
6. **A `schema_version` field and field-meaning stability.** Today's index is flat strings with semicolon-delimited multi-values (`bases: "default;no-crds"`, counts as strings). Consumers have coded to it. Add `schema_version: 1`, document the v1 quirks as frozen, and reserve changes of meaning for a versioned v2.

## Explicitly keep

- **CORS `*` and strong ETags on the static files.** This is what makes browser-side consumption with zero server egress possible. Moving the catalog behind auth or making OCI the only route would turn a UI feature into a backend project. Stated as a contract clause.
- **`object-inventory.yaml`.** Consumers use its `apiVersion|Kind|namespace|name` rows, and it is exactly the per-resource identity map that per-file Unit splitting and ConfigHub resource-identity keying need. It stays.

## Signal quality

110 of 130 charts carry no production assessment, so consumers render the field as neutral rather than as a warning — at that coverage the badge carries no weight. Scope the fix instead of boiling the ocean: assess the seven flattening-verdict charts and the top-20 first, where review effort already exists.

## Routing

Items 1 (tactical field), 2, 3, and 6 are one contained catalog-generator change plus an index schema note; item 1's durable layer is already the certified-bundle workstream. Item 4 needs an owner-and-cadence decision before implementation. Item 5 and the two keep-clauses are documentation of existing practice. The assessment-coverage work rides with the flattening-safety verdicts.
