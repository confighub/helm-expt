# Apply policy profiles

Generated from [config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml).

The `catalog-standard` profile applies to helm, aicr, cub-installer, kubara, sveltos, rendered-config after their configuration has become ConfigHub data.

The live receipt records at least one policy-covered Space for every maintained starting format:

| Starting format | Live Spaces |
| --- | ---: |
| `helm` | 3 |
| `aicr` | 3 |
| `cub-installer` | 30 |
| `kubara` | 1 |
| `sveltos` | 1 |
| `rendered-config` | 2 |

## Common checks

Filter: `platform/helm-catalog-checks`

This filter names the 7 common checks explicitly:

`Space.Slug = 'platform' AND Slug ~ '^(aicr-training-images-pinned|aicr-training-secret-refs|digest-pinned-images|lifecycle-route-evidence|probes-declared|vet-placeholders|vet-schemas)$'`

| Check | Effect | Why |
| --- | --- | --- |
| `platform/vet-schemas` | block | Do not apply Kubernetes data that fails its declared schema. |
| `platform/vet-placeholders` | block | Do not apply placeholder credentials or unfinished values. |
| `platform/lifecycle-route-evidence` | block | Do not apply a lifecycle route that omits its scope or evidence, or claims automatic execution without an observed receipt. |
| `platform/aicr-training-secret-refs` | block | Do not apply an AICR training runtime that puts AI_API_KEY directly in the object instead of naming a Secret and key. |
| `platform/aicr-training-images-pinned` | warn | Report AICR training images that can change without a configuration revision. |
| `platform/digest-pinned-images` | warn | Report ordinary Kubernetes workload images that can change without a configuration revision. |
| `platform/probes-declared` | warn | Report ordinary long-running Kubernetes workload containers that have no readiness or liveness probe. |

## Approval required

Filter: `platform/helm-catalog-prod-gates`

Production releases and system configuration keep the 7 common checks and add one required approval:

`Space.Slug = 'platform' AND Slug ~ '^(aicr-training-images-pinned|aicr-training-secret-refs|digest-pinned-images|lifecycle-route-evidence|probes-declared|require-approval|vet-placeholders|vet-schemas)$'`

| Check | Effect | Why |
| --- | --- | --- |
| `platform/vet-schemas` | block | Do not apply Kubernetes data that fails its declared schema. |
| `platform/vet-placeholders` | block | Do not apply placeholder credentials or unfinished values. |
| `platform/lifecycle-route-evidence` | block | Do not apply a lifecycle route that omits its scope or evidence, or claims automatic execution without an observed receipt. |
| `platform/aicr-training-secret-refs` | block | Do not apply an AICR training runtime that puts AI_API_KEY directly in the object instead of naming a Secret and key. |
| `platform/aicr-training-images-pinned` | warn | Report AICR training images that can change without a configuration revision. |
| `platform/digest-pinned-images` | warn | Report ordinary Kubernetes workload images that can change without a configuration revision. |
| `platform/probes-declared` | warn | Report ordinary long-running Kubernetes workload containers that have no readiness or liveness probe. |
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
- Every live policy-covered Space records its SourceType, and the live receipt includes at least one Space for each maintained source type.
- Every Trigger is defined here with its function, arguments, effect, and description.
- The baseline filter selects exactly the seven baseline triggers and never selects require-approval.
- The approval-required filter selects the same seven baseline triggers plus require-approval.
- Production and system-configuration Spaces receive the approval-required filter.
- Other non-production Spaces remain on the baseline filter.
- A Space must not lose the seven baseline checks when approval is added.
- The profile is selected by labels or an explicit builder decision, not by a broad match on every platform trigger.

The live `helm-catalog` filters and their assigned Spaces were checked on **2026-07-27**. Read the [live receipt](./live-helm-catalog.yaml).

The [functional proof](../apply-policy-functional-proof/summary.md) uses temporary Units to show what happens at the apply boundary. Placeholder values, invalid Kubernetes data, and unapproved system configuration are blocked. After the test approves the exact head revision, the same system-configuration dry run is allowed. An unpinned image and missing probes are reported as warnings without blocking a dry run. The separate Hooks and CRDs receipt proves that an unsupported automatic lifecycle route is blocked.

Run:

```bash
npm run config-catalog:verify
npm run config-catalog:self-test
npm run config-catalog:policy:verify
npm run helm-org:policy:receipt:verify
# With a valid helm-catalog login:
npm run helm-org:policy:verify
```

The self-test inserts an approval into the common checks, removes a common check from the approval-required set, and changes a warning into a block. Each broken profile must fail. The receipt verifier checks the committed result without contacting ConfigHub. The live verifier re-reads ConfigHub and fails if the filters, checks, or Space assignments have changed.
