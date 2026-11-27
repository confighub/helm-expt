# Nightly Package Updates

**UNOFFICIAL/EXPERIMENTAL**

Every chart the catalog packages lives in `packages/<repo>/<chart>/<version>/`,
one directory per chart version. Upstream keeps publishing new chart versions.
The nightly package update notices them and builds the new package version, so
the catalog does not fall behind unless a person decides it should.

It is `scripts/package-updates.mjs`, run each night by
`.github/workflows/packages-nightly.yml`. The model is the one the
`confighub/packages` repository uses: per package, find the newest upstream
version, update, test, commit. A failure leaves that package as it was, is
reported, and does not stop the others.

## What A Night Does

1. Checks that upstream has not changed the bytes behind a version the catalog
   already locked (`npm run flattening-witnesses:recheck`). Drift without a
   recorded decision stops the run.
2. For each packaged chart, compares the newest packaged version with the
   newest stable version upstream publishes. A Helm repository is read through
   its `index.yaml`; an OCI repository through the registry's tag list.
3. For each chart that moved, in a family the job can update (below):
   generates the new version with the generator that built the chart's newest
   package, runs that generator's own checks, checks that the new package
   keeps every base the previous version has, and commits the chart's files on
   their own. On any failure the chart's files are put back and the failure is
   reported. The pull request holds at most eight new versions a night
   (`--max`), so it stays reviewable; the rest follow once it is merged.
