# helm-expt Test Map

This is the starting page for **all** helm-expt testing. It maps every test class
across the four systems we exercise — **Helm · Kubernetes · ConfigHub · cub** — to
where it lives and its honest coverage. The detailed strategy, command runbooks,
runners, and UX surfaces are the layers beneath it (see [The layers](#the-layers)).

**UNOFFICIAL/EXPERIMENTAL.** Testing here means *claims matched to evidence*, not
green-for-its-own-sake. The bar is **verified disposition, not "everything green"**
(see [How we state coverage](#how-we-state-coverage)).

## The four systems we test

- **Helm** — does `cub installer` render the same object set as regular Helm, and what happens to Helm hooks?
- **Kubernetes** — do the rendered objects actually run on a cluster (local kind, and strict two-cluster parity)?
- **ConfigHub** — do the objects become Units, scan, upload via OCI, reconcile under Argo/Flux, and promote across variants?
- **cub** — do `cub installer`, `cub variant`, and `cub-scout` (day-1 preview) do what the catalog claims?

## Test classes

| Group | Classes |
| --- | --- |
| **A. Static verification** (offline `npm run verify`) | corpus representation · render parity · disposition/frontier · consistency gates (doc-map, data-index, npm-script-catalog, site) |
| **B. Live cluster proof** (kind, serial, receipted) | local k8s live · strict two-cluster kind-parity · GitOps/OCI (Argo/Flux) · live Helm-vs-ConfigHub parity · variant-promotion |
| **C. Lifecycle / hooks** | observe → **execute** → **emit** (GitOps-native) |
| **D. Day-1 preview** (cub-scout) | `compare three-way --dry-from` (desired-vs-live, drift) |
| **E. UX / journey** | **persona UX audit** · journey pathways · website-UX walkthrough · outside-user · adversarial-persona probe |
| **F. Adversarial / refusal boundary** (a *deliberate* skeptic breaking the model) | torture suite · adversarial-10 · quirk & pain-point coverage |
| **G. Careless-dev randomness** (an *ordinary* dev making silly decisions, repeatedly, at volume) | random-bad-decisions fuzz |

## The coverage matrix

Which system each class exercises, where it lives, and its honest coverage.
Legend: ● exercises · ○ partial/indirect · – n/a. Counts are indicative — the
**authoritative live numbers** are in the generated surface linked per row.

| Test class | Helm | k8s | ConfigHub | cub | Lives in | Honest coverage |
| --- | :--: | :--: | :--: | :--: | --- | --- |
| Render parity | ● | – | – | ● | `<chart>:compare`, helm-equivalence receipts | **complete** — every catalog base (R all pass) → [outcome-coverage](../data/outcome-coverage/summary.md) |
| Disposition / frontier | meta | meta | meta | meta | [disposition-frontier](../data/disposition-frontier/summary.md), [master-catalog-matrix](../data/master-catalog-matrix/summary.md) | **100% verified disposition, 0 genuine todo** |
| ConfigHub proof (scan/safe-ops) | – | – | ● | ● | confighub proof lanes, `<chart>:verify-proof` | complete in-ConfigHub → [outcome-coverage](../data/outcome-coverage/summary.md) |
| Local k8s live | ● | ● | ○ | ● | `chart-install-test`, local-live receipts | partial, receipt-gated → [status-dashboard](../data/status-dashboard/summary.md) |
| Strict kind-parity (2-cluster) | ● | ● | – | ● | `live-helm-installer-kind-parity-test`, `kind-parity:run` | partial → [live-kind-parity](../data/live-kind-parity/summary.md) |
| GitOps / OCI live | ○ | ● | ● | ● | `chart-install-test`, [runtime-gitops](../data/runtime-gitops/summary.md) | partial → [live-helm-confighub-compare](../data/live-helm-confighub-compare/summary.md) |
| Live Helm-vs-ConfigHub parity | ● | ● | ● | ● | `live-helm-confighub-parity-test` | partial → [live-parity-rerun-plan](../data/live-parity-rerun-plan/summary.md) |
| Variant-promotion | – | – | ● | ● | `target-bound-derived-variant-test`, promotion receipts | 180 proven → [variant-promotion](../data/variant-promotion/summary.md) |
| Lifecycle / hooks (observe→execute→emit) | ● | ● | ○ | ○ | [hook-lifecycle](../data/hook-lifecycle/summary.md), `run-hook-test-proof` / `run-hook-execution-proof`, [gitops-route-emission](../data/gitops-route-emission/summary.md) | partial — observed for maintained hook charts; execute + emit proven; routed-but-unobserved cells remain → [lifecycle-boundary](../data/lifecycle-boundary/summary.md) |
| cub-scout day-1 preview | ○ | ● | ○ | ● | cub-scout `compare three-way --dry-from` | shipped command, design-stage coverage → [cub-scout-diff](../data/cub-scout-diff/summary.md) |
| UX: persona audit (product comprehension) | spans | spans | spans | spans | [persona-ux-strategy.md](persona-ux-strategy.md), [baseline 2026-06-21](../docs/planning/persona-ux-baseline-2026-06-21.md) | methodology + first baseline; re-run after major site/doc changes |
| UX: journey pathways | ● | ● | ● | ● | [docs/user/pathway-*](../docs/user/pathway-route-hooks-transparently.md), [user-journey-test-pathways-plan](../docs/planning/user-journey-test-pathways-plan.md) | partial — Pathway 1 (hooks) shipped; others pending |
| UX: website / outside-user / adversarial | spans | spans | spans | spans | [WEBSITE_UX_TEST.md](../WEBSITE_UX_TEST.md), [outside-user-test](../docs/planning/outside-user-test.md), [pilot-adversarial-testing](../docs/planning/pilot-adversarial-testing.md), [adversarial-strategy.md](adversarial-strategy.md) | runbook + plan + probe method |
| Adversarial / refusal boundary | ● | ○ | – | – | [torture-suite](../data/torture-suite/summary.md), [adversarial10](../data/adversarial10/summary.md), [quirk-coverage](../data/quirk-coverage/summary.md) | refusal boundary covered |
| Random-bad-decisions fuzz | ● | ○ | – | – | `run-bad-decisions-fuzz`, [bad-decisions-fuzz](../data/bad-decisions-fuzz/summary.md) | 180 cases, 0 unclassified (rejected 1% / leaked 33% / absorbed 66%) |

## How we state coverage

This is the honesty rule that keeps the map trustworthy:

1. **"Complete / 100%" applies only to the static catalog parity & verification** —
   render parity and verified disposition. That part is genuinely finished
   (1194 frontier cells, 100% verified disposition, 0 genuine todo).
2. **Every live / lifecycle / UX class states its own honest coverage** — counts,
   `watch`/`blocked`, and what's pending — **never rolled up into a blanket "100%
   of everything."** `watch` ≠ `pass`; promotion-proven ≠ production-proven;
   render parity ≠ live-ready; a routed hook ≠ an executed hook.
3. **Each number cites its generated surface** (linked above), so the map stays
   honest and current instead of asserting. The live dashboard is
   [status-dashboard](../data/status-dashboard/summary.md); this page is the map.

## The layers

The map routes into the existing detail — fit around this page, not replaced by it:

| For… | Go to |
| --- | --- |
| **The standing principles (OCI transport · Argo+Flux+kubectl · never-silent · quirks through ConfigHub)** | **[doctrine.md](doctrine.md)** |
| What claim each lane proves (the Coverage Ladder) | [strategy.md](strategy.md) |
| Which `npm run …` matches my edit | [npm-scripts.md](npm-scripts.md) |
| The generated inventory of every script | [npm-script-catalog.md](npm-script-catalog.md) |
| The exact reproducible per-chart procedure | [runbook.md](runbook.md) |
| The persona / tier-aware adversarial usage probe | [adversarial-strategy.md](adversarial-strategy.md) |
| Whether a visitor can understand the site (persona UX audit) | [persona-ux-strategy.md](persona-ux-strategy.md) |
| The recorded F1–F4 findings | [findings.md](findings.md) |
| The top-100 runtime/GitOps sweep plan | [top100-runtime-gitops.md](top100-runtime-gitops.md) |
| Current aggregate status (the live dashboard) | [status-dashboard](../data/status-dashboard/summary.md) |

## Test cadence

Use scoped checks while working. Use the full repository verifier (`npm run verify`)
as a broad release gate after focused checks pass. Use live tests only to create or
refresh live evidence.

| Question | Start with |
| --- | --- |
| Which check matches my edit? | [npm-scripts.md](npm-scripts.md) |
| What does this exact `npm run …` do? | [npm-script-catalog.md](npm-script-catalog.md) |
| What claim does each lane prove? | [strategy.md](strategy.md) |
| What is the current chart/base status? | [status-dashboard](../data/status-dashboard/summary.md) |
| Which live rows to rerun next? | [live-parity-rerun-plan](../data/live-parity-rerun-plan/summary.md) |

Do not use `npm run verify` as a substitute for a fresh live test (it verifies the
committed corpus and receipts). Do not use a live test as a substitute for render
parity. They prove different things.

## Cluster/runtime runners (resolve the repo from their own location)

- `chart-install-test` — install one chart/base via `cub installer` → ConfigHub → OCI → Argo on a cub-lk rig; verify runtime + three-way agreement; emit a receipt.
- `chart-install-sweep` — shardable top-20 driver: `--rig <cub-lk> [--shard i/n] [--slugs a,b]`.
- `live-helm-installer-kind-parity-test` — strict two-cluster Helm-vs-installer parity (no cub-lk needed).
- `live-helm-confighub-parity-test` — live Helm vs ConfigHub delivery, dual compare.
- `target-bound-derived-variant-test` — `cub variant create --target`, deliver cloned Units via OCI/Argo, verify runtime, emit a receipt.
- `existing-secret-proof` — the F3 fix path: pre-provision the Secret, install the existing-secret base, confirm Ready.
- Lifecycle proofs: `npm run hook-test:proof` / `hook-execution:proof` (and `:verify`) — route a hook as an explicit, receipted action on a throwaway kind cluster.

## Run (standalone)

```sh
cub auth login                      # verify: cub organization list (NOT cub info)
cub plugin install jesperfj/cub-lk  # verify: cub lk version
cub lk up --name myrig
tests/chart-install-test --package packages/bitnami/nginx/24.0.2 --slug nginx \
  --namespace nginx --rig myrig --json     # add --helm-expt . if run from elsewhere
cub lk down --name myrig
```
