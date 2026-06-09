# NPM Test And Verification Scripts

The `npm` scripts are the repository's proof harness. They answer three
questions:

```text
Are the committed artifacts internally consistent?
Do the installer packages still render what the receipts say they render?
Which catalog/data files need to be regenerated after a change?
```

Most scripts use Node.js built-ins and do not need `npm install`. Some scripts
shell out to `cub`, `cub installer`, `helm`, `kubectl`, `kind`, or ConfigHub
when they are exercising installer, upload, or live-cluster paths.

## Test Cadence

Use the narrowest check that proves the change you made. The full verifier is
the release gate, not the default inner-loop command.

| Situation | Run | Why |
| --- | --- | --- |
| Editing one doc or one generated-data summary | The matching `*:verify`, plus `npm run docs:verify` if links or doc location changed | Catches stale generated output and broken docs without spending time on unrelated chart proofs. |
| Editing one top-20 chart proof script | `<chart>:verify-proof`, `<chart>:verify-package`, and `<chart>:verify-proof:self-test` | Proves the chart's receipts, package, and tamper rejection before touching broader lanes. |
| Editing the shared proof kit | Representative chart checks that exercise the changed hook, then all 19 non-Redis top-20 `verify-proof` and `verify-package` checks | Keeps proof-kit work scoped while still proving the shared path across the migrated charts. |
| Editing recipe/package structure or target facts | Chart-specific proof/package checks, `npm run verify:artifact-chain`, and `npm run installer:target-facts:verify` when target facts changed | Proves the recipe/package graph and installer-native fact bindings. |
| Editing status, catalog, or CSV generators | The generator's own `*:verify`, then `npm run data:index:verify` if a CSV was added, removed, or renamed | Keeps front-door data discoverable and prevents stale summaries. |
| Before merging a broad PR or after several related PRs land | `npm run verify` | Runs the complete committed-artifact gate once the scoped checks already passed. |
| Before a public demo, release note, or external review | `npm run verify`, plus the specific live receipt verifier for the lane being shown | Separates corpus self-consistency from the live proof being demonstrated. |

Live tests are not the default proof loop. Run them when the goal is to create
or refresh live evidence:

| Live evidence needed | Run |
| --- | --- |
| Local Kubernetes receipt for top-20 rows | `npm run top20:local-e2e` |
| GitOps/OCI runtime receipt | `tests/chart-install-test` or `tests/chart-install-sweep` |
| Strict Helm-vs-installer live parity | `npm run kind-parity:run` or `npm run kind-parity:run-top20-variants:missing` |
| Rerun current live parity residue | `npm run live-parity:rerun-plan` first, then the exact command from the generated plan |
| Derived ConfigHub variant target proof | `tests/target-bound-derived-variant-test` |
| Controller-owned or hook-like lifecycle proof | The chart-specific lifecycle runner, such as `npm run lifecycle:cert-manager-eso` |

Treat live runs as evidence-producing work. Commit the receipt and regenerate the
summary that indexes it, or do not claim the lane changed.

Run the strict live parity lane serially. Its cleanup step owns kind clusters
for that lane, so concurrent parity runs can remove another in-flight run's
cluster and produce misleading failures.

## Chart Refresh Cadence

The catalog should keep the currently supported chart version and any candidate
new version separate until promotion evidence exists.

| Task | Command | Rule |
| --- | --- | --- |
| Check whether supported top-20 charts have newer upstream versions | `npm run top20:latest-refresh` | Produces candidate data only. It does not replace the supported catalog version. |
| Render and inspect latest-version candidates | `npm run top20:latest-candidates` | Candidate artifacts live under the latest-candidate data path until promotion review. |
| Decide whether a candidate can replace a supported version | `npm run top20:latest-promotion-readiness` | Replacement needs render proof, gap review, and any required live or lifecycle receipts. |
| Keep old supported versions useful | `npm run legacy-patch:review` | Older versions may remain valuable for patch, audit, and enterprise support. Do not delete them just because upstream moved. |
| Review top100/top500 evidence | `npm run top100:readiness`, `npm run top100:catalog`, `npm run top500:catalog` | These are planning and corpus views. They are not live-install claims for every chart. |

Supported catalog movement should be explicit:

