# Apply policy profiles

Generated from [config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml).

The `catalog-standard` profile applies to helm, aicr, cub-installer, kubara, sveltos, rendered-config after their configuration has become ConfigHub data.

## Common checks

Filter: `platform/helm-catalog-checks`

This filter names the five common checks explicitly:

`Space.Slug = 'platform' AND Slug ~ '^(digest-pinned-images|lifecycle-route-evidence|probes-declared|vet-placeholders|vet-schemas)$'`

| Check | Effect | Why |
| --- | --- | --- |
| `platform/vet-schemas` | block | Do not apply Kubernetes data that fails its declared schema. |
| `platform/vet-placeholders` | block | Do not apply placeholder credentials or unfinished values. |
| `platform/lifecycle-route-evidence` | block | Do not apply a lifecycle route that omits its scope or evidence, or claims automatic execution without an observed receipt. |
| `platform/digest-pinned-images` | warn | Report images that can change without a configuration revision. |
| `platform/probes-declared` | warn | Report workload containers that have no readiness or liveness probe. |

## Approval required

Filter: `platform/helm-catalog-prod-gates`

Production releases and system configuration keep the five common checks and add one required approval:

`Space.Slug = 'platform' AND Slug ~ '^(digest-pinned-images|lifecycle-route-evidence|probes-declared|require-approval|vet-placeholders|vet-schemas)$'`

| Check | Effect | Why |
| --- | --- | --- |
| `platform/vet-schemas` | block | Do not apply Kubernetes data that fails its declared schema. |
| `platform/vet-placeholders` | block | Do not apply placeholder credentials or unfinished values. |
| `platform/lifecycle-route-evidence` | block | Do not apply a lifecycle route that omits its scope or evidence, or claims automatic execution without an observed receipt. |
| `platform/digest-pinned-images` | warn | Report images that can change without a configuration revision. |
| `platform/probes-declared` | warn | Report workload containers that have no readiness or liveness probe. |
| `platform/require-approval` | block | Require one recorded approval before production or system configuration is applied. |

## Operational resource classes

The source format does not decide the risk. A Helm chart, AICR package, or ordinary YAML file can describe any of these:

| Resource class | Normal policy | Production policy | Why |
| --- | --- | --- | --- |
| `user-workload` | common checks | common checks plus approval | Application teams can revise workloads frequently; production still needs an explicit approval. |
| `system-service` | common checks | common checks plus approval | Shared services such as DNS or monitoring use the common checks and add approval in production. |
| `system-configuration` | common checks plus approval | common checks plus approval | Cluster-wide platform choices have broad impact, so approval is required in every environment. |

## Scope rules

- Every supported configuration source type is named by this profile.
- Every Trigger is defined here with its function, arguments, effect, and description.
- The baseline filter selects exactly the five baseline triggers and never selects require-approval.
- The approval-required filter selects the same five baseline triggers plus require-approval.
- Production and system-configuration Spaces receive the approval-required filter.
- Other non-production Spaces remain on the baseline filter.
- A Space must not lose the five baseline checks when approval is added.
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

The self-test inserts an approval into the common checks, removes a common check from the approval-required set, and changes a warning into a block. Each broken profile must fail. The receipt verifier checks the committed result without contacting ConfigHub. The live verifier re-reads ConfigHub and fails if the filters, checks, or Space assignments have changed.
