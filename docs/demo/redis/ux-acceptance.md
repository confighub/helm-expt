# Redis UX Acceptance

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

This checks whether the Redis proof is simpler and more convincing than plain
Helm for a skeptical Helm user.

## Verdict

```text
Current proof: credible, but not yet polished.
```

The underlying value is now visible:

```text
correct variants
safe operations
immediate proof
```

The remaining UX problem is the command shape. The proof uses real `cub installer`
commands, but the demo still exposes more flags than the final product should.

## Easier Than Helm

What is better now:

| Helm alone | Current ConfigHub proof |
| --- | --- |
| Render/install output is a moment in time. | The rendered variant is stored, checked, uploaded, and receipt-backed. |
| The operator must manually compare values, YAML, and releases. | `npm run redis:compare` proves Helm semantic equivalence and classifies differences. |
| Secrets can be mixed into rendered output. | Default Secret is separated; reuse-existing-secret is modeled as a target fact. |

What is not yet easy enough:

```text
cub installer setup --pull ... --base ... --work-dir ... --namespace ...
```

This is real, but not the final happy path. The future porcelain can be shorter
only after the current proof stays correct.

## Safer Than Helm

The proof is safer because it records:

- source and dependency locks;
- effective values;
- variant revisions;
- rendered object digests;
- Helm equivalence receipts;
- scan receipts and gates;
- package determinism receipts;
- ConfigHub upload and OCI-read receipt;
- expected external Secret references.

Production is not falsely allowed. The current scan gate warns and blocks
production until findings are resolved or explicitly waived.

## Correct Versus Helm

The current proof shows:

| Variant | Helm objects | cub installer objects | Explanation |
| --- | ---: | ---: | --- |
| default | 14 | 15 | All Helm objects match; cub adds Namespace support object and separates one Secret. |
| reuse-existing-secret | 13 | 14 | All Helm objects match; cub adds Namespace support object; target Secret is required externally. |

Every intentional difference is named before upload.

## Five-Minute Test

A skeptical user should understand this in under five minutes:

```text
Helm generated the Redis objects.
ConfigHub preserved those objects as variants.
ConfigHub proved the output matches Helm.
ConfigHub separated or externalized secret handling.
ConfigHub uploaded the exact objects into named spaces.
ConfigHub exposed OCI-readable proof for the uploaded Units.
```

## Acceptance Status

| Requirement | Status |
| --- | --- |
| One install/render action | Pass, using current `cub installer setup`. |
| One review/proof action | Pass, using `npm run redis:compare` and `npm run verify`. |
| One publish/upload action | Pass, using `cub installer upload`. |
| Exact object proof | Pass. |
| Helm equivalence | Pass. |
| Intentional differences explained | Pass. |
| Scan/gate shown | Pass, with production blocked. |
| Hosted ConfigHub OCI proof | Pass for representative Units. |
| Final polished UX | Not yet; current commands need porcelain later. |

## Next UX Improvement

Keep the current proof as the invariant, then design a thin command wrapper or
plugin that reduces the visible path to:

```text
install
review
publish
```

Do not introduce that shorthand into executable docs until it exists.