```text
current supported version
-> latest candidate render/proof
-> gap and quirk review
-> live or lifecycle evidence where needed
-> catalog promotion decision
```

## Script Naming Rules

| Pattern | Meaning | Mutates files? |
| --- | --- | --- |
| `*:verify` | Recompute expected output in memory and fail if committed files are stale. | No |
| `*:generate` or bare generator name | Rewrite generated files. | Yes |
| `*:self-test` | Prove a verifier rejects tampered data. | No committed changes |
| `<chart>:compare` | Compare or verify Helm-equivalence for one chart. Redis reruns `helm template`; most curated chart commands currently verify `cub installer setup` against the stored Helm-rendered object set. | Usually no |
| `<chart>:generate-*` | Rebuild one chart's proof or package artifacts. | Yes |
| `top20:local-e2e` | Run live local-kind tests and write receipts. | Yes |
| `redis:verify-install:*` | Check a user's own Redis install. | Writes receipts under `.tmp/` |
| `verify-bulk-ops:*` | Check a user's own ConfigHub bulk-ops tutorial state. | Writes receipts under `.tmp/` |

## Common Commands

| Command | What it checks | When to run |
| --- | --- | --- |
| `npm run top20:verify-local-e2e` | The committed top-20 local-kind observation receipts exist and pass schema/content checks. | Quick public proof check. |
| `npm run verify` | Full repository verification chain: proof contracts, docs, command surface, recipes, packages, receipts, catalog data, site data, scans, and model completeness. | Before merging broad changes. |
| `npm run p0:contracts` | P0 proof contracts: schemas, capability profiles, freshness SLO, corpus invariants, and scale data. | When changing schemas, proof model, or scale/corpus data. |
| `npm run docs:verify` | Markdown files live in expected locations and links resolve. | When adding, moving, or renaming docs. |
| `npm run installer:command-surface:verify` | Static stale-command check: rejects old `cub install` wording, old command-array forms, and known stale variant examples. It does not compare every flag against live `cub --help`. | When touching docs/scripts with CLI examples. |
| `npm run variant:command-surface:verify` | Static `cub variant` command check: accepts current `cub variant create`, rejects non-current subcommands unless they are clearly described as planned/future, and rejects stale `--extends` or `--space` examples. | When touching `cub variant` examples, derived-variant docs, ConfigHub proof receipts, or production-disposition receipts. |
| `npm run lane-tests:verify` | Generated lane-test matrix is current for every chart-recipe-variant row. Missing live lanes are reported as backlog, not hidden. | When adding variants, receipts, or live-test lanes. |
| `npm run site:verify` | Generated static site files match current catalog data. | When changing catalog data surfaced by `site/`. |
| `npm run derived-variants:verify` | Intended-state derived variant receipts are present and prove clone/link/gate evidence. | When changing derived variant goldens or clone receipts. |
| `npm run derived-variants:target-bound:verify` | Target-bound derived variant receipts are present and prove live ConfigHub OCI/Argo/runtime evidence for exact derived variants. | When adding or changing target-bound derived variant evidence. |
| `npm run derived-variants:target-bound:summary:verify` | Generated target-bound derived variant summary is current with the committed receipts. | When adding or changing target-bound derived variant evidence. |
| `npm run scan-disposition:workdown:verify` | The scan warning routing table is current with the external scan lane and production next-action queue. | When changing external scan output, production dispositions, image pins, or supported-base hardening policy. |

## Where Helm And ConfigHub Actually Run