4. Regenerates the catalog views the new versions leave stale and commits
   them once (see [Catalog Views](#catalog-views)).
5. Pushes the commits to a `bot/package-updates-<date>` branch and opens one
   pull request, or replaces the branch and description of the one already
   open. It dispatches `full-verify.yml` and `site-verify.yml` on the branch,
   because a pull request opened with the workflow token starts no checks.
6. Opens an issue for each chart whose update failed, unless an open issue has
   the same title, and keeps one issue listing the charts that moved but need
   a person. The run ends red when an update failed.

Each new version also updates the chart's `packages/<repo>/<chart>/upstream.yaml`
and `data/ghcr-packages/packages.csv`, which list every version and the tag it
is published under, in the same commit as the version.

The job never pushes to `main` and publishes nothing. Merging the pull request
publishes: the publish workflow publishes every package version the registry
does not have on a push to `main`. So the pull request is reviewed as a
release.

## What The Reviewer Reads

The pull request body has one row per new version: the previous version, the
new one, the family that built it, and the objects each base renders, before
and after. A count that changed is marked.

Most proof declarations keep a table of object counts that a person reviewed
for each version (`versionExpectations` in `scripts/<chart>-proof.mjs`). A
version missing from the table is refused, and that stays true. The nightly
runs the generator with `HELM_EXPT_RECORD_EXPECTATIONS=1`, which renders the
missing version anyway and writes what it observed into the table, as the last
entry, next to the previous versions' entries. The entry is shown in the pull
request. It is an observation until the person merging accepts it; merging is
the review. A count the render cannot produce, such as a base the new version
no longer has, leaves the entry unwritten and the update failed. Entries
already in the table are never rewritten
([`scripts/lib/reviewed-expectations.mjs`](../../scripts/lib/reviewed-expectations.mjs)).

## Families

The family of a chart is read from the data: the `README.md` of its newest
package names the batch lane that built it, and a chart with a proof
declaration is found by the chart identity the declaration names. `FAMILIES`
in the script holds what each family can do.

| Family | Built by | Nightly |
| --- | --- | --- |
| `proof-kit` | `scripts/<chart>-proof.mjs` on `scripts/lib/proof-kit.mjs` | Updates. Generates against the exact upstream archive (URL and SHA-256), packages with the installer CI pins, syncs the packaged CRD bundle when a base declares target facts. |
| `next80` | `scripts/generate-next80-full-proofs.mjs --only <ref>` | Updates a chart whose package has only the `default` base. Moves the chart's corpus row to the new version and regenerates that chart, its proof-index row and the corpus lock. |
| `successor-track` | `scripts/generate-successor-track.mjs --chart <ref>` | Updates the same way, including the row's `appVersion`. |
| `kubara-catalog-3.0`, `kubara-catalog-1.1` | the Kubara coverage lists | Reported. The lists hold the versions a Kubara catalog pins; a newer version needs a proof declaration outside the list. |
| `nvidia-gpu-stack`, `aicr-nested-charts` | `scripts/nvidia-gpu-stack-coverage.mjs` | Reported. Each version is a reviewed entry with chart-specific bases; an AICR list holds only versions an AICR entry pins. |
| `bespoke` | a chart-specific script or a hand-made package | Reported. Nothing in the repository rebuilds it at another version. |

The corpus generators build only the `default` base. Many corpus packages also
carry bases another lane added (`no-crds`, `ha`, a reviewed controller base),
and a new version built by the corpus generator alone would drop them, so those
charts are reported as needing a person rather than attempted. For every
family, `--verify-update` also refuses a new version that lacks a base the
previous version has.

A declaration that pins its upstream archive by a constant SHA-256 (the ACK
charts) or decides a base by a list of versions (kube-prometheus-stack's
existing-Secret base) fails for a new version, and the failure is the report:
a person extends the declaration, then reruns `--update`.

## Not Yet In The Catalog Registry

A catalog entry names the digest a user pulls, so the catalog maps cannot list
a version before the catalog registry holds it, and their generators refused
any recipe without a publication receipt. Each version the update builds is
added to `data/package-updates/pending-publication.yaml`. The chart maps, the
signed package index and the Catalog records leave a listed version out until
its publication receipt exists. A missing receipt for a version not listed
still fails, and a listed version whose receipt exists fails the chain until
its entry is removed, so the register only ever holds versions that are truly
waiting.

## Catalog Views

A new package version leaves many generated views stale: catalog status,
chart maps, the package index summary, readiness reports, the site. Nothing
lists them. `--refresh-views` runs every derived-view gate in the verify chain
(a `--verify` whose script also has `--generate`), regenerates what each
failing gate names in its own message ("is stale; run npm run ..."), or runs
its `--generate`, in chain order, and repeats until the gates pass. The site
keeps its timestamp (`HELM_EXPT_SITE_GENERATED_AT`). A gate whose generator
renders charts, runs the installer or runs proof declarations rebuilds
evidence rather than a view, so it is never regenerated here; the nightly also
refuses a refresh that changes anything under `packages/` or a recipe's
renders, receipts or source lock.

## On A Laptop

Helm must be the build the render receipts record (`v4.1.4+g05fa379`), and
`python3` must have PyYAML. Package generation goes through
`scripts/run-with-pinned-installer.mjs`, which builds the installer commit CI
pins on first use.

```sh
# What moved, without writing anything.
node scripts/package-updates.mjs --latest
node scripts/package-updates.mjs --latest argo-cd/argo-cd kedacore/keda

# One chart, in the working tree. Without a version, the newest upstream one.
node scripts/package-updates.mjs --update argo-cd/argo-cd
node scripts/package-updates.mjs --verify-update argo-cd/argo-cd 10.20.0

# The catalog views the new version moves.
node scripts/package-updates.mjs --refresh-views

# What the workflow runs: commits on the current branch, report in a folder.
node scripts/package-updates.mjs --nightly --max 2 --report /tmp/package-updates

# Offline checks of the script itself.
node scripts/package-updates.mjs --self-test
```

`--nightly` refuses to start when `packages/`, `recipes/`, `scripts/` or
`data/` have uncommitted changes, because it commits.

## The Weekly Catalog Refresh

`.github/workflows/catalog-refresh.yml` recorded upstream movement for twenty
charts in `data/latest-top20-refresh/` and listed commands in a pull request.
The nightly now builds the packages for that movement, so two scheduled bots
would open two pull requests for one upstream release. The weekly refresh
keeps its manual trigger, for when the top-20 review views are wanted, and the
nightly runs its byte-drift recheck every night.
