# helm-expt Product Testing Strategy (long-term)

Status: `ACTIVE` (2026-06-01). Owner direction (Alexis, 2026-06-01): focus the
20-chart **default** path end-to-end first; then the other recipes compared with
Helm (default + added params); capture it all as a long-term strategy **built to
scale to highly parallel, agentic testing** (coming soon). Anonymous / no-auth
mode is **deferred** — revisit later.

Repo split (see `pilot/HELM_STRESS_TEST_MISSION.md`): this strategy + its harness
live here (`confighub-ai-demo`); the product fixes it surfaces land in
`confighub/helm-expt` (catalog) or `installer` (binary).

## Thesis under test

A newcomer gets **the same result as Helm, and better, with no errors** — by
installing catalog charts via `cub installer` (never the helm CLI), governed in
ConfigHub, delivered over OCI, reconciled by their Argo/Flux. "Better" =
versioned/approvable units, OCI-pinned provenance, drift self-heal, variants.
Every claim must be backed by a machine-readable receipt; a silent wrong result
(e.g. finding F1) fails the thesis.

## Phases

| Phase | Scope | Pass bar |
|---|---|---|
| **1 — 20-chart DEFAULT path (NOW)** | Each of the 20 proof charts, **default base only**, end-to-end: `cub installer setup` → `upload` → ConfigHub units → OCI (`oci.hub.confighub.com`) → Argo (cub-lk) → running + three-way agree | 20/20 reach Healthy + three-way AGREED, **0 silent errors**; every render passes the namespace-coherence guard |
| **2 — recipes + Helm comparator (NEXT)** | Non-default bases/variants per chart, **and** a `helm` comparison: `cub installer` result vs `helm template`/`helm install` for **default + added params** | per (chart,recipe): deploys + verifies; cub-installer output is equivalent to Helm's (modulo governance adds), diffs explained |
| **3 — scale + agentic (SOON)** | The parallel agentic campaign across charts/recipes; Day-2 mutation; authority scan; (anonymous mode still deferred) | runs unattended across many agents/machines, aggregated receipts, no false-greens |

## The work unit (what one agent runs)

A single **(chart, base)** end-to-end test — isolated, idempotent, emits one
structured receipt. This is the atom the whole campaign shards over.

```
pilot-helm-chart-test <chart-ref> --base <base> --rig <cub-lk-cluster> [--compare-helm] --json
  → receipt: { chart, base, rig, status: PASS|WATCH|BLOCK, proof_rows[], findings[], timings }
```

The Wave 1 nginx run (`pilot/HELM_WAVE1_RUNBOOK.md`) is the validated procedure
this harness parameterizes. The harness MUST include the coherence guard (one
distinct namespace per render — catches F1) and pair controller status with exact
runtime field proof (no false-green).

## Built for parallel, agentic testing (the design constraint)

- **Isolation = one `cub-lk` cluster per agent.** `cub lk up` gives a dedicated
  kubeconfig (never merged into `~/.kube/config`) + its own ConfigHub space +
  server-hosted worker. That makes it natively parallel-safe: agent A's cluster
  can't disturb agent B's. Each agent owns `cub lk up --name <agent-unique>`.
- **Multi-agent kubectl rule (hard):** every `kubectl` pins `KUBECONFIG=<the
  rig's dedicated file>` + `--context`; **never** `kubectl config use-context`
  (it mutates shared config and flips peer agents). cub-lk already isolates the
  kubeconfig; the rule keeps it that way.
- **Sharding:** N agents × (charts/recipes ÷ N). Each agent runs the work unit
  over its shard against its own rig. Within an agent, one rig can host several
  charts sequentially (each chart its own namespace) to economize clusters.
- **Receipts over logs:** each work unit writes a machine-readable receipt so a
  coordinator aggregates pass/fail + findings **without re-reading transcripts**
  — the same pattern our agentic workflows use. Aggregate → one campaign
  scorecard.
