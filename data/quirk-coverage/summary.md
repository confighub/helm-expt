# Quirk Coverage

This generated audit says which Helm quirks are tracked, partly tracked,
source-scanned only, or not scanned. It is a coverage map, not a support claim.

## Summary

| Coverage tier | Axes | Meaning |
| --- | ---: | --- |
| `disclosed-not-complete` | 1 | Disclosed and gated, but not yet fully modeled or live-proven. |
| `not-scanned` | 6 | Known blind spot in the current scanner/data model. |
| `partly-tracked` | 3 | Visible, but missing one or more lifecycle or per-chart proof pieces. |
| `source-scanned-not-surfaced` | 5 | Detected in source scan but not yet promoted to chart facts or outcome tables. |
| `tracked-and-surfaced` | 9 | Shown in generated chart/user data and tied to recipe or receipt evidence. |
| `tracked-by-lock-not-front-door` | 2 | Recorded in locks or artifacts but not yet promoted to front-door tables. |

## High-Value Counts

The NGINX chart exposes concrete extension slots such as `serverBlock`,
`streamServerBlock`, and `extraDeploy`. The broader catalog has many similar
surfaces: raw manifests, sidecars, extra config blocks, templated snippets, and
add-on slots.

~~~text
explicit extension-slot control points in top-20 catalog: 13/20
extension slots surfaced in current top-100 chart facts: 82/100
matched top-500 proof rows with extension slots: 53
top-500 source rows using tpl: 362/500
~~~

## Axes

| Axis | Coverage tier | Top-100 count | Top-500 count | Remaining gap |
| --- | --- | ---: | ---: | --- |
| `lookup-target-facts` | `tracked-and-surfaced` | 26 | 244 | Target-fact enforcement is stronger for selected charts than for every top-100 row. |
| `generated-facts` | `tracked-and-surfaced` | 29 | 282 | Not every generated-fact path has field-level reachability yet. |
| `capability-profile` | `partly-tracked` | 49 | 370 | 142/179 render receipts declare renderer flags and kubeVersion. |
| `helm-flag-profile` | `partly-tracked` | 142 | 179 | 142/179 render receipts include the expected flag profile. |
| `hook-phase` | `partly-tracked` | 5 | 54 | Hook presence and phase are tracked, but lifecycle receipts are not complete. |
| `hook-delete-policy` | `source-scanned-not-surfaced` | 5 | 44 | Delete policy can change cleanup, rerun, and rollback behavior. |
| `hook-weight-ordering` | `source-scanned-not-surfaced` | 4 | 21 | Weight ordering affects lifecycle sequencing and may not map cleanly to GitOps. |
| `crds` | `tracked-and-surfaced` | 37 | 102 | CRD upgrade safety remains operator-reviewed. |
| `crd-upgrade-behavior` | `disclosed-not-complete` | 37 | 102 | Schema conversion and multi-version upgrade behavior are not fully modeled. |
| `install-vs-upgrade` | `tracked-and-surfaced` | 18 | 177 | It is not yet tied to upgrade-simulation receipts for every affected chart. |
| `dependency-lock` | `tracked-and-surfaced` | 110 | 110 | 110 dependency locks found. |
| `library-chart` | `tracked-by-lock-not-front-door` | 2 | 2 | Library chart presence is not yet a chart-facts column. |
| `dependency-alias` | `tracked-by-lock-not-front-door` | 6 | 6 | Alias-driven subchart identity can obscure where objects come from. |
| `import-values` | `not-scanned` | 0 | 0 | Imported subchart values can create hidden high-density value paths. |
| `required-or-fail` | `tracked-and-surfaced` | 33 | 309 | Not every required value has a typed user prompt. |
| `values-schema` | `tracked-and-surfaced` | 14 | 178 | Schemas are not yet centralized in a ConfigHub schema registry. |
| `tpl-extension-slots` | `tracked-and-surfaced` | 82 | 362 | Per-field provenance for arbitrary tpl content is not complete. |
| `explicit-extension-slot-control-points` | `tracked-and-surfaced` | 82 | 53 | The top-500 count here only covers rows matched to current package proofs; the broader source scan sees tpl use separately. |
| `semver-compare` | `source-scanned-not-surfaced` | 40 | 309 | It is not yet promoted to chart facts or variant-path coverage. |
| `files-get` | `source-scanned-not-surfaced` | 15 | 129 | Bundled-file content can affect rendered config without appearing in values. |
| `time-uuid-functions` | `source-scanned-not-surfaced` | 17 | 140 | These are distinct from secret generation and should be a separate nondeterminism axis. |
| `getHostByName` | `not-scanned` | unknown | unknown | DNS lookups during template render would make render depend on the network environment. |
| `resource-policy-keep` | `not-scanned` | unknown | unknown | Uninstall and prune behavior may leave intentional orphans. |
| `post-renderer` | `not-scanned` | unknown | unknown | Final applied objects can differ from helm template output. |
| `helm-version-branching` | `not-scanned` | unknown | unknown | Render output could vary by Helm binary version. |
| `global-values` | `not-scanned` | unknown | unknown | One value can affect many subcharts and objects. |

## How To Use This

- Use `tracked-and-surfaced` axes in user-facing chart status and pain reports.
- Treat `partly-tracked` axes as visible, but not complete enough for a broad
  production claim.
- Treat `source-scanned-not-surfaced` axes as cheap next candidates for
  `chart-facts.csv` or variant-path coverage.
- Treat `not-scanned` axes as known blind spots. A chart may still be usable,
  but the project should not imply that this behavior was checked.

## Files

| File | Purpose |
| --- | --- |
| `data/quirk-coverage/coverage.csv` | One row per quirk axis and current coverage tier. |
| `docs/reference/quirk-coverage.md` | Reader-facing reference for this taxonomy. |
| `data/chart-facts/chart-facts.csv` | Per-chart surfaced feature facts. |
| `data/top500-catalog-analysis/source/source-feature-scan.raw.json` | Source scan backing the source-scanned axes. |

Regenerate:

~~~sh
npm run quirk-coverage
npm run quirk-coverage:verify
~~~
