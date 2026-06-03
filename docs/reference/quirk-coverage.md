# Quirk coverage — what we track, and what we don't track yet

The Level-2 support bar is "every Helm quirk a chart uses is modeled or explicitly disclosed, with
**zero silent gaps**." That promise applies to the *quirk taxonomy itself*: this page is the honest
audit of which Helm behaviours we detect and surface, and which we do not yet — so a quirk we can't
account for is disclosed here rather than silently missed.

Source of truth for per-chart facts: `data/chart-facts/chart-facts.csv` (regenerate with
`npm run chart-facts`). Per-chart control points: `recipes/<chart>/control-points.yaml`. Source
reconnaissance: `data/top500-catalog-analysis/source/source-feature-scan.raw.json`.

## Tier 1 — tracked and surfaced

Detected per chart, modeled in the recipe/variant, and shown in `chart-facts.csv`:

| Quirk | Where it shows |
| --- | --- |
| Hooks — post-install/upgrade/delete vs pre-* / test | `post_deploy_hooks`, `other_hooks`, `hook_status` (handled-by-lifecycle-policy) |
| Generated secrets (rand / cert / password funcs) | `generates_secrets`, `existing_secret` |
| CRDs (file-based and template-baked) | `crds`, `no_crds_variant` |
| Admission webhooks (validating + mutating) | `webhooks` |
| `lookup` (cluster reads at render) | control point `lookup`; pinned via capability/target-fact profile |
| `.Capabilities` (APIVersions / KubeVersion) | control point `capability-profile` |
| `tpl` / open extension slots (extraManifests) | `extension_slots`; control points `tpl`, `tpl-extension-slots`, `extension-slots` |
| Cluster RBAC, APIServices, stateful storage, PVCs, DaemonSets | control points `cluster-rbac`, `apiservice`, `stateful-*`, `pvc-policy`, `daemonset-workload` |
| Subchart dependencies + lock | control points `dependency-lock`, `bundle-dependencies` |
| `required` / `fail` (mandatory inputs) | `required_values` *(added)* |
| `values.schema.json` (input contract) | `values_schema` *(added)* |
| `.Release.IsInstall`/`.IsUpgrade` branching | `install_vs_upgrade` *(added)* |
| `NOTES.txt` (post-install guidance) | `notes` *(added)* |

## Tier 2 — scanned but not yet surfaced (cheap to add when needed)

The source scan records these per chart; they are not yet promoted into `chart-facts.csv`. Counts are
over our 100 recipe charts.

| Quirk | Scan field | Charts | Why it matters |
| --- | --- | ---: | --- |
| Time / UUID functions (`now`, `uuidv4`, …) | `timeUuidFuncs` | 17 | Non-deterministic render **distinct from secrets** — pinned today, but not flagged as its own axis |
| Semver comparison in templates | `semverCompare` | 40 | Version-conditional rendering — output depends on chart/app version logic |
| `.Files.Get` (bundled file injection) | `filesGet` | 15 | Manifest content pulled from files in the chart, not from values |
| Hook ordering / deletion semantics | `hookWeights`, `hookDeletePolicies` | 4 / 5 | Hook **weight ordering** and `hook-delete-policy` — beyond "has hooks" |

## Tier 3 — NOT scanned and NOT tracked (real coverage gaps)

These Helm behaviours are not detected by the scan and not modeled. They are the genuine open edges of
the taxonomy — listed so they are disclosed, not silently missed.

| Quirk | What it is | Risk if a chart uses it |
| --- | --- | --- |
| `helm.sh/resource-policy: keep` | resources deliberately retained on uninstall | orphaned objects; uninstall ≠ clean |
| CRD `spec.conversion` (conversion webhooks) | a CRD whose versions convert via a webhook | webhook must exist before CRs of another version are read |
| Cross-subchart `global.*` values | globals propagate into subcharts | a single value changes many subcharts; value-layering not modeled |
| `imagePullSecrets` / `global.imageRegistry` | image source + pull-secret overrides | air-gapped / private-registry installs need these user inputs, not surfaced |
| Pod Security Standards / OpenShift SCC | securityContext that is platform/version-sensitive | render valid on one cluster, rejected on another |
| Conditional subcharts (`condition` / `tags`) | dependencies toggled by tags/conditions | enabled object set varies; we capture one resolution |
| `--set-file` / `--set-json` inputs | values loaded from a file or raw JSON | cert bundles / structured inputs the wizard doesn't model |
| Post-renderers (kustomize / exec) | a post-render step rewrites the manifests | final applied objects differ from `helm template` |
| `.Capabilities.HelmVersion` branching | render depends on the Helm binary version | output not reproducible across Helm versions |

## How to extend coverage

- Tier 2 → Tier 1: add a column in `scripts/generate-chart-facts.mjs` reading the existing scan field
  (pattern: `scanHas(s, "<field>")`), then `npm run chart-facts`.
- Tier 3 → Tier 2: teach the source-feature scanner to detect the behaviour, then promote as above.

The extensibility principle holds: the taxonomy is designed to grow, and every chart's unmodeled
behaviour is a disclosed line here, never a silent pass.
