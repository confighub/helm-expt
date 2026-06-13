# Next catalog tasks — Helm catalog (distilled queue)

**Created:** 2026-06-02. A prioritized **top-20 queue distilled from the detailed plans** —
`next-execution-plan.md` (P0/P1/P2 gates), `agreed-execution-plan.md` (doctrine), `issue-backlog.md`
(GitHub issues), `catalog-promotion-next-candidates.md` (wave-2), and the `next80` / production-disposition
data. It does not replace them; it is the executive work queue over them.

Three newer planning inputs sharpen this queue:

- `serverless-verified-install-plan.md` defines the no-login wedge: resolve a
  public package, verify it locally, apply it, write an in-cluster receipt, and
  show where ConfigHub Server starts.
- `verified-install-commercial-model.md` defines the paid security and
  operations model: factory scans, image digest inventory, signed artifacts,
  refresh SLAs, private catalogs, and fleet-wide queries.
- `robust-sceptic-plan.md` defines the public attack model: every claim needs
  a receipt or route, and the next hard tests are claims-register maintenance,
  blast-radius accuracy, torture fixtures, environment matrices, and external
  reproduction.

## Where we actually are (so the queue is honest)
- 100 proof-grade recipes + packages; **20 top charts catalog-supported (local-test)** with bespoke base
  variants; 80 generated proofs (`next80`); 20/20 local-kind e2e + ConfigHub proof receipts; top-500
  analysis done.
- `cub variant create` now exists and is the real current substrate for downstream ConfigHub variants.
  Local CLI truth also shows `cub variant promote` and `cub variant upload`; `cub variant release`
  is not current.
- The catalog proves base/render variants much more strongly than derived ConfigHub variants. That is now
  an explicit gap, not a side note: derived variants need enough goldens, tutorials, metrics, and receipts
  that users can see them doing useful work.
- 100/100 charts are supported at Level 2; 54/100 are variant-rich. The remaining catalog work is
  user-shaped variants, derived variants, production dispositions, and runtime/GitOps evidence, not basic
  proof creation.