| Lane | Commands or files | What happens |
| --- | --- | --- |
| Fresh Helm-vs-installer comparison | `npm run redis:compare`; `<chart>:generate-proof`; `scripts/generate-variant-proof.mjs`; `npm run next80:generate` | Runs `helm pull` or `helm template`, captures rendered objects, runs `cub installer setup`, and records Helm-equivalence receipts. |
| Installer package execution | `<chart>:verify-package`; most curated `<chart>:compare` commands | Runs `cub installer package` and `cub installer setup`, then compares the installer output with the stored Helm-rendered object set. |
| ConfigHub proof, no cluster | `npm run top20:confighub-proof`; `runs/*-confighub-proof/latest/*receipt.yaml` | Runs `cub installer setup`, `cub installer render`, `cub installer upload`, `cub variant create`, Unit reads/diffs, function scans, and safe-ops checks. |
| Local cluster apply, no ConfigHub | `npm run top20:local-e2e`; `npm run redis:local-e2e` | Applies committed rendered objects to kind with `kubectl`, waits for workloads/PVCs/CRDs, and writes observation receipts. |
| ConfigHub to OCI to Argo live path | `tests/chart-install-test`; `tests/chart-install-sweep`; `tests/existing-secret-proof` | Runs `cub installer setup`, uploads Units, applies Units to OCI, creates an Argo Application, waits for sync/health, and checks runtime workloads. |
| Strict two-cluster Helm parity | `npm run kind-parity:run`; `tests/live-helm-installer-kind-parity-test` | Creates two vanilla kind clusters, runs regular Helm on one, runs `cub installer setup` plus `kubectl apply` on the other, then compares semantic objects and readiness. |
| Strict top-20 variant parity | `npm run kind-parity:run-top20-variants:missing`; `npm run kind-parity:run-top20-variants` | Runs the strict two-cluster parity harness for all maintained top-20 chart variants, either only missing receipts or the full set. |
| Live parity rerun queue | `npm run live-parity:rerun-plan`; `data/live-parity-rerun-plan/summary.md` | Reads the current live parity CSVs and lists the non-pass rows, diagnosis, and exact rerun command for the next live-testing pass. |
| Target-bound derived variant live path | `tests/target-bound-derived-variant-test`; `cub variant create --target`; `npm run derived-variants:target-bound:verify`; `runs/derived-variant-target-bound/**/receipt.yaml` | Clones a reviewed uploaded base Space, binds the cloned Units to a real target, applies workload Units to OCI, reconciles with Argo, and records runtime evidence. |
| Target-bound derived variant summary | `npm run derived-variants:target-bound:summary:verify`; `data/derived-variant-target-bound/summary.md` | Gives humans one generated table for target-bound derived variant pass, blocked, and watch receipts. |
| User-side Redis checks | `redis:verify-install:render`, `redis:verify-install:cluster`, `redis:verify-install:confighub` | Checks a user's Redis tutorial render, cluster state, or ConfigHub Space against `install-checks.yaml`. |

The strict two-cluster parity harness is the preferred default for proving that
regular Helm and `cub installer` reach the same outcome for one chart/base row.
The existing ConfigHub/OCI live comparator remains the delivery proof. Use
`data/lane-test-matrix/summary.md` for the exact pass/missing state across the
corpus.

If a pinned chart version is available through OCI but no longer appears in the
classic Helm repository index, pass an OCI repository override:

```sh
npm run kind-parity:run -- \
  --chart bitnami/nginx --version 24.0.2 --base http-clusterip \
  --repo-url oci://registry-1.docker.io/bitnamicharts
```

The strict two-cluster and ConfigHub/OCI live parity runners treat `oci://...`
repo URLs as OCI chart repositories and omit Helm's `--repo` flag.

The generated corpus control surface for these lanes is
`data/lane-test-matrix/`. Its doctrine is
`docs/reference/lane-test-doctrine.md`.

For live reruns, use `data/live-parity-rerun-plan/summary.md`. It keeps
infrastructure blocks, runtime watch rows, and possible parity defects separate
before anyone changes a recipe.

## User-Install Verification

These scripts are for an outside user who followed the Redis demo and wants to
prove their own result matches the catalog.

They are not the repo-wide proof harness. `npm run verify` uses the committed
per-chart proof scripts and generated-data verifiers. Redis participates in
that same chain with `redis:verify-proof`, `redis:verify-package`, and
`redis:verify-confighub-proof`; `redis:verify-install:*` is an extra user-demo
check because Redis is the first human quick-start path with an
`install-checks.yaml`. The generic `verify-install:*` scripts are compatibility
aliases for charts that have their own `install-checks.yaml`; they are not a
repo-wide chart verifier.

| Command | Stage | What it proves |
| --- | --- | --- |
| `npm run redis:verify-install:render -- --base default --work-dir <dir> --namespace redis` | After `cub installer setup` | The user's rendered Redis objects semantically match the canonical catalog render. |
| `npm run redis:verify-install:cluster -- --base default --context <ctx> --namespace redis` | After `kubectl apply` | The user's cluster has the expected Redis StatefulSets, PVCs, and Redis PING behavior. |
| `npm run redis:verify-install:confighub -- --base default --space <space>` | After `cub installer upload` | ConfigHub has the expected Redis Units and labels. |

