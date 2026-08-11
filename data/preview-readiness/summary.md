# Preview & Dry-Run Readiness

Helm's render is not a pure function of `(chart, values)` — it depends on live cluster state at install time (`lookup`, `.Capabilities`, hooks, generated values, post-render mutation), so a naive `helm template` preview is untrustworthy for serious charts. The answer is not to re-render on every preview; it is to **render once at import, capturing the live-dependence as data, then preview/diff the held data**. The quirks become a one-time import problem. This surface names every preview-breaking quirk and says whether it is **shift-left-resolved** (captured into config pre-deploy) or **runtime residue** (declared + witnessed, never faked).

Of 26 tracked Helm quirk axes: **19 shift-left** (config-resolvable, previewable), **3 runtime residue** (witnessed after apply), **4 lifecycle/day-2** (not a preview question). The unpreviewable surface is small and named.

## Quirk -> preview disposition

| Quirk axis | Disposition | Mechanism | Coverage tier | Previewable |
| --- | --- | --- | --- | --- |
| `capability-profile` | shift-left | capability profile pins kubeVersion + apiVersions | partly-tracked | partial |
| `crds` | shift-left | CRDs in the render, or staged as a target fact | tracked-and-surfaced | yes |
| `dependency-alias` | shift-left | locked dependency | tracked-by-lock-not-front-door | partial |
| `dependency-lock` | shift-left | dependencies locked -> deterministic render | tracked-and-surfaced | yes |
| `explicit-extension-slot-control-points` | shift-left | captured as control points / values | tracked-and-surfaced | yes |
| `files-get` | shift-left | bundled files vendored with the chart | source-scanned-not-surfaced | partial |
| `generated-facts` | shift-left | generated-fact receipt (capture once, reuse) | tracked-and-surfaced | yes |
| `global-values` | shift-left | deterministic given captured values (scan gap) | not-scanned | partial |
| `helm-flag-profile` | shift-left | pinned renderer flags in the render receipt | partly-tracked | partial |
| `helm-version-branching` | shift-left | pin the Helm version in the render receipt | not-scanned | partial |
| `hook-phase` | shift-left | hook-minted object declared as a target fact; hook execution witnessed | partly-tracked | partial |
| `import-values` | shift-left | deterministic given captured values (scan gap) | not-scanned | partial |
| `install-vs-upgrade` | shift-left | render-once is install-shaped; upgrade reuse via held data | tracked-and-surfaced | yes |
| `library-chart` | shift-left | locked dependency | tracked-by-lock-not-front-door | partial |
| `lookup-target-facts` | shift-left | target fact (read from config or live, pre-deploy) | tracked-and-surfaced | yes |
| `required-or-fail` | shift-left | required values captured as an input contract | tracked-and-surfaced | yes |
| `semver-compare` | shift-left | deterministic given pinned versions | source-scanned-not-surfaced | partial |
| `tpl-extension-slots` | shift-left | deterministic given captured values | tracked-and-surfaced | yes |
| `values-schema` | shift-left | values.schema.json input contract | tracked-and-surfaced | yes |
| `getHostByName` | runtime-residue | DNS at render; bind a captured fact or witness | not-scanned | no (witness) |
| `post-renderer` | runtime-residue | final applied object differs from helm template; pin a recipe stage or witness | not-scanned | no (witness) |
| `time-uuid-functions` | runtime-residue | nondeterministic per render; capture-once or witness | source-scanned-not-surfaced | no (witness) |
| `crd-upgrade-behavior` | lifecycle | CRD schema upgrade safety (day-2, not preview) | disclosed-not-complete | n/a (day-2) |
| `hook-delete-policy` | lifecycle | uninstall/rerun cleanup behavior (day-2, not preview) | source-scanned-not-surfaced | n/a (day-2) |
| `hook-weight-ordering` | lifecycle | hook sequencing (day-2, not preview) | source-scanned-not-surfaced | n/a (day-2) |
| `resource-policy-keep` | lifecycle | uninstall/prune orphans (day-2, not preview) | not-scanned | n/a (day-2) |

## Shift-left adoption across the catalog

- **245/245** variants pin a `capabilityProfile` (capabilities shifted left)
- **89** variants declare `targetFacts` (lookup / hook-minted state shifted left)
- **64** `collector/target-facts.sh` scripts (read a fact from config or live, pre-deploy)
- **2** generated-fact receipts (generated values captured, not regenerated)

## Per-chart readiness (anchor charts)

| Chart | capabilities pinned | declared prerequisites | generated-fact captured | verdict |
| --- | --- | --- | --- | --- |
| `ingress-nginx/ingress-nginx/4.15.1` | yes | yes (witnessed) | no | **previewable + declared prerequisites (witnessed)** |
| `jetstack/cert-manager/v1.20.2` | yes | yes (witnessed) | no | **previewable + declared prerequisites (witnessed)** |
| `bitnami/redis/25.5.3` | yes | none | yes | **fully previewable pre-deploy** |
| `prometheus-community/kube-prometheus-stack/85.3.3` | yes | yes (witnessed) | no | **previewable + declared prerequisites (witnessed)** |

## Worked example: ingress-nginx

ingress-nginx is the hard case — it has all three classic preview-breakers.

- **Naive `helm template`** is wrong: the admission webhook certificate is minted by a hook Job at install (absent from a no-hooks render), the webhook `caBundle` is hook-patched afterwards, and the emitted PDB/Ingress apiVersions depend on the target's `.Capabilities`.
- **Shift-left preview** is right: the committed render is captured with a pinned `capabilityProfile` (`kubeVersion: 1.30.0`), and the hook-minted admission cert is declared as a `targetFact` (`requiredSecrets: ingress-nginx/ingress-nginx-admission`, *"normally created by Helm hook jobs"*), resolvable from config or live via the collector (`record`/`live` modes). The preview now states exactly what deploys **and** what must pre-exist.
- **Residue:** the cert *content* and the live `caBundle` are not pre-rendered — they are witnessed after apply (cub-scout), not faked.

## Honest residue (the genuinely unpreviewable surface)

These cannot be made a pure function of captured config; the honest answer is declare + witness, never a fake preview:

- `getHostByName` — DNS at render; bind a captured fact or witness
- `post-renderer` — final applied object differs from helm template; pin a recipe stage or witness
- `time-uuid-functions` — nondeterministic per render; capture-once or witness

## Next (breadth + rigor upgrades)

- A full top-100 roll-up: join `data/chart-facts/chart-facts.csv` (which quirks each chart has) with recipe artifacts to give a per-chart previewable verdict for the whole catalog.
- A live `helm template` vs shift-left render diff for ingress-nginx, committed as evidence (turns the worked example from described to measured).
- Promote the `not-scanned` residue axes (post-renderer, getHostByName, helm-version-branching) into scanner detection so a chart cannot hide an unpreviewable dependence.

## Regenerate

~~~sh
npm run preview-readiness:generate
npm run preview-readiness:verify
~~~
