# Large Machine Roadmap

Updated: 2026-06-05

This roadmap is for the large machine that can run live Kubernetes and GitOps
tests. It is outcome-driven: each task is done only when committed receipts and
verifiers prove the claimed outcome.

## North Star

```text
Every supported Helm chart default and declared main choice is reproducible,
ConfigHub-reviewable, live-cluster verified, and tied to receipts.
```

For derived ConfigHub variants:

```text
Every advertised post-render operating choice has clone/link/check/gate
evidence, and delivery claims have target-bound live receipts.
```

## Non-Negotiable Truth Rules

1. Do not say "all charts" unless every chart-recipe-variant row in the lane
   matrix has the relevant PASS receipt.
2. Do not say "live" unless there is an actual cluster/controller observation
   receipt.
3. Do not say "derived variants are proven" unless the statement names whether
   they are intended-state only or target-bound live.
4. Do not say "quirks checked" unless the receipt checks the specific quirks
   for that chart: CRDs, hooks, webhooks, RBAC, generated Secrets, target facts,
   PVCs, lookups, ingress/TLS, images, storage, and day-2 behavior.
5. A verifier passing means "the committed evidence is self-consistent." It
   does not automatically mean "fresh live run succeeded today."

## Roadmap Overview

| Phase | Outcome |
| --- | --- |
| 0 | Make the proof language and receipt schema impossible to overclaim. |
| 1 | Prove live Helm-vs-ConfigHub parity for two canary charts. |
| 2 | Add target-bound live derived variants. |
| 3 | Expand exact row-level live coverage across top-20 main choices. |
| 4 | Turn chart quirks into visible checks and dispositions. |
| 5 | Make "what am I getting?" legible to humans, generally and per chart. |
| 6 | Reorganize docs so user, reference, demo, planning, and generated evidence are not mixed. |

## Phase 0 - Truth Controls

Outcome: the repo stops rewarding vague verification claims.

Tasks:

- Add or update a user-facing "Verification Lanes" page that explains every
  major `npm run` verifier in plain English.
- Add a top-level "Current Proof Status" page that pulls from the lane matrix
  and says what is pass, missing, and backlog.
- Extend the lane matrix if needed so derived intended-state and target-bound
  derived live receipts are separate lanes.
- Add a "blocked receipt" pattern for live attempts that fail due to cluster,
  target, controller, chart, or ConfigHub behavior.
- Require every future handover to include exact lane counts from
  `data/lane-test-matrix/summary.md`.

Done when:

- `npm run docs:verify`, `npm run lane-tests:verify`, and the new or updated
  verifier fail if status claims drift from evidence.

## Phase 1 - Live Parity Canaries

Outcome: one simple and one stateful chart prove live Helm-vs-ConfigHub parity.

Recommended canaries:

| Chart | Status | Why |
| --- | --- | --- |
| `bitnami/nginx@24.0.2 / http-clusterip` | pass | Small object set; first live parity lane with regular Helm, ConfigHub kubectl/apply, and ConfigHub OCI/Argo. |
| `bitnami/redis@25.5.3 / default` | pass | Stateful run with separated Secret staging, four Bound PVCs, StatefulSets Ready, and Redis PONG. |

For each canary, run and receipt:

- fresh `helm install` into kind or equivalent;
- ConfigHub kubectl/apply delivery;
- ConfigHub OCI plus Argo delivery;
- semantic object comparison;
- runtime health and meaningful workload observation;
- cleanup or retained-resource summary.

Done when:

- `confighub_oci_argo_live` and `live_helm_vs_confighub_dual_compare` are PASS
  for the exact canary rows.
- The lane matrix and docs explain only those rows as pass.

## Phase 2 - Target-Bound Derived Variants

Outcome: derived variants become operational, not only intended-state clones.

Start with:

| Derived variant | Status | Reason |
| --- | --- | --- |
| `NGINX-prod-us-east` | pass | Small prod-style gate and target story. |
| `Redis-staging-eu-west` | blocked | Stateful target-bound non-prod story; needs namespace mutation and Redis Secret delivery modeled before live apply. |
| `Prometheus-staging-eu-west` | next | Observability workload with larger object set. |

Tasks:

- Create or select real targets for the current ConfigHub context.
- Attach targets to selected derived variants.
- Apply with gates/checks as appropriate.
- Record live apply, runtime observation, and cleanup receipts.
- Decide whether production gates should block apply until explicitly approved
  and receipt that behavior.

Done when:

- `npm run derived-variants:verify` covers intended-state receipts.
- `npm run derived-variants:target-bound:verify` covers target-bound live
  receipts.
- The docs say which derived variants are target-bound live and which are not.

## Phase 3 - Top-20 Row-Level Live Coverage

Outcome: top-20 chart support is exact by main choice, not fuzzy by chart.

Tasks:

- Work from `data/lane-test-matrix/variant-lanes.csv`.
- Prioritize missing non-default main choices for top-20 charts:
  existing-secret, no-crds, server-only, ingress, HA, storage, and ClusterIP.
- For each row, run local kind apply and ConfigHub proof if missing.
- Then run OCI/Argo and live parity lanes in batches.
- Commit receipts by row, not by chart-level headline.

Done when:

- Every top-20 declared main choice has PASS in:
  - `helm_template_vs_installer_setup`
  - `confighub_upload_variant_scan_safe_ops`
  - `local_kind_kubectl_apply`
- At least the first wave has PASS in:
  - `confighub_oci_argo_live`
  - `live_helm_vs_confighub_dual_compare`

## Phase 4 - Chart Quirk Coverage

Outcome: a human can see whether a chart's hard parts have actually been tested.

Tasks:

- Generate per-chart quirk profiles from recipe metadata, chart facts, and
  receipts.
- Add receipt checks for:
  - CRD install/no-CRD choices;
  - hook lifecycle and cleanup;
  - admission webhooks;
  - generated and existing Secrets;
  - target facts;
  - PVC/stateful behavior;
  - service/ingress/TLS behavior;
  - mutable image tags and digest overrides;
  - upgrade and rollback for stateful or hook-heavy charts.
- Make untested quirks visible as `missing`, not hidden in prose.

Done when:

- Per-chart pages include a "Quirks checked" and "Quirks not yet checked"
  section generated or verified from evidence.

## Phase 5 - What Am I Getting?

Outcome: a new human can understand the value without reading the whole proof
corpus.

Create a user-facing page, likely:

```text
docs/user/what-you-get.md
```

It should answer:

- What does ConfigHub add beyond `helm install`?
- Which charts are currently supported and at what proof level?
- What is a base variant versus a derived ConfigHub variant?
- Which workflows are ready now: render review, ConfigHub upload, derived
  environment/customer variants, local apply, GitOps?
- Which workflows are still backlog: full live parity, target-bound derived
  variants, production support, release/OCI handoff?

Per-chart cards should include:

| Field | Meaning |
| --- | --- |
| Supported install shapes | Recipe/package bases, not vague variants. |
| Derived operating choices | Environment, region, customer, target, gates, facts, observation policy. |
| Verified lanes | Exact pass/missing lane list. |
| Live evidence | Links to runtime receipts only. |
| Quirks | CRDs, hooks, webhooks, generated secrets, PVCs, RBAC, images. |
| Not yet proven | Plain backlog, not buried disclaimers. |
| Try this first | The simplest reliable user command path. |

Done when:

- `README.md` points to this page before deep proof mechanics.
- `CATALOG.md` or the static site has per-chart status cards.

## Phase 6 - Docs Organization

Outcome: docs are findable by audience and stale files cannot confuse users.

Proposed folder rules:

| Folder | Belongs there |
| --- | --- |
| `docs/user/` | Human-facing tutorials, quickstarts, "what you get", and supported workflows. |
| `docs/reference/` | Stable definitions, lane doctrine, command surfaces, contracts, and glossary. |
| `docs/demo/` | Demo transcripts and receipt explanations for chart examples. |
| `docs/planning/` | Roadmaps, handovers, issue mirrors, review briefs, execution plans. |
| `docs/internal/` | Candidate home for agent notes, stale experiments, or non-user-facing analysis if needed. |
| `data/` | Generated evidence and spreadsheets. |
| `runs/` | Receipts and live/proof run outputs. |

Tasks:

- Audit every `.md` file and classify it as user, reference, planning, demo,
  generated data, or stale/historical.
- Move files that are not user-facing out of `docs/user/`.
- Add redirect notes or index links for moved files.
- Update `docs/README.md`.
- Run `npm run docs:verify`.

Done when:

- A new user can start at `README.md` and follow a serial path:
  1. what this is;
  2. what they get;
  3. choose a chart;
  4. run a tutorial;
  5. inspect proof status;
  6. understand limitations.

## Highest Value Next 20 Tasks

1. Add a user-facing verification-lanes page.
2. Add a current proof status page generated or verified from the lane matrix.
3. Keep the NGINX live Helm-vs-ConfigHub parity canary green.
4. Keep the Redis live Helm-vs-ConfigHub parity canary green.
5. Keep the target-bound live receipt schema for derived variants green.
6. Keep the `NGINX-prod-us-east` target-bound live receipt green.
7. Implement the namespace mutation and Redis Secret/fact handling needed for
   `Redis-staging-eu-west`.
8. Target-bind and live-apply `Prometheus-staging-eu-west`.
9. Fix or explain Grafana placeholder drift (#156).
10. Add per-chart "what am I getting?" cards for the top-20.
11. Add per-chart "quirks checked / missing" sections.
12. Move non-user-facing files out of `docs/user/`.
13. Add a docs inventory table by audience and purpose.
14. Expand ConfigHub proof row coverage for top-20 non-default main choices.
15. Expand local-kind row coverage for top-20 non-default main choices.
16. Expand OCI/Argo live receipts beyond the first NGINX row in the lane matrix.
17. Add first live dual-compare receipt to the lane matrix.
18. Add blocked-receipt handling for live harness failures.
19. Update `README.md` to lead with value and current proof status.
20. Update static site or `CATALOG.md` so chart status is easy to inspect.

## Suggested First Commit On Large Machine

Do not start with all charts. Start with one canary and the receipt/verifier
shape:

```text
NGINX http-clusterip:
  live Helm install
  ConfigHub kubectl/apply
  ConfigHub OCI/Argo
  semantic comparison
  runtime observation
  cleanup
  lane matrix update
```

Once that pattern is correct and honest, repeat it for the next selected
top-20 row.