These currently ship for Redis only:

```text
recipes/bitnami/redis/25.5.3/install-checks.yaml
```

Other charts have their chart-specific proof/package scripts, but not
Redis-style user-install checks until their own `install-checks.yaml` files are
added.

## User Bulk-Ops Verification

This script is for a user who followed the NGINX bulk scan and patch tutorial.
It talks to the current ConfigHub organization, so it is not part of the
offline `npm run verify` chain.

| Command | Stage | What it proves |
| --- | --- | --- |
| `npm run verify-bulk-ops:nginx -- --space helm-nginx-http-clusterip --changeset nginx-bulk-hardening` | After the NGINX bulk-ops tutorial | The changeset exists, 6 NGINX Units are selected, production gates are present, Units are approved, the Deployment image is `nginx:1.25.5`, and `vet-format` passes. |

## Per-Chart Proof Scripts

The top-20 curated charts have chart-specific scripts:

```text
<chart>:compare
<chart>:verify-proof
<chart>:verify-proof:self-test
<chart>:verify-package
<chart>:generate-proof
<chart>:generate-package
```

Use them when working on one curated chart. For example:

```sh
npm run prometheus:compare
npm run prometheus:verify-proof
npm run prometheus:verify-package
```

Implementation note:

```text
Redis remains bespoke because it carries the first user-install verification
path and Redis-specific quick-start checks.

The other 19 top-20 chart scripts share scripts/lib/proof-kit.mjs. Their
per-chart files are declarative specs plus chart-specific assertions.
```

That means a proof-model change usually belongs in the shared proof kit, while
a chart-specific object assertion, value choice, or scan finding belongs in the
individual `<chart>-proof.mjs` spec.

For non-curated charts, the broader generators and verifiers own the proof
surface:

```sh
npm run next80:verify
npm run next80:verify:self-test
npm run verify:artifact-chain
```

The top-100 data keeps proof state separate from remaining capability work:

```text
catalog_status       whether the chart has a maintained proof surface
not_yet_enabled      which recommended capabilities still have hard gaps
```

## Catalog And Data Scripts

These keep the generated catalog/data surfaces current.

| Command | Purpose |
| --- | --- |
| `npm run catalog:pain-reports` / `catalog:pain-reports:verify` | Per-chart Helm pain reports. |
| `npm run chart-facts` / `chart-facts:verify` | One-row-per-chart facts for the 100 maintained recipes. |
| `npm run outcomes:generate` / `outcomes:verify` | Front-door outcome tables for charts, bases, derived variants, and features. |
| `npm run production:disposition` / `production:disposition:verify` | Top-20 production support boundary: accepted dispositions, open blockers, and next actions. |
| `npm run production:disposition:details` / `production:disposition:details:verify` | Detailed production disposition plan and production next-action queue. |
| `npm run extension-slots` / `extension-slots:verify` | NGINX-like extension-slot coverage: charts, surfaces, routing, and evidence. |
| `npm run nginx:config-checks` / `nginx:config-checks:verify` | NGINX supported-base checks for empty config extension slots, sidecars, metrics, raw objects, and ingress shape. |
| `npm run top20:base-readiness` / `top20:base-readiness:verify` | Top-20 base-variant readiness: start-here bases, proof-backed bases, prerequisites, runtime review, and hook lifecycle rows. |
| `npm run top100:readiness` / `top100:readiness:verify` | Top-100 readiness view: adoption bucket, strongest evidence, hard gap, next action, and queue source. |
| `npm run top100:catalog` / `top100:catalog:verify` | Top-100 maintained recipe/package proof surface. |
| `npm run top500:catalog` / `top500:catalog:verify` | Top-500 source/catalog evidence map. |
| `npm run completeness:generate` / `completeness:verify` | Level-2 support and variant-rich counts. |
| `npm run variant-backlog:generate` / `variant-backlog:verify` | Recommended-but-not-built variant backlog. |
| `npm run quirk-queue:generate` / `quirk-queue:verify` | Quirks disclosed but still needing review or follow-up. |
| `npm run attack-plan:generate` / `attack-plan:verify` | Generated workdown for import, gaps, variants, production, runtime/GitOps, latest candidates, and image digests. |
| `npm run runtime-gitops:wave` / `runtime-gitops:wave:verify` | First Argo/Flux OCI live-proof wave and required receipt paths. |
| `npm run hooks:lifecycle` / `hooks:lifecycle:verify` | Maintained charts with Helm hooks and required lifecycle receipt paths. |
| `npm run lifecycle:boundary` / `lifecycle:boundary:verify` | Boundary table separating hook lifecycle queue rows from hook-like lifecycle observations. |
| `npm run image-digests:workdown` / `image-digests:workdown:verify` | Rendered image digest review queue by chart and variant. |
| `npm run next-ten:waves` / `next-ten:waves:verify` | Compact next work rows for gaps, latest promotion, variants, production disposition, and import examples. |
| `npm run status:dashboard` / `status:dashboard:verify` | One-page status dashboard and top-20 chart status CSV. |
| `npm run site:generate` / `site:verify` | Static site data and HTML generated from current catalog/status inputs. |
| `npm run catalog:index` / `catalog:index:verify` | Root `CATALOG.md`. |
| `npm run catalog:maps` / `catalog:maps:verify` | Per-chart catalog and artifact index maps. |
| `npm run data:index` / `data:index:verify` | Generated data README and machine-readable CSV index. |

