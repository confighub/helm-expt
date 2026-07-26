# Apply policy profiles

Generated from [config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml).

The `catalog-standard` profile applies to helm, aicr, cub-installer, kubara, sveltos, rendered-config after their configuration has become ConfigHub data.

## Every matching Space

Filter: `platform/helm-catalog-checks`

This filter names the four allowed Triggers explicitly:

`Space.Slug = 'platform' AND Slug ~ '^(digest-pinned-images|probes-declared|vet-placeholders|vet-schemas)$'`

| Check | Effect | Why |
| --- | --- | --- |
| `platform/vet-schemas` | block | Do not apply Kubernetes data that fails its declared schema. |
| `platform/vet-placeholders` | block | Do not apply placeholder credentials or unfinished values. |
| `platform/digest-pinned-images` | warn | Report images that can change without a configuration revision. |
| `platform/probes-declared` | warn | Report workload containers that have no readiness or liveness probe. |

## Production

Filter: `platform/helm-catalog-prod-gates`

Production keeps the four baseline checks and adds one blocking approval:

`Space.Slug = 'platform' AND Slug ~ '^(digest-pinned-images|probes-declared|require-approval|vet-placeholders|vet-schemas)$'`

| Check | Effect | Why |
| --- | --- | --- |
| `platform/vet-schemas` | block | Do not apply Kubernetes data that fails its declared schema. |
| `platform/vet-placeholders` | block | Do not apply placeholder credentials or unfinished values. |
| `platform/digest-pinned-images` | warn | Report images that can change without a configuration revision. |
| `platform/probes-declared` | warn | Report workload containers that have no readiness or liveness probe. |
| `platform/require-approval` | block | Require one recorded approval before production apply. |

## Scope rules

- Every supported configuration source type is named by this profile.
- The baseline filter selects exactly the four baseline triggers and never selects require-approval.
- The production filter selects the same four baseline triggers plus require-approval.
- A non-production Space must never receive require-approval from this profile.
- A production Space must not lose the four baseline checks when approval is added.
- The profile is selected by labels or an explicit builder decision, not by a broad match on every platform trigger.

The live `helm-catalog` filters and their assigned Spaces were checked on **2026-07-26**. Read the [live receipt](./live-helm-catalog.yaml).

Run:

```bash
npm run config-catalog:verify
npm run config-catalog:self-test
npm run helm-org:policy:receipt:verify
# With a valid helm-catalog login:
npm run helm-org:policy:verify
```

The self-test inserts the earlier approval leak, removes a baseline check from production, and changes a warning into a block. Each broken profile must fail. The receipt verifier checks the committed result without contacting ConfigHub. The live verifier re-reads ConfigHub and fails if the filters, Triggers, or Space assignments have changed.
