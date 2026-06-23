# Roadmap

**UNOFFICIAL/EXPERIMENTAL.** This is the canonical roadmap index for
`helm-expt`. It does not replace generated status surfaces or GitHub issues.
It explains the current product direction, the active workstreams, and which
planning files are authoritative for each kind of question.

Updated: 2026-06-23.

## How To Read The Roadmap

Use generated data for moving status and use GitHub issues for execution.
Use this file for priority, ownership, and product shape.

| Question | Source |
| --- | --- |
| What should we work on next? | This roadmap, [Next Execution Plan](./next-execution-plan.md), and GitHub issues. |
| What is the state of one chart, version, and variant? | [Master Catalog Matrix](../../data/master-catalog-matrix/matrix.html). |
| Which claims are backed, partial, planned, or refused? | [Claims Register](../../data/claims-register/summary.md). |
| Which outcome is promised and how is it tested? | [Outcome Evidence Contract](../../data/outcome-evidence-contract/summary.md). |
| Which public pages must stay truthful? | `chart-claim-integrity:verify` and `site:ux:verify`. |
| Which historical notes explain how we got here? | Planning files marked as handovers, dated audits, or archive material. |

Do not copy live counts into roadmap prose. Counts belong in generated data.

## Current Product Goal

`helm-expt` should make Helm operations easier to understand and safer to
change:

```text
Use public Helm charts as the source.
Convert selected install paths into cub installer recipes.
Prove Helm parity for the same chart, values, base assumptions, and capability profile.
Use ConfigHub to manage visible variants, reviews, delivery, observations, and operations.
Keep gaps visible instead of turning them into silent claims.
```

The product story should be chart-first and user-first:

```text
See how it works.
Pick a Helm chart.
Manage Helm variants.
Build and operate live apps.
```

The proof machinery supports that story. It should not be the first thing a new
visitor has to understand.

## Active Workstreams

