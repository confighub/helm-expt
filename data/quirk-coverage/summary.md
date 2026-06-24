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

## Count Contract

The count columns intentionally separate source inventory from modeled support:

| Column | Meaning |
| --- | --- |
| `source_top100_count` | Public top-100 source-scan rows where this quirk was detected. |
| `modeled_or_supported_count` | Current chart facts, recipe artifacts, receipts, or maintained queues that model the quirk. The basis depends on the axis and is described in `current_treatment`. |
| `source_top500_count` | Public top-500 source-scan rows where this quirk was detected. |

Do not treat `modeled_or_supported_count` as a source count. Do not treat
`source_top100_count` as a support claim.

## Axes

| Axis | Coverage tier | Source top-100 | Modeled or supported | Source top-500 | Remaining gap |
| --- | --- | ---: | ---: | ---: | --- |
| `lookup-target-facts` | `tracked-and-surfaced` | 47 | 26 | 244 | Target-fact enforcement is stronger for selected charts than for every top-100 source row. |
| `generated-facts` | `tracked-and-surfaced` | 60 | 29 | 282 | Not every generated-fact path has field-level reachability yet. |
| `capability-profile` | `partly-tracked` | 81 | 49 | 370 | 161/199 render receipts declare renderer flags and kubeVersion. |
| `helm-flag-profile` | `partly-tracked` | n/a | 161 | n/a | 161/199 render receipts include the expected flag profile. |
| `hook-phase` | `partly-tracked` | 11 | 5 | 54 | Hook presence and phase are tracked, but lifecycle receipts are not complete. |
| `hook-delete-policy` | `source-scanned-not-surfaced` | 10 | 0 | 44 | Delete policy can change cleanup, rerun, and rollback behavior. |
| `hook-weight-ordering` | `source-scanned-not-surfaced` | 3 | 0 | 21 | Weight ordering affects lifecycle sequencing and may not map cleanly to GitOps. |
| `crds` | `tracked-and-surfaced` | 24 | 37 | 102 | CRD upgrade safety remains operator-reviewed. |
| `crd-upgrade-behavior` | `disclosed-not-complete` | 24 | 37 | 102 | Schema conversion and multi-version upgrade behavior are not fully modeled. |
| `install-vs-upgrade` | `tracked-and-surfaced` | 38 | 18 | 177 | It is not yet tied to upgrade-simulation receipts for every affected chart. |
| `dependency-lock` | `tracked-and-surfaced` | n/a | 110 | n/a | 110 dependency locks found. |
| `library-chart` | `tracked-by-lock-not-front-door` | n/a | 2 | n/a | Library chart presence is not yet a chart-facts column. |
| `dependency-alias` | `tracked-by-lock-not-front-door` | n/a | 6 | n/a | Alias-driven subchart identity can obscure where objects come from. |
| `import-values` | `not-scanned` | unknown | 0 | unknown | Imported subchart values can create hidden high-density value paths. |
| `required-or-fail` | `tracked-and-surfaced` | 71 | 33 | 309 | Not every required value has a typed user prompt. |
| `values-schema` | `tracked-and-surfaced` | 36 | 14 | 178 | Schemas are not yet centralized in a ConfigHub schema registry. |
| `tpl-extension-slots` | `tracked-and-surfaced` | 88 | 82 | 362 | Per-field provenance for arbitrary tpl content is not complete. |
| `explicit-extension-slot-control-points` | `tracked-and-surfaced` | 65 | 82 | 254 | The broader source scan sees more raw/extra manifest values than the current modeled chart-facts surface. |
| `semver-compare` | `source-scanned-not-surfaced` | 71 | 0 | 309 | It is not yet promoted to chart facts or variant-path coverage. |
| `files-get` | `source-scanned-not-surfaced` | 31 | 0 | 129 | Bundled-file content can affect rendered config without appearing in values. |
| `time-uuid-functions` | `source-scanned-not-surfaced` | 40 | 0 | 140 | These are distinct from secret generation and should be a separate nondeterminism axis. |
| `getHostByName` | `not-scanned` | unknown | unknown | unknown | DNS lookups during template render would make render depend on the network environment. |
| `resource-policy-keep` | `not-scanned` | unknown | unknown | unknown | Uninstall and prune behavior may leave intentional orphans. |
| `post-renderer` | `not-scanned` | unknown | unknown | unknown | Final applied objects can differ from helm template output. |
| `helm-version-branching` | `not-scanned` | unknown | unknown | unknown | Render output could vary by Helm binary version. |
| `global-values` | `not-scanned` | unknown | unknown | unknown | One value can affect many subcharts and objects. |

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
