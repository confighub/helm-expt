# Helm Community Persona Execution Plan

**Status:** experimental planning document.

This plan turns the persona PRD into repo work. It focuses on public Helm
charts first, then derived ConfigHub variants, live operations, and managed
commercial lanes.

## Current Status

The repo already proves a useful core:

- 100 recipe/package artifacts are tracked by the corpus verifier.
- The first 20 catalog charts have base variants, pain reports, and proof
  artifacts.
- The public docs explain base variants, derived ConfigHub variants, custom
  overlays, hooks, product tiers, and verification lanes.
- Live Helm-vs-ConfigHub parity has receipt coverage for the selected top-20
  chart/base rows. The result is intentionally mixed: passes prove the happy
  path, while watch and blocked rows identify target-readiness or chart-specific
  lifecycle work.

Current live parity receipt status:

| Status | Count | Meaning |
| --- | ---: | --- |
| pass | 10 | Helm, direct ConfigHub apply, and OCI/controller paths reached expected live state in the harness. |
| watch | 2 | The path ran but a workload or controller condition did not settle inside the timeout. |
| blocked | 8 | The chart exposed a target-readiness, lifecycle, or selected-base problem that should be recorded and handled before broader support. |
| not-started | 0 | All selected top-20 chart/base rows have a receipt slot. |

The next public improvement is not another abstract plan. It is a better first
visit: show who the repo is for, what value each user gets, where the variants
are, what has been tested live, and what requires ConfigHub or paid support.

## Workstream 1: Public Entry Point

Goal: make a Helm user understand the project without reading internal proof
docs.

Tasks:

- Add a persona route block to the public README or generated site.
- Keep the route block short: try a chart, choose a variant, verify an install,
  create a derived variant, run a bulk operation, review audit evidence.
- Link each route to the smallest useful page, not to every receipt.
- Keep future or paid capabilities clearly marked.

Acceptance checks:

- A new user can find the catalog, variant list, and verification command from
  the root README.
- The README does not present paid or planned features as free current
  capability.
- Internal terms such as receipt, lane, or harness are explained only where
  needed.

## Workstream 2: Variant-First Catalog

Goal: make variants the main catalog object, not rendered YAML.

Tasks:

- Ensure each top-20 chart page shows:
  - recommended base variants;
  - what each base changes;
  - whether a choice requires target facts, secrets, CRDs, hooks, or lifecycle
    policy;
  - which derived ConfigHub variants are demonstrated;
  - live status and production disposition.
- Add a concise chart-to-variant index if the current catalog page is still too
  hard to scan.
- Make the route from chart to base variant to derived variant visible in the
  generated catalog.

Acceptance checks:

- Redis, Prometheus, NGINX, cert-manager, and ExternalDNS each have an obvious
  user path from chart to variant decision.
- No user has to infer variant names from directory structure alone.
- Base variants and derived ConfigHub variants are not mixed together.

## Workstream 3: Live And Day-1/Day-2 Operations

Goal: move the visible value from dev/test render proof to operations.

Tasks:

- Keep the top-20 live Helm-vs-ConfigHub parity receipts current and explain
  pass, watch, and blocked outcomes in chart terms.
- Keep watch and blocked outcomes when charts reveal real operational risks.
- Add tutorial checks that say what a user should see after each step.
- Add short GUI navigation notes for ConfigHub views where the tutorial uses
  ConfigHub state.
- Make observation freshness visible in user-facing proof summaries.

Acceptance checks:

- Live status is visible per chart and matches committed receipts.
- Watch and blocked charts explain the operational issue instead of hiding it.
- Tutorial users know what to check in Kubernetes, ConfigHub, and GitOps after
  each stage.

## Workstream 4: Derived Variants, Promotion, And Blast Radius

Goal: show why ConfigHub variants are better than uncontrolled Helm fanout.

Tasks:

- Keep `cub variant create` as the current derived-variant substrate.
- Build clear examples for:
  - environment promotion;
  - region or target variants;
  - customer overlays;
  - bulk scan followed by bulk patch;
  - promotion waves with limited scope.
- In each example, show:
  - source base;
  - target variant;
  - changed paths;
  - affected Units;
  - checks and gates;
  - receipt or summary.
- Avoid making proof terminology the UX. The UI should show intent, preview,
  checks, and result.

Acceptance checks:

- A user can explain when to create a new base variant and when to create a
  derived ConfigHub variant.
- Bulk operations show scope and blast radius before mutation.
- Promotion examples do not imply nonexistent `cub variant` commands.

## Workstream 5: Free, Authenticated, And Paid Boundaries

Goal: make commercial boundaries clear without weakening the free public story.

Tasks:

- Keep public browsing and public chart education free.
- Describe public OCI pulls as low-friction but protected by signatures,
  digests, scoped credentials, or rate limits where ConfigHub operates the
  gateway.
- Make full signup useful for private variants, production records, approvals,
  receipts, scans, and fleet operations.
- Classify private values, wrapper charts, customer overlays, old-version patch
  support, and commercial hook/CRD lifecycle work as managed or paid lanes.

Acceptance checks:

- Users can see the free path before paid features are introduced.
- Paid features are tied to private state, production governance, fleet scale,
  support, or long-term maintenance.
- Anonymous use is limited to safe browsing and public artifact discovery.

## Workstream 6: Dataset And Scale

Goal: turn the top-100 and top-500 data into a practical catalog planning map.

Tasks:

- Summarize each chart as:
  - works as public base;
  - works with target facts or user input;
  - needs managed/private import;
  - needs lifecycle or production review;
  - blocked for current scope.
- Keep per-chart pain reports as the detailed record.
- Keep spreadsheet columns focused on decisions, not every raw template feature.
- Tie top-100 rows to recipe, base variant, pain report, live status, and next
  action.

Acceptance checks:

- A reviewer can understand how many charts are ready, half-ready, or blocked.
- The data explains why, not only counts features.
- Top-100 and top-500 summaries reflect the current doctrine on base variants,
  derived variants, hooks, target facts, and managed imports.

## Suggested Order

1. Turn the top-20 live parity outcomes into clear user-facing chart status:
   pass, watch, blocked, and the reason for non-pass rows.
2. Update the public entry point with persona routes and tier boundaries.
3. Improve the generated catalog so variants and live status are visible first.
4. Add a short operations-first tutorial path: promotion, bulk scan, bulk patch,
   and observation.
5. Refresh top-100 and top-500 summaries using the current support categories.
6. Move commercial examples into a clear managed/private lane.

## Verification

The plan should be checked by repo verifiers and by user-path reviews.

Run:

```sh
npm run docs:verify
npm run live-parity:verify
npm run verify
```

Use the full `npm run verify` after generated summaries are up to date. Use
`npm run live-parity:top20:verify-slots` only when the intended state is all 20
top-chart live parity receipts present.

Manual review should answer:

- Can a new Helm user see what to do first?
- Can an operator see day-1 and day-2 value?
- Can a security reviewer find receipts and scan evidence?
- Can a platform team distinguish free public catalog use from managed private
  import and fleet operations?