| Workstream | Current objective | Primary surfaces | Main trackers |
| --- | --- | --- | --- |
| Public website and guides | Make the site clear enough for a new Helm user, with short guide pages and deeper docs one click away. | `site/*.html`, [Dedicated Website Plan](./dedicated-website-plan.md), [persona UX audits](./persona-ux-audit-2026-06-22.md). | [#679](https://github.com/confighub/helm-expt/issues/679), [#753](https://github.com/confighub/helm-expt/issues/753). |
| Chart catalog and matrix | Keep the top-100 chart catalog useful, honest, and navigable by chart/version/base/variant. | [Master Catalog Matrix](../../data/master-catalog-matrix/matrix.html), [Chart Use Guide](../../data/chart-use-guide/summary.md), [Top-100 Readiness](../user/top100-readiness.md). | [#106](https://github.com/confighub/helm-expt/issues/106), [#113](https://github.com/confighub/helm-expt/issues/113), [#114](https://github.com/confighub/helm-expt/issues/114). |
| Live evidence and hard charts | Keep hard chart behavior receipted: CRDs, webhooks, hooks, target facts, generated facts, storage, runtime health, and GitOps sync. | [Current Proof Status](../user/current-proof-status.md), [Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md), [Lifecycle Boundary](../../data/lifecycle-boundary/summary.md). | [#248](https://github.com/confighub/helm-expt/issues/248), [#714](https://github.com/confighub/helm-expt/issues/714), [#882](https://github.com/confighub/helm-expt/issues/882). |
| Variants and promotion | Show base variants, derived ConfigHub variants, promotion, and app workflows as ordinary ConfigHub value. | [Creating Variants](../user/creating-variants.md), [Variant Promotion Model](../reference/variant-promotion-model.md), [Variant Promotion](../../data/variant-promotion/summary.md). | [#143](https://github.com/confighub/helm-expt/issues/143)-[#153](https://github.com/confighub/helm-expt/issues/153), [#948](https://github.com/confighub/helm-expt/issues/948). |
| ConfigHub/cub product blockers | Keep product gaps exposed by the corpus linked to upstream implementation work without overstating what helm-expt itself owns. | [Issue Backlog](./issue-backlog.md), [Variant Promotion Closeout](../reference/variant-promotion-closeout.md). | [#682](https://github.com/confighub/helm-expt/issues/682), upstream ConfigHub issue [#4609](https://github.com/confighubai/confighub/issues/4609). |
| Errors, omissions, and UX guards | Prevent false chart-page claims and placeholder leaks from returning. | [Chart Claim Integrity Audit](./chart-claim-integrity-audit-2026-06-22.md), [Test Map](../../tests/README.md). | PR [#1024](https://github.com/confighub/helm-expt/pull/1024), [#1025](https://github.com/confighub/helm-expt/issues/1025), [#1026](https://github.com/confighub/helm-expt/issues/1026), [#1027](https://github.com/confighub/helm-expt/issues/1027), PR [#1028](https://github.com/confighub/helm-expt/pull/1028). |
| AI-assisted apps and operations | Turn the ConfigHub data model into a substrate for AI-assisted app changes, RBAC/task-specific tools, and safer operations. | [AI-Assisted Helm Changes](../user/ai-assisted-helm-changes.md), [Broken Chart Triage](../user/broken-chart-triage.md), future app examples. | [#949](https://github.com/confighub/helm-expt/issues/949) and future app/example issues. |

## Release Guardrails

The broad verifier should prevent regressions in the claims that users see.

| Guard | Purpose |
| --- | --- |
| `docs:verify` | Every authored doc has a declared role and valid local links. |
| `site:verify` | Generated site pages match the site generator. |
| `site:ux:verify` | Chart pages do not leak unresolved action placeholders or raw work-dir placeholders. |
| `chart-claim-integrity:verify` | Chart pages do not make claims contradicted by their cited receipts. |
| `npm-scripts:catalog:verify` | The npm script catalog matches `package.json`. |

Run scoped checks while editing. Use `npm run verify` as the broad release gate
after focused checks pass. A passing verifier means committed evidence is
self-consistent; it does not replace a fresh live run.

## Planning File Roles

The active planning corpus has three tiers.

| Tier | Files | Role |
| --- | --- | --- |
| Canonical | This file, [Issue Backlog](./issue-backlog.md), [Next Execution Plan](./next-execution-plan.md). | Current roadmap, issue groups, and launch workstreams. |
| Lane-specific | [Dedicated Website Plan](./dedicated-website-plan.md), [Robust Sceptic Plan](./robust-sceptic-plan.md), [Fuzz Corpus Tests Roadmap](./fuzz-corpus-tests-roadmap.md), [Hook Route Execution Plan](./hook-route-execution-plan.md), [Maintenance Strategy](./maintenance-strategy.md), [Verified Install Commercial Model](./verified-install-commercial-model.md). | Active product or test lanes. These should link back here when priorities change. |
| Snapshot or review input | Handover docs, dated persona audits, dated claim audits, independent review briefs, older execution plans. | Evidence, review history, or context. These are not authoritative for current counts. |

When adding a new planning file, add its role to [Documentation Map](../README.md)
and decide whether it is canonical, lane-specific, or a snapshot.

## Roadmap Cleanup Rules

1. Do not create another broad roadmap without updating this file.
2. Dated files are logs or audits unless they explicitly say otherwise.
3. Generated data remains the authority for counts.
4. GitHub remains the authority for execution state.
5. User-facing claims must be backed by receipts, generated data, or an explicit planned/refused status.
6. If a planning note is no longer current, either archive it or add a short status note at the top.

## Near-Term Cleanup Still Worth Doing

| Item | Why |
| --- | --- |
| Split the very long `npm run verify` script into named suites. | The current command is hard to inspect and easy to conflict on. |
| Continue archiving old handoff snapshots. | The repo has many useful historical notes that should not look like current instructions. |
| Keep website copy smaller than the docs behind it. | The site should explain the product path; detailed proof belongs in guides and generated data. |
| Keep chart-page warnings visible but less scary. | Warnings are product honesty, not failure, when they tell users what remains to stage or decide. |
