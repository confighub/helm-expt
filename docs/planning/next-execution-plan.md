# Next Execution Plan

This plan captures the backlog from the question:

```text
Are the top 20 the best, simplest, safest way for a Helm user to install and vary it?
```

through the current repo-structure, installer-capability, target-facts, and
`cub variant` discussion.

## Mission

Prove this claim for public Helm charts:

```text
correct variants
safe operations
immediate proof
```

In Helm-user language:

```text
Use the charts you already trust.
Install and vary them with less pain.
See exactly what changed and why before you ship.
```

## Today's Roadmap

For the reviewer-facing harness explanation, see
[How The Harness Works](../user/how-the-harness-works.md). That is the shortest
explanation of how the harness proves chart behavior today, what product
capabilities are still missing, and where each issue fits.

For the current top-20 chart-version refresh, Redis promotion variant work, and
Kubara overlay golden, see
[Latest Top-20 Refresh Plan](./latest-top20-refresh-plan.md) and:

```text
data/latest-top20-refresh/
```

For the first dedicated website shape, see
[Dedicated Website Plan](./dedicated-website-plan.md).

## Current Baseline

Use generated status pages for current counts. Do not maintain exact live,
production, or refresh counts by hand in this plan.

| Question | Current source |
| --- | --- |
| What is working now, and what is partial? | [data/status-dashboard/summary.md](../../data/status-dashboard/summary.md) |
| Which exact chart/base rows have each proof lane? | [data/outcome-coverage/summary.md](../../data/outcome-coverage/summary.md) |
| Which base variant should a user try first? | [data/top20-base-readiness/summary.md](../../data/top20-base-readiness/summary.md) |
| Which non-pass live rows need decisions or reruns? | [data/live-parity-rerun-plan/summary.md](../../data/live-parity-rerun-plan/summary.md) |
| Which latest chart versions are promotion candidates? | [data/latest-top20-refresh/summary.md](../../data/latest-top20-refresh/summary.md) |
| Which compact work rows are next? | [data/next-ten-waves/summary.md](../../data/next-ten-waves/summary.md) |
| Which top-20 production-support tasks can be assigned? | [data/production-support-decisions/work-items.csv](../../data/production-support-decisions/work-items.csv) |

Do not paste live, matrix, production, or refresh counts into this plan. Those
counts move as live rows land and generated surfaces refresh. The current
browser-readable status is:

```text
data/master-catalog-matrix/matrix.html
```

The compact GitHub-readable status is:

```text
data/status-dashboard/summary.md
data/outcome-coverage/summary.md
data/matrix-completion-audit/summary.md
data/live-matrix-burndown/summary.md
data/live-parity-rerun-plan/summary.md
```

When a row moves from todo/watch/blocked to pass, update the relevant generated
surface and let those files carry the number.

## Current 99% Goal Shape

The repo now has the main matrices that were missing earlier: pain-point
coverage, edge recovery, variant-path coverage, quirk coverage, outcome
coverage, top100/top500 analysis, live-parity status, and production-support
work items.

The next step is to turn those artifacts into product-grade confidence. This is
not a request for more broad verifier output or fake green cells. It is a
request to close the important chart and workflow residues that users will
feel.

The goal for the master matrix is not "make every cell green." The goal is that
every top-100 chart/base cell has a verified disposition:

```text
pass        the lane is proven for the stated scope
watch       the main path works, but a runtime, lifecycle, or target behavior needs review
blocked     the lane cannot make a green claim until a named prerequisite, model gap, or product decision is closed
refused     the chart, option, or lane is intentionally outside the current catalog boundary
n/a         the lane does not apply to that row
todo        temporary state only; every todo must have a named next action
```

This matters more than a green dashboard. A correct `watch`, `blocked`,
`refused`, or `n/a` cell is part of the product because it tells a user where
the proof stops.

The four working goals are still the right shape for the launch push:

| Goal | Meaning | Evidence |
| --- | --- | --- |
| 1. Top-100 matrix completeness | Every top-100 chart/base has a clear user route, evidence status, lifecycle/quirk status, production scope, and next action. Green where real; `n/a`, `watch`, `blocked`, or `refused` where honest. | `data/master-catalog-matrix/matrix.html`, `data/chart-use-guide/summary.md`, `data/top100-readiness/summary.md`, `data/outcome-coverage/summary.md`. |
| 2. Excellent public website and docs | A user can move from zero-touch public use to full ConfigHub operations and understand why, what, how, limits, free tier, and paid/managed boundary at each stage. | `README.md`, `docs/user/offering.md`, `docs/user/choose-your-path.md`, `docs/user/try-now.md`, `site/*.html`. |
| 3. Tested UX, including Pilot | A fresh team user or Pilot run can follow the docs, install or inspect a chart, verify the result, see ConfigHub Units, understand variants, and know what to do next. | `docs/planning/pilot-adversarial-testing.md`, Pilot reports under `runs/`, tutorial receipts, `docs/user/tutorial-sequence.md`. |
| 4. Strategy docs converted into product outcomes | The planning corpus maps to visible product claims, catalog features, tests, roadmap items, and commercial tiers. No orphan ideas. | `docs/planning/`, `docs/user/product-support-tiers.md`, `data/claims-register/summary.md`, `data/outcome-evidence-contract/summary.md`. |

Five supporting goals keep those four honest:

| Goal | Why it matters | Evidence |
| --- | --- | --- |
| 5. Lifecycle and hard-chart proof | Hooks, CRDs, webhooks, generated facts, target facts, APIService, admission mutation, upgrades, and rollbacks are where skeptical Helm users will test the model. | `data/hook-disposition/`, `data/lifecycle-boundary/`, `data/lifecycle-observations/`, `data/apiservice-coverage/`, serious-chart packets. |
| 6. Production readiness by target scope | Users need to know what is safe for dev, what is review-ready, and what is production-supported for a specific target shape. | `data/production-support-decisions/`, `data/production-disposition/`, per-chart catalog status. |
| 7. Maintenance and freshness | Upstream chart updates, stale receipts, old-version support, patching, top100/top500 refresh, and promotion must be predictable. | `data/refresh-survival/`, `data/latest-top20-refresh/`, `docs/user/maintenance-sla.md`. |
| 8. External reproduction and sceptic proofing | Internal evidence is not enough for strong trust claims. The cluster matrix, external reproduction, time-travel re-verification, and upgrade gauntlet remain open proof work. | `docs/planning/robust-sceptic-plan.md`, `data/claims-register/`, `data/blast-radius-accuracy/`, `data/torture-suite/`, `data/environment-matrix/`. |
| 9. Variant and commercial clarity | Users must understand base variants, derived ConfigHub variants, custom overlays, fleets, promotions, free use, and managed/paid services without seeing proof machinery first. | `docs/user/creating-variants.md`, `docs/user/custom-overlays.md`, `docs/user/product-support-tiers.md`, `docs/planning/verified-install-commercial-model.md`. |

The maturity target is:

| Level | Meaning | Main work |
| --- | --- | --- |
| 90% | The proof corpus is credible. Public charts have recipes, base variants, render parity, receipts, pain reports, and generated status. | Keep the corpus honest and current. |
| 95% | The public offering is obvious. A Helm user can see why the model is better, choose a chart/base, understand the proof boundary, and see what remains before production. | Close the serious-chart and high-fanout examples, production-support queues, lifecycle residues, and first-run docs. |
| 99% | The product is a managed desired-state system. ConfigHub stores the graph of variants, approvals, operations, receipts, target assignments, and freshness across many clusters and teams. | Product implementation across ConfigHub Server, `cub installer`, `cub variant`, GitOps, and cub-scout. |

The shift from 90% to 95% should not be measured by how many more charts have
static parity. It should be measured by whether a skeptical Helm user can see a
hard chart, a real variant operation, and a production-support queue and say:

```text
I know what this installs.
I know how it differs from Helm.
I know what changed across variants.
I know what is safe today.
I know what still needs a decision.
```

## Current Launch Workstreams

The next work should be organized by user outcome, not by whichever generator is
nearest to hand.

| Workstream | Owner lane | Done when |
| --- | --- | --- |
| Public website | Product/site lane | A first-time Helm user can land on the site, choose a path, inspect a chart, understand free versus managed use, and see live proof without reading planning docs. |
| Top-100 catalog completion | Dataset/catalog lane | Every top-100 chart has a user route, a recommended first base or a reason it lacks one, hook/quirk disposition, production-scope status, and a next action. |
| Hard-chart live proof | Live evidence lane | Kube-prometheus-stack, cert-manager, External Secrets, Argo Workflows, Argo Rollouts, and at least one stateful Bitnami chart have current live proof for their important base routes and lifecycle boundaries. |
| Variant and operations story | Product proof lane | A user can see when to use a base variant, when to use a derived ConfigHub variant, and when a change must be handled as a delivery prerequisite or managed overlay. |
| Sceptic proofing | Adversarial lane | Claims register, blast-radius accuracy, hook dispositions, environment matrix, torture fixtures, refresh survival, and upgrade evidence all name their limits and next tests. |

## Productisation Roadmap For The Highest-Value Features

The public site should not only describe the proof corpus. It should
accommodate the user jobs that make the product valuable, test them as flows,
and turn the proven parts into product surfaces. The current public web pages
are the entry points; the roadmap below is the acceptance layer behind them.

| Feature | User value | Accommodation in the public product | Testing and evidence | Productisation path |
| --- | --- | --- | --- | --- |
| Variants and promotion | Users can choose a reviewed base, derive target/environment/customer variants, preview differences, and promote safely as part of application SDLC. | `site/variants.html`, `site/journey.html`, per-chart variant cards, matrix variant layer, and ConfigHub application examples. | Variant promotion receipts, Redis/NGINX/kube-prometheus-stack promotion examples, `cub variant create` and `cub variant promote` command checks. | Product UI for base-vs-derived routing, preview, checks, approvals, promotion, and receipts over existing ConfigHub primitives. |
| Apps, custom apps, and stacks | Users can combine public charts, private services, wrapper charts, overlays, and target facts into one desired-state graph. | `site/journey.html`, `site/custom-apps.html`, private catalog boundary, custom overlay examples, and app-readiness data. | Managed overlay golden, app-readiness queries, external-dns overlay example, future private-catalog and import receipts. | ConfigHub private catalog/import workflow for wrapper charts, values overlays, internal services, and application release. |
| Bulk scan, bulk patch, and fleet operations | Teams can answer "where is this running?", scan many Units, patch safely, and roll out in waves after the application graph exists. | `site/operations.html`, fleet and bulk operation references, matrix/database links. | Bulk scan/patch tutorial, blast-radius fleet evidence, cub-scout desired-vs-live design, fleet ledger receipts when available. | Server feature set for fleet inventory, bulk changesets, approvals, wave rollout, policy gates, and audit history. |
| Upgrade and crash prevention | Risky Helm upgrades become staged, diffed, rehearsed, gated, observed changes instead of opaque `helm upgrade` events. | FAQ and future public upgrade page, serious-chart proof, kube-prometheus-stack upgrade examples. | Render old/new object diffs, CRD upgrade delta, workload upgrade rehearsals, refresh-survival data, hard-chart packets. | Managed upgrade campaign workflow: candidate version, blast radius, live rehearsal, approvals, rollout, rollback, and receipt pack. |
| Target prerequisites and lifecycle routes | Users know what must exist before apply/GitOps can converge: CRDs, Secrets, storage, topology, webhooks, cloud identity, and hooks. | Helm Catalog ConfigHub Actions section, FAQ, chart pages, matrix hard-gap fields, and target-prerequisite guides. | Target-prerequisite action packets, lifecycle-route actions, hook dispositions, live observations for cert-manager/ESO and serious charts. | Product preflight checklist and target-facts UX with machine-readable action packets for CLI, UI, agents, and fleet runs. |
| Database and matrix reading | Users can inspect the exact chart/version/base status without reading raw CSVs or treating proof rows as the product. | Helm Catalog links to `site/matrix.html`; Docs page routes to matrix, generated data index, claims register, and status dashboard. | `master-matrix:verify`, docs/site verification, matrix completion audit, chart-use guide. | Future "Database" menu/page if the matrix becomes a first-class browsing and filtering product surface. |

Each row must follow the same pattern:

```text
public page -> concise user flow -> evidence surface -> verifier or receipt -> product surface
```

Planning notes stay private unless they are distilled into one of those user
flows. A feature is not productised merely because it has proof data; it becomes
productised when a user can find it, run or understand it, verify the result,
and see the limits without reading internal planning material.

## Desktop Planning Sweep, 2026-06-16

The Desktop planning notes were reviewed against the repo docs, open issues, and
roadmap. The result is:

| Desktop note | Canonical repo home |
| --- | --- |
| Helm pain points | [Helm Pain Points](../user/helm-pain-points.md), [pain-point coverage](../../data/pain-point-coverage/summary.md), per-chart `helm-pain-report.yaml` files. |
| Product support tiers | [Product Support Tiers](../user/product-support-tiers.md), [Maintenance Strategy](./maintenance-strategy.md). |
| Low-friction serverless installer | [Serverless Verified Install Model](./serverless-verified-install-plan.md), issue [#23](https://github.com/confighub/helm-expt/issues/23). |
| Commercial safety model | [Verified Install Commercial Model](./verified-install-commercial-model.md), issue [#949](https://github.com/confighub/helm-expt/issues/949). |
| Helm community personas | [Helm Community Persona PRD](./helm-community-persona-prd.md), [Persona Plan](./helm-community-persona-plan.md), [Persona Reference](../reference/helm-community-persona-reference.md). |
| Robust sceptic plan | [Robust Sceptic Plan](./robust-sceptic-plan.md), claims register, blast-radius, torture, environment, hook, and lifecycle data surfaces. |
| Pilot HelmOps PRD | `confighub-ai-demo` roadmap and milestone; helm-expt owns upstream evidence such as issue [#948](https://github.com/confighub/helm-expt/issues/948). |

The sweep produced one new helm-expt tracker: [#949](https://github.com/confighub/helm-expt/issues/949)
for Helm remediation, lifecycle intelligence, and commercial support lanes.
Pilot-specific HelmOps hardening lives in `confighub-ai-demo` under its
`HelmOps product hardening` milestone. The main ownership rule remains:

```text
helm-expt proves catalog and live-evidence claims.
ConfigHub/cub/installer implement managed operations.
Pilot consumes the evidence and gates user-facing routes.
```

The website must not present proof machinery as the product. The public flow
should be:

```text
choose chart
choose supported base
inspect exact objects
verify the proof
upload or deliver through ConfigHub
operate with variants, scans, approvals, observations
```

Receipts stay underneath that flow. They are linked for trust and audit, not
used as the first-screen explanation.

| Priority | Work | Why it matters | Evidence to update |
| --- | --- | --- | --- |
| 1 | Turn the public site into the launch front door. | The repo has too much internal proof context for a first-time user. The website must carry the simple product story: why, what, how, proof, limits, and upgrade path. | `site/*.html`, `scripts/generate-public-site.mjs`, `docs/planning/dedicated-website-plan.md`, `docs/user/offering.md`. |
| 2 | Close more complete-core rows in the master matrix. | The main proof gap is no longer render parity. It is live GitOps/OCI and strict Helm-vs-ConfigHub parity across more important rows. | `data/master-catalog-matrix/matrix.html`, `data/outcome-coverage/base-outcomes.csv`, `runs/live-helm-confighub-compare/`. |
| 3 | Make kube-prometheus-stack the serious-chart proof. | It exercises high object count, CRDs, webhooks, RBAC, generated facts, extension slots, and large blast radius. It is the best answer to "does this survive real Helm complexity?" | `docs/user/prometheus-high-fanout.md`, `data/hard-chart-production-packets/`, live and lifecycle receipts for the monitoring scope. |
| 4 | Close top-20 production-support work items. | The catalog is useful only when a user can see which bases are supported for a target scope and what remains before production use. | `data/production-support-decisions/work-items.csv`, per-chart `catalog-status.yaml`, target-scoped receipts. |
| 5 | Expand field reachability beyond Redis and KPS. | Helm's root problem is forgetful 1-to-many generation. The next gap is mapping more rendered fields back to values, generated facts, target facts, and extension slots. | `data/edge-recovery/edges.csv`, per-chart `inheritance-graph.yaml`, value-source maps, `data/blast-radius-accuracy/`. |
| 6 | Finish hook and lifecycle observations for maintained hook charts. | Hook inventory is not enough. Users need to know whether lifecycle behavior is skipped, blocked, mapped, or observed. | `data/hook-lifecycle/summary.md`, `data/hook-disposition/summary.md`, `data/lifecycle-boundary/summary.md`, lifecycle execution or observation receipts. |
| 7 | Keep the public path short. | A new Helm user should understand the offering, pick a base variant, run the command, and know what proof they have without reading the planning corpus. | `README.md`, `CATALOG.md`, `docs/user/try-now.md`, `docs/user/current-proof-status.md`, generated site pages. |

## Immediate Launch Sequence After The Planning Sweep

The next work should close user-visible confidence gaps before adding more
internal proof surfaces. The current status is strong enough to launch a proof
site, but not yet strong enough to imply production support across the top-100.

The launch push should prioritize the work a skeptical Helm user will feel:

```text
Can I understand the product in five minutes?
Can I try a chart without signing up?
Can I see which variants are useful?
Can I see what is production-supported versus only proven?
Can I see hard Helm behavior handled honestly?
Can I bring a problem chart and get a receipt, route, or refusal?
```

Do not optimize the launch around more proof machinery on the first screen.
The website should expose proof as trust, not as the product path.

| Order | Work | Concrete next step | Main sources |
| ---: | --- | --- | --- |
| 1 | Public website launch path | Make `site/index.html`, `site/proof.html`, `site/tiers.html`, and the chart pages the primary user journey: choose chart, choose base, inspect proof, understand free versus managed next step. | `docs/planning/dedicated-website-plan.md`, `site/README.md`, `data/master-catalog-matrix/matrix.html`. |
| 2 | Complete-core expansion | Continue serial live Helm-vs-ConfigHub parity runs for the highest-value rows until each new pass updates the master matrix, status dashboard, and promotion wave. | `data/master-catalog-matrix/matrix.html`, `data/outcome-coverage/base-outcomes.csv`, `runs/live-helm-confighub-compare/`. |
| 3 | Promotion review wave | Turn the 24 strict top-100 promotion packets into human decisions: selected base, scan/gate disposition, lifecycle route, support scope, and production decision. | `data/top100-promotion-wave/summary.md`, `data/top100-promotion-wave/review-packets/`. |
| 4 | Useful base buildout | For the 35 user-shaped variant rows, create bases only when the change is a real Helm-user install shape. Do not manufacture bases just to make cells green. | `data/top100-coverage/work-queue.md`, `data/useful-base-design-queue/summary.md`, `data/useful-base-realization-wave/summary.md`. |
| 5 | Hard-chart proof | Keep kube-prometheus-stack as the serious-chart exemplar, and close the obvious lifecycle gaps for cert-manager, External Secrets, Argo Workflows, and at least one stateful chart. | `docs/user/serious-chart-proof.md`, `data/production-readiness-packets/`, issues `#643`, `#248`. |
| 6 | Hook and lifecycle trust | Treat every hook as routed, observed, refused, or per-target. The public claim is not universal hook execution; the public claim is that lifecycle behavior is no longer hidden. | `data/hook-disposition/summary.md`, `docs/reference/what-hook-support-means.md`, `docs/user/hook-lifecycle-strategy.md`. |
| 7 | Variant operations | Make the base-versus-derived-versus-delivery decision obvious in tutorials, then prove the ConfigHub side through derived variants, target-bound receipts, promotion examples, and bulk scan/patch. | issues `#143`-`#152`, `docs/user/creating-variants.md`, `docs/user/tutorial-sequence.md`. |
| 8 | External reproduction | Run the outside-user/Pilot path against the public site and tutorials, then record where a fresh user gets confused or where a CLI command is imagined. | `docs/planning/outside-user-test.md`, `docs/planning/pilot-adversarial-testing.md`, `docs/planning/independent-review-brief.md`. |
| 9 | Commercial proof boundary | Keep the free path useful for public artifacts; route private overlays, stacks, old-version patch support, fleet operations, approvals, and production evidence into managed tiers. | `docs/user/product-support-tiers.md`, `docs/planning/verified-install-commercial-model.md`, `docs/user/offering.md`. |

## Current Hard Blockers For 95%+

These are the blockers that matter more than adding easy green cells:

| Blocker | Why it matters | Current route |
| --- | --- | --- |
| Consul secure-mesh target-fit row | It is the only current selected live parity non-pass row. It needs a target with the declared target shape or an honest target-scope decision. | `data/live-parity-rerun-plan/summary.md`, `recipes/hashicorp/consul/2.0.0/target-topology.yaml`. |
| Argo Workflows CRD hook/default split | It is a real example of "hooks are the install"; the default omits CRDs unless the hook route or a minimal-CRDs base is used. | issue `#643`, hook/lifecycle and useful-base lanes. |
| ConfigHub bulk unit-create failures | Several next80 rows are blocked by server-side `unit create` or bulk-create failures rather than chart semantics. | issue `#645`; keep rows partial until the server issue is resolved. |
| Mutable image tags | OCI artifact integrity does not fully bind runtime if rendered image tags float. | issue `#99`, image digest workdown. |
| Namespace transformer limits | Complex charts can retain embedded namespace references if users choose non-canonical namespaces. | issue `#96`; prefer render-time namespace or a refusal/warning for affected bases. |
| Public website polish | The evidence exists, but the first-time user flow still needs product clarity, chart pages, problem-chart intake, and free-versus-managed routing. | `docs/planning/dedicated-website-plan.md`, generated `site/`. |

If Claude or another agent helps, give them one of these blockers with a narrow
PR boundary. The live lane remains serial; non-live dataset and website work can
run in isolated worktrees.

When another agent helps, prefer these splits:

| Agent lane | Owns | Avoids |
| --- | --- | --- |
| Codex live lane | Serial live parity, ConfigHub/OCI runs, receipt commits, generated status/site refresh after live evidence. | Running multiple live lanes concurrently. |
| Claude dataset lane | Promotion packet review drafts, useful-base design, hook/quirk audits, matrix consistency, website copy PRs. | Creating kind clusters or editing generated site files while the live lane is regenerating. |
| Claude product lane | First-user walkthroughs, website information architecture, plain-English tutorial review, persona checks. | Changing proof semantics or broad generators without a focused PR. |

## Parallel Work Split

Use separate branches or worktrees. Do not run live lanes concurrently.

| Lane | Good for Codex | Good for Claude |
| --- | --- | --- |
| Live evidence | Serial live parity, ConfigHub/OCI runs, hard chart runtime diagnosis, committing receipts, refreshing generated surfaces. | Static analysis of failed receipts, route proposals, issue comments, small verifier improvements that do not create clusters. |
| Dataset/catalog | Merging generated evidence after live runs, resolving model defects found by live proof. | Top-100 useful-base design, hook/quirk table audits, field-reachability maps, CSV consistency work. |
| Website/product | Final review and merge, because it touches generated site files and public messaging. | Drafting page sections, copy tests, persona walkthroughs, outside-user review scripts, site information architecture. |
| Sceptic proof | Live upgrade or lifecycle tests where a cluster is required. | Torture fixtures, blast-radius cases, claims-register gaps, environment matrix expansion, issue triage. |

Claude should avoid the live parity runner unless explicitly assigned the live
lane for a window. When Claude works on site or dataset changes, it should open
PRs and state which generated files it touched so the live lane can regenerate
after merge if needed.

The 99% product target is the persistent ConfigHub graph. helm-expt should feed
that graph by producing chart, variant, provenance, quirk, and receipt data that
is independently checkable. ConfigHub Server then adds authority, query,
history, approvals, target assignment, and freshness across many variants and
clusters.

The main 95% demonstration should use kube-prometheus-stack, not because it is
easy, but because it is hard in the ways Helm users recognize: CRDs, webhooks,
cluster RBAC, generated facts, extension slots, lifecycle behavior, and a large
object surface. Redis remains the teaching path. NGINX remains the simple
web/live path. kube-prometheus-stack is the chart that proves the model is not
only a happy-path wrapper.

The first high-fanout operation should show a shared change before it is
shipped:

```text
selected base or shared input
-> affected variants and fields
-> protected overrides
-> object-level deltas
-> scans/gates
-> delivery or observation receipts where available
```

This is the practical answer to Helm's fanout x density x blast-radius problem.
It is more valuable than another broad parity count because it shows a user how
ConfigHub makes a risky fleet change reviewable before it reaches a cluster.

Important boundary:

```text
Top-20 catalog presence is mandatory because these charts are popular.
Machine proof decides support scope; it does not erase production review.
Catalog support scope must be explicit in catalog-status.yaml.
```

Issue and command baseline:

```text
#76 is closed as a verifier-backed definition of the Helm import path from
`cub helm template` / `cub helm install` to durable `cub installer` recipes.
The future `cub installer import helm` command remains product implementation
work, not a blocker for the current proof corpus.
The Helm pain table explanation work is closed; keep
[Helm Pain Points](../user/helm-pain-points.md) and
[Pain Point Coverage](../../data/pain-point-coverage/summary.md) current as
the proof lanes change.
Use scoped verifiers while editing. Use the full `npm run verify` only as the
broad release gate.
```

## Roadmap Integration: Real Cub And ConfigHub Capabilities

The capability doctrine turns into two roadmap tracks:

```text
Use existing verbs now.
Request missing verbs only where the current product surface is awkward, manual,
or script-only.
```

The overlay doctrine adds one more roadmap constraint:

```text
First try should be possible without full product signup for public signed artifacts.
Public chart base variants stay in the public catalog proof.
Post-render environment/customer variants require ConfigHub Server.
Wrapper charts plus customer overlays are managed overlay imports and are not
claimed as solved by the free/static proof alone.
```

See [Product Support Tiers For Helm Scenarios](../user/product-support-tiers.md).

The hook doctrine adds a lifecycle constraint:

```text
Helm hooks are source-visible but execution-dependent.
The public catalog must inventory and classify them.
Production support needs lifecycle receipts and observations, or an explicit
blocker.
```

The current top-500 source scan found 54 hook-using charts among 495 scanned
charts. A first-pass risk estimate classifies 42 as likely problematic, 6 as
needs-review, and 6 as probably benign/test-only. See
[Hook Lifecycle Strategy](../user/hook-lifecycle-strategy.md).

### Use Current ConfigHub Capabilities

These existing verbs should move into the proof path wherever they make the
result simpler, safer, or more provable.

| Lane | Existing verbs | Roadmap home | Acceptance |
| --- | --- | --- | --- |
| Installer proof | `cub installer doc/setup/render/package/push/sign/verify/vet/plan/upload/inspect/list` | P0.4, P1.1 | Redis and each promoted catalog candidate shows package docs, deterministic setup/render, deterministic bundle, vet/plan output where useful, upload or publish evidence, and ConfigHub Unit reconciliation where available. |
| Server variants | `cub variant create` clone/link substrate plus Creator contract over ConfigHub primitives | P0.5 | Redis demo shape describes cloning a reviewed uploaded base space when server-side variation is simpler than another Helm render. |
| Review and diff | `cub unit diff`, `cub revision data/list`, `cub unit data/tree/list` | P1.6 | Demo shows exact Unit data, revision history, tree view, and object-level differences for at least Redis. |
| Safe operations | `cub changeset create/list/update`, `cub unit approve/apply/destroy/cancel` | P1.7 | Local/test operation lane creates a changeset, records approval/apply intent, and shows how unsafe operations are gated or cancelled. |
| Scanning and misconfig | `cub function vet`, `cub function get/set`, `cub run ...` | P1.8 | Rendered objects or uploaded Units get ConfigHub function checks with scan/gate receipts. |
| Target and live facts | `cub target create/get/list`, `cub k8s collect`, `cub k8s source`, `cub unit livestate/livedata/refresh` | P1.3, P1.4 | Local kind target proves target facts, source tracing, and freshness/unknown status where available. |
| GitOps adoption | `cub gitops discover/import` | P2.5 | Separate compatibility proof shows ConfigHub can discover/import existing Argo/Flux resources without confusing this with the installer package path. |
| Metadata model | `cub tag`, `cub attribute`, `cub filter`, `cub view`, `cub link` | P1.9 | Catalog entries become searchable by chart, recipe, variant, target, risk, support status, and dependencies. |

### Missing Verb Asks

These are product/installer asks, not blockers for continuing the public proof.
Where repo scripts already perform the job, the ask is to turn a proven pattern
into a reusable `cub` capability.

Current command routing:

| User need | Current command | Product role |
| --- | --- | --- |
| Render and inspect a Helm chart locally | `cub helm template` | Fast renderer and baseline generator |
| Render and load a chart into ConfigHub Units | `cub helm install` | Fast one-shot ConfigHub action |
| Discover/import existing Argo CD or Flux apps | `cub gitops discover` / `cub gitops import` | Existing app adoption path |
| Import KRM YAML, rendered manifests, or live resources | `cub unit import` or managed import workflow | Generic Kubernetes resource adoption path |
| Build a maintained, variant-aware catalog entry | repo generator + `cub installer` package path | Current proof substrate |
| Graduate fast Helm path into maintained catalog path | future `cub installer import helm` | Missing bridge |

| Priority | Ask | Why |
| --- | --- | --- |
| P0 ask | `cub installer import helm` | Makes chart -> installer recipe/package a product capability, not an AI/script-only step. |
| P0 ask | `cub installer analyze` | Makes HelmPlan / chart weirdness visible before install. |
| P0 ask | implemented `cub installer preflight` | Turns target facts and `externalRequires` into live checks. |
| P0 ask | `cub installer compare` or `cub installer prove` | Turns Helm-vs-`cub installer` equivalence into a product receipt. |
| P1 ask | `cub installer scan` | Gives rendered-object scan receipts without hand-wiring scripts. |
| P1 ask | `cub variant list/diff/promote/update` and Creator-aware preview/check surfaces over `cub variant create` | Completes the server-side variant lifecycle around the existing clone/link command. |
| P1 ask | `cub observe` or `cub target observe` | Gives workerless ConfigHub a clean observation receipt path. |
| P2 ask | `cub catalog search/show/install` | Makes the public catalog first-run UX simple after the proof shape is stable. |

### Low-Friction Standalone Lane

Top-of-funnel requirement:

```text
Make the first experience feel like helm install redis, not platform signup.
```

Target:

```text
public catalog entry
public signed package / OCI artifact
authenticated or rate-limited public pull
user-owned cluster
optional Argo CD or Flux OCI sync
local verification receipt
```

Signup and auth boundary:

```text
No full product signup for trying public catalog artifacts.
Authenticated/rate-limited public pulls are acceptable for abuse prevention.
Artifact signatures and digest verification are required for trust.
Browser cookies help the web catalog, but OCI/GitOps needs pull credentials.
Full signup for private charts, private overlays, server-side variants,
production approvals, managed receipts, fleet operations, and patch/support
workflows.
```

Acceptance:

- README explains the low-friction path as a product target without overclaiming
  current automation or promising an unauthenticated gateway.
- Product tiers include a Tier 0 standalone try path with auth/rate-limit and
  signature expectations.
- GitOps/OCI examples stay honest about what is local proof, what is live
  controller proof, and what requires ConfigHub Server.

### Hook And Lifecycle Intelligence Lane

Hooks and other lifecycle-sensitive chart behavior should become a proof lane,
not a hidden exception.

Action:

```text
turn hook scan evidence into per-chart hook disposition
map test-only hooks to explicit checks
map safe lifecycle hooks to Argo/GitOps lifecycle actions where possible
block unsafe or unclear hooks before production support
record execution-or-skip and observation receipts
```

Commercial direction:

```text
public catalog = hook inventory and support-scope honesty
managed tier = private hook analysis, lifecycle translation, upgrade/rollback
receipts, and evidence packs
```

Acceptance:

- top-500 catalog analysis exposes hook risk buckets;
- `helm-pain-report.yaml` records hook disposition for catalog-supported charts;
- production disposition cannot mark a hook-using chart production-ready without
  lifecycle receipt or explicit safe skip/test disposition;
- managed/commercial docs explain hook translation as lifecycle intelligence,
  not as automatic hook execution.

## P0 Gates

### P0.1 Keep Archive Cleanup / Catalog Status Green

Purpose:

```text
Keep the active repo matched to the current story.
```

Status:

```text
completed as a baseline; keep verified
```

Acceptance:

- old top-20 archive is removed from active tree
- Redis points at `packages/bitnami/redis/25.5.3`
- `catalog-status.yaml` exists for all 100 recipes
- `npm run verify` passes
- `data/catalog-promotion-review/summary.md` reports:
  - `machine checks pass: 100`
  - `catalog-supported: 20`
  - `recipes with non-current executable fixture path: 0`

### P0.2 Make Chart -> Recipe -> Variant Obvious

Problem:

The current structure is mechanically coherent but hard to read. A new reader
does not immediately see:

```text
chart -> recipe -> variants -> revisions -> package bases -> receipts
```

Action:

Maintain generated per-chart maps:

```text
recipes/<repo>/<chart>/<version>/CATALOG.md
recipes/<repo>/<chart>/<version>/artifact-index.yaml
```

Acceptance:

- Every current recipe has a one-page artifact map.
- The map links:
  - source chart
  - recipe
  - variants
  - variant revisions
  - rendered object sets
  - package bases
  - scan/gate/equivalence receipts
  - catalog status
- A naive Helm user can answer: "which variant do I install, and what will it
  create?"

### P0.3 Decide What A "Best, Simplest, Safest" Recipe Means

Problem:

A recipe can be Helm-equivalent without being the best recommended path for a
Helm user.

Action:

Turn catalog promotion into a stricter product review:

```text
not harder than Helm
not riskier than Helm
not wrong compared with Helm
obvious variants are present
deferred variants are explicit
scan/gate warnings have a disposition
```

Acceptance:

- `docs/planning/catalog-promotion-review.md` has this checklist.
- `catalog-status.yaml` records:
  - supported variants
  - deferred variants
  - supported scopes
  - production readiness
  - warning disposition
- Redis passes this review for local-test scope.

### P0.4 Use More Of Real `cub installer`

Problem:

The proof must not leave Helm pain in prose when a real installer, `cub`, or
ConfigHub capability can carry it better. Current packages prove
`cub installer setup` against Helm output and now synchronize required Secret
target facts into installer packages, but the catalog must keep moving toward
executable capabilities instead of documentation-only notes.

Action:

For Redis and each promoted catalog candidate, review whether the package
should use:

```text
components
inputs
externalRequires
provides
clusterSingleton
transformers
validators
collector facts
preflight, when implemented
```

Use the capability when it exists, fits the chart behavior, and makes the
result simpler, safer, or more provable. If no suitable product capability
exists yet, mark the control point as a capability gap and link it to an issue
instead of pretending the docs solved it.

Acceptance:

- Redis has an installer-capability gap review.
- Redis has a `docs/demo/redis/confighub-proof-transcript.md` proof using current
  `cub installer doc/setup/render/package/vet/plan/upload`.
- The top-20 set has live ConfigHub proof receipts generated by
  `scripts/run-top20-confighub-proof.mjs` and verified by
  `scripts/verify-top20-confighub-proof.mjs`.
- Large-chart runs may use `--cleanup-spaces` because the Kubara demo org has
  a finite Link quota. This is not a proof shortcut: the runner still uploads
  to ConfigHub, creates the server-side variant, runs ConfigHub functions,
  records safe-ops behavior, writes receipts, and only then removes temporary
  spaces.
- Target facts are either:
  - represented as installer-native `externalRequires` / fact requirements, or
  - explicitly documented as proof-layer-only pending installer support.
- At least one promoted candidate uses installer-native inputs or components,
  not only bases.
- Documentation-only mitigations are allowed only when the matching product
  capability is missing, inferior, or would make the happy path harder.

### P0.5 Define Creator UX On Top Of `cub variant create`

Finding:

`cub variant create` now exists locally. It creates a downstream Space from a
reviewed source, clones Units, sets the downstream Space `Variant` label,
optionally sets environment/region/target metadata, copies selected triggers,
permissions, and gates, and preserves upstream Unit links.

Status:

```text
reverified locally on 2026-05-31
```

Evidence:

- local binary: `/usr/local/bin/cub`
- `cub variant create --help` describes the clone/link operation and flags such
  as `--environment`, `--region`, `--target`, `--variant-labels`,
  `--space-annotation`, `--unit-annotation`, and Unit gates

Recomputed meaning:

Variant creation is no longer hypothetical. The remaining work is product
porcelain over the current primitive: blueprint selection, required fill values,
preview, checks, receipts, and UX/AX/FX equivalence.

The next product contract for this lane is
[Variant Creation Artifact](../reference/variant-creation-artifact.md): a Variant Creator
contract over existing ConfigHub primitives. Earlier notes called this
formal shape `VariantCreationPlan`; treat that as the old working name, not as
a new backend engine.

The first worked promotion walkthrough is
[Variant Promotion Worked Example](../reference/variant-promotion-worked-example.md).

The mapping contract that connects Helm-derived bases to ConfigHub components,
spaces, variants, promotion edges, and code work is
[ConfigHub Promotion Mapping Doctrine](../reference/confighub-promotion-mapping.md).

The continuous testing doctrine for this lane is
[Variant Creator Artifact Verification](../reference/variant-creator-verification.md). It
defines the invariants, goldens, and verification gates that keep UX, AX, and
FX aligned as product, CLI/API, agent, and function surfaces are implemented.

UX/AX/FX target:

```text
UX: Creator with From -> Blueprint -> Target -> Fill -> Preview -> Checks -> Create.
Agent: structured create_variant task with required checks and receipts.
Function: create_variant(plan, row) -> ConfigHub variant + receipts.
```

Implementation boundary:

```text
`cub variant create` is available for clone/link.
Creator UX/AX/FX porcelain is not complete yet.
The operation should wire existing ConfigHub primitives together, not create a
new backend variant engine.
```

What still needs code:

| Surface | Work |
| --- | --- |
| CLI/API | Add porcelain and dry-run/check surfaces around existing primitives once the product contract is settled. |
| UX | Expose the user-led form through an existing or chosen product surface without assuming a separate GUI named Variant Creator. |
| UX | Ensure Helm-derived catalog bases appear in the existing component Promotion page by using `Component`, `Variant`, `Environment`, `Region`, target, and upstream-link conventions consistently. |
| API/server | Store or load the formal Variant Creator contract and expose enough metadata for product UX, CLI/API, agents, and functions to use the same plan. |
| AX/FX | Accept structured `create_variant` tasks and matrix inputs, then run the same checks and receipt expectations as the UX form. |
| Verification | Add invariants, goldens, and a `variant-creator:verify`-style command so each surface proves it follows the same creation plan and produces comparable receipts. |
| Catalog proof | Add generated mapping artifacts only if they are consumed by product code, a verifier, an agent workflow, or ConfigHub UI/CLI. |

The implementation should compose existing primitives:

```text
bulk clone
labels / annotations / targets
PostClone triggers
placeholders
TransformPaths links
functions / checks
gates
receipts / MutationSources
```

This keeps the system honest:

```text
Creator = the user-facing product flow
Variant Creator contract = the formal machine-readable contract underneath
Blueprint = a named creation pattern inside the contract
UX = foundational user-led expression
AX = agent-based expression
FX = function-based expression over one row or many rows
```

Continuous proof target:

```text
same creation plan
same inputs
same preview
same checks
same receipts
across UX, AX, and FX
```

Example first-use path:

```text
Redis/default -> dev
Redis/default -> EU production
Redis/default -> customer-acme
```

It is an expected part of the workflow when it is the simpler path. It does not
replace Helm-derived recipe variants for changes that require a different Helm
render, but it should be preferred for downstream operational variation when a
reviewed ConfigHub space can be cloned safely.

The model is now:

```text
Helm chart version
  -> recipe
  -> install variants / package bases
  -> rendered variant revisions
  -> ConfigHub spaces and units
  -> cub variant create plus Creator contract for downstream variants when useful
```

Decision rule:

```text
Use recipe/package variants for render-time choices:
  CRDs on/off, generated Secret vs existing Secret, HA mode, storage mode,
  ingress/TLS shape, cloud-specific values, or anything that changes the
  Kubernetes object set.

Use ConfigHub variant creation for server-side choices:
  staging/prod clone, region clone, target binding, space metadata, gates,
  policy labels, post-clone trigger inputs, or other changes that can be made
  after a reviewed rendered revision has become ConfigHub units.
```

Acceptance:

- Keep chart-import variants in `helm-expt` as recipe/package-base variants.
- Use `cub variant create` plus the Creator contract when the upstream
  ConfigHub space exists and server-side cloning is the easiest safe path.
- Redis and proof lanes should include simple server-side clone evidence from
  reviewed uploaded spaces to staging spaces once the operation is available.
- The top-20 receipts verify this with
  `npm run top20:verify-confighub-proof`.
- Catalog maps should continue linking pre-publish recipe variants separately
  from post-upload ConfigHub server variants.

### P0.5b Support Values, Kustomize, Wrapper, And Customer Overlays Deliberately

Problem:

Helm users customize with values files, `--set`, wrapper charts, umbrella
charts, Kustomize overlays, customer overlays, and private platform defaults.
If the docs only say "variants", readers will not know which route is safe.

Decision:

```text
values/wrapper/Kustomize/custom overlay changes rendered objects
  -> cub installer recipe/base

post-render target/metadata/links/gates/fill-values
  -> ConfigHub variant via cub variant create plus Creator contract
```

Acceptance:

- README explains the rule in plain English.
- [Customization Algorithm](../reference/customization-algorithm.md) lists supported overlay
  modes and proof requirements.
- [Kubara Customized Overlay Analysis](../corpus/kubara-customized-overlays.md) defines
  the first managed overlay golden and its tier.
- [Product Support Tiers For Helm Scenarios](../user/product-support-tiers.md) states
  which scenarios are public proof, ConfigHub managed variants, managed overlay
  import, and enterprise/fleet work.

### P0.6 Recalculate The Top-500 Matrix In The New Shape

Problem:

The old matrix is source-feature reconnaissance. It is not proof.

Action:

Build new outputs under:

```text
data/top500-catalog-analysis/
  raw.json
  review.csv
  drilldown.csv
  summary.md
```

Status:

```text
completed as generated catalog-analysis output
```

Acceptance:

- rows trace to current artifacts where they exist
- rows distinguish:
  - no recipe yet
  - proof-grade
  - catalog-candidate
  - catalog-supported
  - blocked
- front sheet has no intimidating 60-column wall
- drill-down has all control-point evidence
- top-500 output can answer:

```text
What is proved?
What is recommended?
What remains risky or unreviewed?
```

Verification:

```text
npm run top500:catalog:verify
```

The generated matrix currently shows 100 current proof recipes in the repo, 91
matched to the old top-500 source rows, 20 catalog-supported for local-test
scope, 71 proof-grade/default rows that need user-shaped variants, and 409
rows that remain source reconnaissance only.

### P0.7 Select The Next Real-Variant Promotion Wave

Problem:

The 80 generated default proofs are valuable but not enough to persuade a Helm
user that this is the best, simplest, safest install path. The next wave must
add real variants for charts where the variants are obvious user choices.

Action:

Maintain generated outputs under:

```text
data/catalog-promotion-wave2/
  candidates.yaml
  review.csv
  summary.md
```

Status:

```text
started with five proof-grade/default charts selected
```

Selected charts:

```text
traefik/traefik
external-dns/external-dns
vmware-tanzu/velero
istio-official/istiod
kyverno/kyverno
```

Acceptance:

- each selected chart is proof-grade and exact-version matched in the top-500
  catalog analysis
- each selected chart is default-only today, so the next work is genuine
  variant promotion
- each proposed variant must become a real recipe variant, package base,
  rendered revision, scan/gate receipt, and Helm-equivalence receipt before
  catalog support is claimed

Verification:

```text
npm run catalog:wave2:verify
```

## P1 Execution

### P1.1 Promote The Top-20 Catalog Candidates

Status:

```text
complete for local-test scope
```

The top-20 bespoke charts now have explicit `catalog-supported` status for
local-test scope. This includes the first five promoted after Redis:

```text
bitnami/nginx
bitnami/postgresql
metrics-server/metrics-server
ingress-nginx/ingress-nginx
jetstack/cert-manager
```

Why:

- Nginx proves simple happy path.
- PostgreSQL proves stateful install concerns.
- Metrics Server proves APIService and target-fact shape.
- Ingress Nginx proves hooks, webhooks, RBAC, and an obvious variant.
- Cert Manager proves CRDs and webhook lifecycle.

Acceptance per chart:

- artifact map exists
- catalog promotion review completed
- `catalog-status.yaml` updated
- supported variants and deferred variants are explicit
- Helm-vs-`cub installer` comparison passes
- scan/gate warnings have production or local-test disposition

Production support is still blocked for these recipes until scan, gate, and
operating-policy findings have explicit dispositions.

### P1.2 Generate Per-Chart Weirdness And Mitigations

Problem:

Helm pain is hidden unless each chart has a readable operating note.

Action:

Generate or maintain:

```text
recipes/<repo>/<chart>/<version>/weirdness-and-mitigations.md
```

Acceptance:

- every catalog-supported or catalog-candidate chart has the note
- note covers:
  - hooks
  - CRDs
  - webhooks
  - lookup
  - generated secrets/certs
  - required values
  - raw/tpl extension slots
  - RBAC
  - stateful storage
  - upgrade/rollback concerns

### P1.3 Improve Target Facts

Current state:

Target facts are now synchronized into executable installer packages for every
current chart variant that declares `targetFacts`.

Implemented invariant:

```text
recipe variant targetFacts.requiredSecrets
  -> matching installer package base externalRequires
  -> package collector records targetFacts into out/spec/facts.yaml
  -> installer package receipt records targetFactMode/targetFactsBound
  -> npm run installer:target-facts:verify runs cub installer setup and checks facts
```

Current coverage:

```text
10 charts
10 target-fact variants
all current target facts are required Secret facts
```

The 10 charts are Redis, MongoDB, MySQL, NGINX, PostgreSQL, RabbitMQ, Grafana,
Tempo, Consul, and Metrics Server.

Next action:

Extend the canonical mapping beyond required Secrets:

```text
existing CRD
API availability
namespace exists
storage class exists
ingress class exists
runtime class exists
```

Acceptance:

- top 10 target facts are documented
- required Secret target facts stay represented by installer
  `externalRequires` plus collector facts in every current package
- non-Secret target facts map to installer-native `externalRequires`,
  `provides`, `clusterSingleton`, collector facts, or explicit blocked status

### P1.4 Add Live E2E Confidence For Promoted Charts

Action:

For catalog-supported and near-supported charts, run disposable local kind tests:

```text
cub installer setup
kubectl apply / dry-run / server-side validation where reasonable
observation receipt
cleanup
```

Acceptance:

- Redis stays green
- next promoted charts have live or dry-run evidence
- live evidence is clearly separated from machine proof

Current lane:

```text
data/production-disposition/
  top20.csv
  summary.md
```

Status:

```text
started
```

Current facts:

```text
20 catalog-supported local-test charts
20 passing ConfigHub proof receipt sets
20 live/e2e observed charts
20 target-scoped support decision artifacts
17 supported target-scoped decisions
2 superseded deprecated-source decisions
1 rejected production boundary
0 draft support decisions
20 production-review-ready disposition rows
0 production-blocked pending disposition rows
```

Verification:

```text
npm run production:disposition:verify
```

### P1.5 Old-Version Patch Lane

Action:

Start with Redis old versions and prove the paid patch shape:

```text
old version source lock
old version recipe
patch diff
scan/gate result
upgrade receipt
rollback receipt
support window
```

Acceptance:

- first Redis old-version patch scenario exists
- generated `data/legacy-patch-review/` identifies selected versions
- paid feature can be discussed without exposing private customer data

### P1.6 Add Review And Diff Demo

Status:

```text
complete for the Redis baseline; repeat or deepen for future catalog-supported charts
```

Action:

Use existing ConfigHub review verbs against the Redis proof spaces:

```text
cub unit tree
cub unit data
cub revision list
cub revision data
cub unit diff
```

Acceptance:

- Redis demo shows the exact uploaded Unit tree.
- At least one Unit's config data is shown from ConfigHub, not just from local
  files.
- Revision history is visible.
- A change or variant difference is shown with `cub unit diff`.
- Current Redis evidence lives in `docs/demo/redis/confighub-proof-transcript.md`.

### P1.7 Add Safe Operation Lane

Status:

```text
complete for the top-20 ConfigHub proof receipt set; repeat with a target-backed
local-kind lane before claiming live deploy proof
```

Action:

Use existing safe-operation verbs in local/test scope:

```text
cub changeset create/list/update
cub unit approve
cub unit apply
cub unit cancel
```

Acceptance:

- Local/test apply path is explicit and separate from production readiness.
- Approval and apply intent are recorded.
- Gated or unsafe operations are shown as blocked/cancelled rather than
  silently skipped.
- Current Redis evidence lives in:
  - `docs/demo/redis/safe-ops-lane.md`
  - `runs/redis-confighub-proof/latest/safe-ops-receipt.yaml`
- Current NGINX evidence lives in:
  - `docs/demo/nginx/confighub-proof-transcript.md`
  - `runs/nginx-confighub-proof/latest/safe-ops-receipt.yaml`
- Current Metrics Server evidence lives in:
  - `docs/demo/metrics-server/confighub-proof-transcript.md`
  - `runs/metrics-server-confighub-proof/latest/safe-ops-receipt.yaml`
- Current PostgreSQL evidence lives in:
  - `docs/demo/postgresql/confighub-proof-transcript.md`
  - `runs/postgresql-confighub-proof/latest/safe-ops-receipt.yaml`
- Current Ingress NGINX evidence lives in:
  - `docs/demo/ingress-nginx/confighub-proof-transcript.md`
  - `runs/ingress-nginx-confighub-proof/latest/safe-ops-receipt.yaml`
- Current cert-manager evidence lives in:
  - `docs/demo/cert-manager/confighub-proof-transcript.md`
  - `runs/cert-manager-confighub-proof/latest/safe-ops-receipt.yaml`
- The complete top-20 receipt set is verified by
  `npm run top20:verify-confighub-proof`.

### P1.8 Add ConfigHub Function Scan Lane

Status:

```text
complete for the top-20 ConfigHub proof receipt set; expand to future promoted
charts
```

Action:

Use existing function verbs to run misconfiguration checks against rendered
objects or uploaded Units:

```text
cub function vet
cub function get
cub function set
cub run vet-...
```

Acceptance:

- Every top-20 supported local-test chart has a ConfigHub function-based scan
  receipt.
- Scan/gate results are bound to the rendered object set or Unit revision.
- This lane coexists with external scanners such as Trivy/Snyk/kube-linter.
- Current Redis evidence binds 14 uploaded Redis Unit heads and DataHashes to
  passing `vet-format`, `vet-placeholders`, and `vet-merge-keys` results:
  - `docs/demo/redis/function-scan-lane.md`
  - `runs/redis-confighub-proof/latest/function-scan-receipt.yaml`
- Current NGINX evidence binds 6 uploaded NGINX Unit heads and DataHashes to
  passing `vet-format`, `vet-placeholders`, and `vet-merge-keys` results:
  - `docs/demo/nginx/confighub-proof-transcript.md`
  - `runs/nginx-confighub-proof/latest/function-scan-receipt.yaml`
- Current Metrics Server evidence binds 10 uploaded Metrics Server Unit heads
  and DataHashes to passing `vet-format`, `vet-placeholders`, and
  `vet-merge-keys` results:
  - `docs/demo/metrics-server/confighub-proof-transcript.md`
  - `runs/metrics-server-confighub-proof/latest/function-scan-receipt.yaml`
- Current PostgreSQL evidence binds 7 uploaded PostgreSQL Unit heads and
  DataHashes to passing `vet-format`, `vet-placeholders`, and
  `vet-merge-keys` results:
  - `docs/demo/postgresql/confighub-proof-transcript.md`
  - `runs/postgresql-confighub-proof/latest/function-scan-receipt.yaml`
- Current Ingress NGINX evidence binds uploaded Ingress NGINX Unit heads and
  DataHashes to passing `vet-format`, `vet-placeholders`, and
  `vet-merge-keys` results:
  - `docs/demo/ingress-nginx/confighub-proof-transcript.md`
  - `runs/ingress-nginx-confighub-proof/latest/function-scan-receipt.yaml`
- Current cert-manager evidence binds uploaded cert-manager Unit heads and
  DataHashes to passing `vet-format`, `vet-placeholders`, and
  `vet-merge-keys` results:
  - `docs/demo/cert-manager/confighub-proof-transcript.md`
  - `runs/cert-manager-confighub-proof/latest/function-scan-receipt.yaml`
- The complete top-20 receipt set is verified by
  `npm run top20:verify-confighub-proof`.

### P1.9 Add Catalog Metadata And Views

Action:

Use existing metadata verbs to make the catalog searchable and explainable:

```text
cub tag
cub attribute
cub filter
cub view
cub link
```

Acceptance:

- Standard labels/tags cover chart, recipe, variant, target, risk, support
  status, and proof tier.
- Catalog views can answer:

```text
Which Redis variants are supported?
Which charts require target facts?
Which charts are catalog candidates but not supported?
Which units depend on a Secret, CRD, or target?
```

## P2 / Side Projects

### P2.1 Paid Private Chart Diagnostics

Shape:

```text
private chart intake
AI-assisted Helm pain report
recipe and variant suggestions
misconfig scan
patch/upgrade recommendations
```

Keep this out of public proof outputs unless sanitized.

### P2.2 AI-Assisted Recipe Maintenance

Shape:

```text
new upstream chart version detected
render old variants against new chart
classify conflicts
suggest variant updates
produce review packet
```

This supports paid maintenance SLAs.

### P2.3 Pilot / Adversarial Runs

Use Pilot for adversarial validation after the core proof shape is stable.

Acceptance:

- Pilot attacks current claims
- reports are written under `runs/pilot/`
- Pilot does not become part of the happy path

### P2.4 Public Catalog UX

Shape:

```text
small public catalog page
one line per chart
status, variants, proof, install command, known caveats
```

Do this after the first few catalog promotions, not before.

### P2.5 GitOps Adoption Proof

Action:

Use existing GitOps verbs as a compatibility lane:

```text
cub gitops discover
cub gitops import
```

Acceptance:

- Demonstrates discovery/import for an Argo CD or Flux estate.
- Keeps GitOps adoption separate from the Helm-derived installer package path.
- Explains how ConfigHub OCI/published artifacts can fit existing delivery
  tools without claiming ConfigHub replaces Argo or Flux.

## Operating Rule

For each task:

```text
write the acceptance check first
make the change
run the check
only then start the next task
```

This matters because the project is otherwise prone to accumulating impressive
artifacts that do not prove the user-facing claim.

## Immediate Next Three Moves

1. Pick 3-5 proof-grade charts from the generated/default set and add
   user-shaped variants.
2. Generate per-chart weirdness-and-mitigations notes for every supported
   chart.
3. Start the new top-500 catalog-analysis output shape.