For the current regeneration order, see `data/README.md`.

## Live And Runtime Scripts

These require a cluster or ConfigHub state. They are not part of the simple
fresh-clone check unless they are run in verify-only mode against committed
receipts.

| Command | Purpose |
| --- | --- |
| `npm run top20:local-e2e` | Run the top-20 local-kind test lane and write observation receipts. |
| `npm run top20:local-e2e:summary` | Regenerate the local-kind summary table. |
| `npm run top20:verify-confighub-proof` | Verify committed ConfigHub proof receipts for the top-20. |
| `npm run top20:confighub-proof` | Run ConfigHub proof for selected charts. |
| `npm run external-scan` | Run the external scan lane and write results. |

Standalone runtime tests live beside this file:

```text
tests/chart-install-test
tests/chart-install-sweep
tests/existing-secret-proof
```

Those are for `cub` + cluster execution. The `npm` scripts are the repo
verification and artifact-generation layer.

## Recommended Checks By Change Type

| Change | Minimum checks |
| --- | --- |
| Documentation only | `npm run docs:verify`; add `npm run installer:command-surface:verify` or `npm run variant:command-surface:verify` when the changed docs include `cub installer`, `cub install`, or `cub variant` examples |
| Generated data or catalog | The owner generator's matching `*:verify`; add downstream `*:verify` checks only when that downstream surface reads the changed data |
| Recipe or package | Chart-specific verify scripts if curated, plus `npm run verify:artifact-chain` |
| Top-20 chart proof | `<chart>:compare`, `<chart>:verify-proof`, `<chart>:verify-package`, and `npm run top20:verify-local-e2e` if receipts changed |
| Chart-facts/top100/top500 data | `npm run chart-facts:verify`, `npm run top100:catalog:verify`, `npm run top100:readiness:verify`, `npm run top500:catalog:verify`, plus `npm run status:dashboard:verify` if the front-door counters changed |
| Broad proof-model change | `npm run p0:contracts`, focused `*:verify` checks for changed surfaces, and `npm run verify` |

## Current Top-100 Reading

The top-100 is not a single readiness state.

```text
100 charts have recipe/package proof artifacts.
20 charts are catalog-supported for the declared local-test scope.
80 charts are proof-grade, but not yet catalog-supported.
54 charts are variant-rich.
46 charts are default-only.
25 charts have at least one hard gap for a recommended extra capability.
37 charts have buildable variant backlog where the path is known but not run.
```

Use `data/top100-catalog-analysis/summary.md`,
`data/chart-facts/summary.md`, and `data/model-completeness/summary.md`
together:

```text
top100 summary       = what proof surface exists
chart facts          = what quirks and hard gaps each chart has
model completeness   = whether the chart has Level-2 support under declared scope
variant backlog      = which useful variants still need build work
```