- **Resource discipline:** dev machine ≤2 kind clusters; the at-scale campaign
  runs on the fast machine / multiple machines, each agent bounded. Phase 1 on
  this machine runs the 20 charts **sequentially in one rig** (within budget);
  Phase 3 fans out.
- **Determinism:** no `Date.now()`/random in receipts; chart/base identify the
  run; teardown (`cub lk down`) is part of the unit (or shared-rig cleanup
  between charts).

## Inputs (resolve, don't hardcode)

- The 20 charts: from helm-expt's `TOP20_CONFIGHUB_PROOF_CHARTS`
  (`scripts/lib/top20-confighub-proof.mjs`) — resolve at runtime so the list
  stays in sync with the catalog.
- Each chart's default base: the base marked `default: true` in its
  `installer.yaml` (name varies — resolve it, don't assume `default`).
- Helm comparator (Phase 2): drive helm-expt's existing `helm template`
  equivalence checker, plus `helm install` for default + added-params cases.

## Quality guards carried from Wave 1

- **F1 namespace coherence** — abort a render with >1 distinct namespace; until
  helm-expt fixes package generation, pin `--namespace` to the package's frozen
  value. Track per-chart whether the package honors `--namespace`.
- **F2 `:latest`** — flag non-pinned images in the scan lane (Phase 2/3).
- **F3 secret delivery** — secret-dependent charts (~6/20: redis, postgresql,
  mysql, mongodb, rabbitmq, grafana) deliver "green" over OCI→Argo but can't
  start (the artifact correctly omits plaintext Secrets, with no GitOps
  replacement wired in). Test them via the existing-secret / ESO path, not the
  password-generating default; never narrate Argo "Synced" as PASS without
  runtime-Ready (the failure is silent at the governance layer). Tiered-secrets
  design + the required-secret validation gate: **confighub-ai-demo#1132**.
- **Three-way agreement + exact runtime field proof** on every PASS; controller
  "Synced/Healthy" alone is never a PASS.

## Deferred

- **Anonymous / cookies-not-email mode** — out of scope until later (Alexis
  2026-06-01). The `cub installer <chart>` convenience sugar is likewise
  secondary to proving the 20-chart default + recipe paths.

## First steps — status (done 2026-06-01)

1. `scripts/pilot-helm-chart-test` (work unit) ✓ — base resolved via `cub installer doc`.
2. `scripts/pilot-helm-wave1-sweep` (shardable Phase-1 driver) ✓.
3. Phase-1 live: nginx default PASS; redis `reuse-existing-secret` PASS (F3
   fix-path); grafana → F3 (silent secret gap). ✓
4. Phase-2 equivalence: drove helm-expt's `npm run <chart>:compare` → **20/20
   helm-equivalent** (pristine tree). ✓
5. **Acceptance contract published (user-facing):** helm-expt
   `docs/reference/verification-properties.md` (PR #98) — what a full run verifies / what a
   user can expect to be true. This plan is the engineering counterpart (how we
   verify it at scale).

## Full-scale test plan (NEXT — runs on dedicated / fast machines)

The coverage matrix is **charts × variants × dimensions**, each cell a receipt,
sharded across agents (one cub-lk rig per agent).

### A. Broader — chart breadth
- Now: 20 TOP20 (render/equiv/e2e 20/20; live gate on representative charts).
- Next: **100 charts** (recipe/package artifacts already exist in helm-expt) →
  full live default-path sweep, sharded.
- Beyond: helm-expt's top-500 source/catalog analysis → promotion candidates → N.

### B. Deeper — dimensions per chart
- **Secrets (F3 / confighub-ai-demo#1132):** test the existing-secret + ESO paths
  per secret-needing chart; build + test the **required-secret validation gate**
  (no silent green).
- **Day-2:** beyond replicas — image, resources, values; and **rollback**.
- **False-green guards at scale:** three-way + receipts; F4 source-SHA coupling
  (regen pairing); contradiction-check must include `CreateContainerConfigError`.

### C. Variant hierarchy — recipes → base → derived → custom (catalog + test)
helm-expt already defines the routing — reference, don't duplicate:
`docs/user/change-routing-before-oci.md`, `creating-variants.md`,
`custom-overlays.md`, `customization-algorithm.md`, `product-support-tiers.md`.
The **customization decision tree** (the steps + forks + parallel paths a user
takes, clarifying F1→F1b→F2→F3 and the later stages) is `confighub-ai-demo#1133`.
The **testing** dimensions:
- **Base variant** (from a recipe; changes rendered objects): install +
  render-equivalence + namespace + secret-path. (Done for redis default /
  reuse-existing-secret; extend to all bases of all charts.)
- **Derived ConfigHub variant** (operates a reviewed object set — target / env /
  region / labels / gates): derive from a base, deploy, verify the operational
  deltas + Day-2.
- **Custom version / overlay** (wrapper + platform + customer overlays; usually
  needs ConfigHub Server): import + render + diff vs base; equivalence of the
  layered result.
- **Cataloging question to resolve:** how derived/custom variants are stored and
  **provenance-linked** in the user's org repo (lineage recipe → base → derived
  → custom). Test that each level is install-able, Day-2-able, and provable.

### D. Helm-customization types to showcase + test
- **Hooks** (pre/post-install/upgrade) → how they map to Argo hooks / sync-waves
  / Flux; test a hook-bearing chart installs and the hook fires. (helm-expt
  `docs/user/hook-lifecycle-strategy.md`.)
- **Revisions / rollback** — helm release revisions ↔ ConfigHub revisions; test
  change → revision → **rollback through ConfigHub** → verify the reverted field.
- **Dependencies / subcharts / umbrella charts** — test an umbrella chart renders
  + installs (and its subchart objects).
- **Values layering / overlays** — values files, `--set`, wrapper+platform+customer;
  test equivalence across layered values (default + added params).
- **CRDs + ordering** — CRD-installing charts (cert-manager, etc.): CRD before CR;
  sync-wave ordering.

### E. Fast-machine execution model
- **Campaign kickoff (START HERE):** the self-contained start prompt for the
  fast-machine Claude agents is **`confighub-ai-demo#1134`** (locations, models,
  agent roles, commands, rules, report-back).
- Driver `scripts/pilot-helm-wave1-sweep`: N agents × (charts/variants ÷ N), one
  cub-lk rig per agent, per-cell receipts → aggregated scorecard. Each agent:
  `cub lk up` → run its shard → `cub lk down`.
- Multi-agent kubectl discipline (KUBECONFIG per rig; never `use-context`).
- **Repo layout:** run the campaign **from `confighub-ai-demo`** (harness, driver,
  plan, receipts) with **`helm-expt` checked out as a sibling** (catalog under
  test + its own `npm run <chart>:proof|:compare`). Keep the Pilot agentic harness
  OUT of public helm-expt — helm-expt stays the clean public catalog.
- **Models + agent roles (100% Claude):**
  - *Operators/executors* (run the per-cell work-unit on a rig — deterministic):
    **Sonnet**, one cub-lk rig each.
  - *Adversarial verifiers/judges* (re-check every PASS for false-green — silent
    F3, doctor-rollup-vs-pod contradiction, three-way disagreement): **Opus**,
    read-only (work from receipts + live re-reads, no rig).
  - *Orchestrator/synthesizer* (shard the matrix, aggregate, decide coverage):
    **Opus**.
  - *Haiku*: optional for trivial log/marker scraping; not the main loop.
  - **Agent count** is bounded by **one rig per concurrent executor** × machine
    capacity. Start ~**4–6 executors** + 1–2 Opus verifiers + 1 Opus orchestrator;
    split a **light lane** (more concurrency) from a **heavy lane** (vault,
    consul, kube-prometheus-stack, longhorn — fewer concurrent, dedicated rigs,
    longer waits). Scale executors up for 100 charts as RAM/Docker allow.
- The full matrix feeds back into the verification-properties acceptance contract
  (PR #98) — each proven dimension upgrades a property's coverage from
  "representative" to "catalog-wide".