- Current chart facts show 25 hard gaps for recommended extra capabilities: 15 existing-secret gaps (#113),
  3 template-CRD/no-crds gaps (#114), 6 curated-variant lanes, and 1 other gap.
- **1 target-scoped support decision recorded** (19 draft decisions remain;
  20 production-review-ready disposition rows exist). P0 #76 is closed as a
  verifier-backed import-path definition; downstream `cub installer import helm`
  implementation remains product work.

## Outcome standard for this queue

Each task below should be judged by the outcome it proves, not by whether a doc
or script was added. The catalog target is:

```text
Every supported Helm chart default and declared main choice is reproducible,
ConfigHub-reviewable, live-cluster verified, and tied to receipts.
```

For a task to be done, it should leave behind:

- a named scope, such as chart-choice rows, derived variants, or live lanes;
- committed evidence, such as receipts, generated matrices, or verified docs;
- a verifier that fails when the evidence is missing or stale;
- user-facing wording that does not claim more than the evidence proves.

Default-only proof is not enough when the catalog advertises a non-default main
choice. Derived ConfigHub variants are not "supported" until the uploaded
base-plus-derived-variant path has clone/check/mutation receipts and, where the
task is about delivery, live observation.

| Tasks | Outcome to prove |
| --- | --- |
| 1, 13 | A human, agent, or bulk flow can express "take this base and extend it" while the docs and verifier use the real `cub variant create` surface. |
| 2, 3 | Multiple derived ConfigHub variants exist as executed, receipted clone/check/mutation paths, not only as UX sketches. |
| 4 | A fast Helm install/import path can become a durable recipe/package/variant path without losing reproducibility or review evidence. |
| 5, 17 | Main non-default chart choices become real package bases with rendered revisions, Helm-equivalence receipts, scans, gates, and live-lane tracking. |
| 6, 18, 19 | Production support blockers are explicit: dispositions, image digests, hook/lifecycle receipts, upgrade/rollback evidence, and observation freshness. |
| 7, 8 | Target facts and chart weirdness are represented as checkable prerequisites or receipts, not hidden tribal knowledge. |
| 9-12 | The rendered desired-state corpus becomes queryable: inventory, fleet mutation, policy posture, dependency graph, and impact analysis all distinguish base choices from derived variants. |
| 14-16 | OCI/GitOps/release work proves delivery outcomes: gated publication, controller reconciliation, runtime observation, and live Helm-vs-ConfigHub parity. |
| 20 | The public story gives a new user a simple path from catalog choice to verified outcome without burying them in internal proof machinery. |

The newer sceptic plan adds two cross-cutting outcomes:

| Task | Outcome to prove |
| --- | --- |
| 21 | Public claims are mapped to evidence, routes, or explicit refusals. No receipt or route means no claim. |
| 22 | Blast-radius predictions are measured against actual rerenders so edge and inheritance claims are scored, not assumed. The first KPS, Redis, and NGINX seeds are in `data/blast-radius-accuracy/summary.md`; broader coverage is still open. |

## Now - derived variants and current CLI truth
1. **Make `cub variant create` the explicit derived-variant substrate** (#143) - add the command-surface
   doc, update Tutorial 4, make UX proposals consistent, update `why-this-exists.md`, and add a lightweight
   command-surface verifier. Do not document non-existent `cub variant` subcommands as current.
2. **Execute and deepen the derived-variant expansion wave** (#144) - the generated
   [derived-expansion-wave](../../data/variant-goldens/derived-expansion-wave/README.md) now names
   10 derived variants across 5 reviewed bases; turn those work orders into full clone/check/mutation
   receipts without hidden Helm rerender.
3. **Prove promotion and environment management with derived ConfigHub variants** (#145) - base -> staging
   or prod using `cub variant create`, target/gates/observation policy, upstream links, and low-noise review.
4. **Keep the closed #76 import contract executable** - the Helm import path from
   `cub helm install` to durable `cub installer` recipes is defined and verified;
   next work is product implementation and broader managed-overlay examples.

## Next - base variants, production depth, and facts
5. **Wave-2 real base-variant promotion** - add user-shaped base variants to the 5 selected proof-grade
   charts (traefik, external-dns, velero, istiod, kyverno): real recipe variant + package base + rendered
   revision + scan/gate + Helm-equivalence receipt each.
6. **Production support decisions for the top-20** - use the accepted production dispositions as
   review input; record target scope, required live checks, and support policy before moving any chart
   from `catalog-supported (local-test)` toward `production-supported`.
7. **Target facts beyond required Secrets** - map existing-CRD, API availability, namespace, storage class,
   ingress class, runtime class to installer-native external requirements, provided facts, cluster singleton
   facts, and collectors.
8. **Per-chart weirdness-and-mitigations notes** - make hooks, CRDs, webhooks, lookup, generated secrets,
   required values, RBAC, stateful storage, upgrade, and rollback visible for every catalog-supported chart.

## Configuration-As-Data Value Lanes Inside helm-expt
9. **Fleet inventory and CMDB views** (#146) - generated chart/component/variant/Space/Unit/target/status
   views, explicitly distinguishing base variants from derived ConfigHub variants.
10. **Fleet-scale mutation and codemod workflows** (#147) - prove one controlled change across a labeled
    fleet slice, with preview, checks, gates, receipts, and route-back-to-base cases.
11. **Policy, compliance, and security posture reports** (#148) - roll scan/gate findings up across the
    rendered desired-state catalog and route remediations to base variant, derived variant, or delivery
    prerequisite.
12. **Dependency graph and impact analysis** (#149) - show which derived variants, Units, targets, and
    gates are affected by a base/chart/policy/target change.
13. **Creator and agentic intent flow over `cub variant create`** (#150) - human intent first, current CLI
    substrate underneath, checks/gates/receipts included, no broad formal-model lane.

## GitOps, release, and UI story
14. **Variant release / OCI handoff semantics** (#151) - release vs tag, `:latest`, gates, validation, OCI
    publication, and what is current versus planned.
15. **Promotion UI expectations** (#152) - less noisy diffs, upstream-added fields, inherited/no-op
    distinctions, prod-only gates/targets/observation policy, and no confusing preview treatment.
16. **Argo/OCI GitOps tutorial positioning** (#153) - make Tutorial 6 bridge-independent, Argo/OCI-oriented,
    and honest about which runtime/GitOps receipts exist. Use the generated
    [outcome coverage](../../data/outcome-coverage/summary.md) as the corpus
    source of truth, and add the missing live Helm-vs-ConfigHub dual-deploy
    comparison lane: live `helm install` compared with ConfigHub via controller
    OCI and ConfigHub via kubectl/apply.

## Breadth, day-2, and adoption surfaces
17. **Promote high-value `next80` charts** from default-only to user-shaped variants, then attach derived
    variants where the change is post-render ConfigHub refinement rather than Helm render shape.
18. **Image digest resolution and hook lifecycle lanes** - pin mutable images or gate them (#99), and turn
    hook-using charts into per-chart lifecycle dispositions.
19. **Day-2 upgrade/rollback, consequence preview, and existing-Helm diagnostics** - keep #11, #15, #16,
    #30, and related receipt work aligned with derived-variant propagation.
20. **Public story surfaces** - keep the Helm pain docs, `CATALOG.md`, status
    dashboard, and static site current, and make the first-run path simple
    enough for outside testers.
21. **Claims register and sceptic scoreboard** - maintain
    [data/claims-register/summary.md](../../data/claims-register/summary.md)
    as the page that maps each public claim to the evidence lane, receipt,
    route, or refusal that supports it. It should stay current as serverless,
    commercial, lifecycle, scan, signing, and ConfigHub graph claims change.
22. **Blast-radius prediction accuracy harness** - extend
    [data/blast-radius-accuracy/summary.md](../../data/blast-radius-accuracy/summary.md)
    beyond the first kube-prometheus-stack and Redis base-pair seeds. For selected density
    hotspots, mutate one input, predict affected objects/fields from the value
    and graph data, rerender, diff, and publish misses/phantoms. Until a row is
    measured, blast-radius and inheritance claims should stay scoped as partial
    evidence.

## Suggested order
Treat 1-3 as the immediate correction: `helm-expt` needs more visible derived
variants, and the docs must line up with the real `cub variant create` command.
Tasks 18, 21, and 22 are now the strongest trust builders: lifecycle evidence,
claim-to-receipt maintenance, and measured blast-radius accuracy. Tasks 9-13 remain
the highest-value configuration-as-data lanes inside this repo. GitOps, release,
and promotion UI come next because they make the product story legible without
asking humans to follow every low-level CLI step.
