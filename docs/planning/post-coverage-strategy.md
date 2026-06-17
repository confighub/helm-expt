# Post-Coverage Strategy: User Journeys, Open Issues, and Roadmap

**UNOFFICIAL/EXPERIMENTAL.** Synthesis of a multi-agent research pass (user
journeys incl. serverless + ConfigHub-server + cub-scout; the open-issue backlog;
the roadmap/commercial planning corpus; and the external competitive landscape),
cross-mapped against the live coverage data. It answers: *once the matrix reaches
100% verified disposition, what is the sequenced plan to "really nail" journeys,
issues, and roadmap?* Grounded in `docs/planning/*`, `docs/user/*`, the GitHub
backlog, `data/*` coverage surfaces, and cited external sources.

---

## 1. The thesis and the wedge

**The white space is real.** No one publishes a *public, cross-chart,
pre-deployment* catalog that answers "does this Helm chart install **and
converge** on a real cluster, with what caveats, and what is the remediation when
it fails":
- **Artifact Hub** verifies *ownership*, not function ("Verified Publisher" ≠ "it
  installs").
- **Red Hat chart-verifier** runs real install tests but is OpenShift/ISV-scoped.
- **Flux HelmRelease** tracks convergence + remediation, but *per running instance,
  reactively and privately* — not a shared catalog.
- **Kargo / Codefresh GitOps** promote artifacts across stages by *re-rendering*;
  config is regenerated each stage, not stored.
- **Chkk** is a cluster-scan *upgrade* copilot, not a pre-deployment catalog.

The second wedge: **variant promotion as config data** — render once → Config
Units → clone into Variants → promote the variant as a first-class data entity,
with the base upgradeable without overwriting variant deltas. Kargo/Codefresh
can't do this (they re-render per stage); it is architecturally ConfigHub's.

**Urgency:** the **Bitnami → `bitnamilegacy` collapse (Aug–Sep 2025)** deleted the
pinned images behind hundreds of popular charts, leaving a community-wide
`ImagePullBackOff` and a trust vacuum with no canonical replacement. That is
exactly the gap an honest disposition+remediation catalog fills — and it is why
the image-remediation work already in this repo matters commercially.

**Biggest self-risk:** the database-not-Git model fights GitOps network effects;
teams invested in "everything-in-Git" must be met where they are (OCI/Git handoff,
keep Argo/Flux as the controller).

Sources: confighub.com, docs.confighub.com; artifacthub.io; fluxcd.io;
kargo.io / akuity.io; chkk.io; chainguard.dev Bitnami migration guide;
ITNEXT "Multi-Environment Helm: Variants with ConfigHub" (Dec 2025).

---

## 2. The user journey (and exactly where it breaks)

Five stages (from `docs/user/*` + `site/journey.html`):

| Stage | What the user does | Proven | Rough edge |
| --- | --- | --- | --- |
| 0 Inspect (no cluster) | browse catalog HTML + `cub helm template` | yes | template path has no maintained proof/scan |
| 1 Serverless try (cluster to apply) | `cub installer setup --pull packages/... ` → `kubectl apply` → `npm run …:verify-install:render` | Redis/sealed-secrets happy paths, real transcripts | **must clone a ~5000-file repo + know vendor/chart/version** (breaks "as fast as helm"); `--namespace` doesn't relocate objects (**#96**); no in-cluster receipt |
| 2 ConfigHub account (free) | `cub auth login` → `cub installer upload` → Units | upload works, tutorial-tested | the journey page shows **`cub installer import helm` which does not exist** (#23); upload needs ~12 flags |
| 3 Server / derived variants | `cub variant create` / `promote`, diff, vet, changeset | `cub variant create`/`promote` are real, receipted | Creator UX is *proposal-only*; promotion capped by **#682** |
| 4 Day-2 / GitOps | OCI + Argo via `cub lk up` | OCI/Argo path real, receipted | heavy infra prereq; **#714** silent progress on large ops |
| 5 Promote / operate / fleet | target-bound variants, cub-scout observation, fleet queries | selected receipts exist | paid surfaces (`cub observe`, fleet) largely planned |

**Serverless entry points** — what works with **no ConfigHub server**: catalog
browse, `cub helm template`, `cub installer setup --pull`, `…verify-install:render`,
local kind lanes, `kubectl apply`, **`cub-scout receipt verify`**. The server is
required from `cub installer upload` onward (Units, variants, promotion, OCI). The
designed serverless add-on (resolve → OCI pull → cosign verify → collect target
facts → apply → **write in-cluster receipt** → observe with cub-scout) exists on
paper (`serverless-verified-install-plan.md`) but the OCI name-resolution and the
in-cluster receipt are **not built** — which is why Stage 1 still needs the repo
clone.

**cub-scout** is the standalone live-cluster witness (`object-set-matches` /
`prerequisites-met` / `workloads-converged`, closed-world `--no-extras`, three-way
compare, `gitops status`). It is the "what is actually going on?" tool. Its
highest-value moment is **right after apply, when k8s says "created" but nothing
works** (`why-synced-is-not-working.md`). Gap: it's documented as a *side* tool,
invisible at the moment of confusion. Fix: make the three cub-scout predicates the
**standard post-apply step** in `try-now` / `first-run-walkthrough`, and the
post-sync step in the GitOps path (Argo "Synced/Healthy" while the workload is
broken). The user explicitly endorses using cub-scout (and peers) for user
understanding.

**Top journey gaps, ranked:** (1) `import helm` doesn't exist + 5000-file-clone
friction (#23) — the conversion surface shows an unrunnable command; (2) namespace
non-relocation (#96); (3) no in-cluster receipt (no anchor for upgrade/rollback/
drift); (4) cub-scout absent from onboarding; (5) upload flag verbosity; (6) #714
progress; (7) #682 promotion lands watch not green; (8) Stage-3 Argo infra jump.

---

## 3. The coverage substrate **is** the product data layer

100% coverage is not separate from the strategy — it is the dataset the product
runs on. `per-chart-fact-sheet-spec.md` maps each residue surface to a chart-page
field:

- identity → `source-lock`; support claim → `catalog-tier` + `production-decisions`;
- evidence depth → the lane matrix (`master-catalog-matrix`); variants →
  `base-readiness`;
- **quirks/dispositions → `lifecycle-routes`** (honest headline: 0/25 routes safe
  to auto-run today);
- **mitigations → `helm-pain` + the residue cards** (model-gap-fix, image-remediation,
  target-prerequisite-actions);
- **prerequisites → `target-prerequisite-workdown`**; **skills → `chart-skills`**
  (100/110 charts have a skill — the "is there a skill for this chart?" front door);
- try-it → `chart-use-guide`.

So the model-gap / image-remediation / target-prereq cards already built **are**
the "what you must do / here's the remediation" lane of #949; `coverage-completion-plan`
is the punch-list that backs "the top-100 matrix is complete."

---

## 4. Open-issue map (4 clusters)

**A — ConfigHub-server reliability (caps green claims).** **#682** changeset
promote HTTP 500 (caps the *entire* promotion lane to watch — the single
highest-leverage server fix; blocks **#948**); **#645** unit-create HTTP 500 (caps
3 charts' C-lane + raises a bulk-create reliability question — same family as the
**Unit quota** that forces serial promotion); **#156** variant-create placeholder
drift (undermines `cub variant create` correctness).

**B — Per-chart modeling tail (the 100% finish).** ~13 well-scoped, no-cross-dep,
~1–2h each, **each already has a card I generated**: #861 NATS renderDelta, #856
NACK CRD ownership, #842 cluster-autoscaler clusterName, #841 argo-workflows CRD,
#867 Percona PG CRD, #865 NATS Surveyor endpoint, #863 Jaeger cert-manager CRDs,
#878 prom-adapter APIService v1beta1 (fix path already proven by a sibling base),
#880 apache removed image, #774 Fluentd CRB namespace, #156 Grafana; plus #114
(template-baked CRDs, 5 charts) and #113 (secret-toggle, 12 charts — needs a
capability decision).

**C — UX / legibility / new surfaces.** #753 (make the burn-down legible), #714
(progress evidence), #679 (sharp-edges punch-list), #671 (skills), **#148**
(policy/compliance/security posture reports — *new* surface), **#149** (dependency
graph + impact analysis — *new* surface), #882 (runner hang after Helm crash-loop).

**D — Productization / commercial.** #948 (P0 promotion proof, blocked by #682),
#949 (productize remediation/lifecycle/commercial), #23 (serverless low-friction +
signed catalog index), #150–#153 (promotion UX/semantics/Creator/GitOps-tutorial),
#106 (variant expansion: 70 variants across 60 charts), #99 (image digest pinning).

**Dependency chain:** `#682 → #948 → #949/Pilot`; `#645 → C-lane completion`;
`#96 → first-run correctness + #774`; `#99 → #880/#838`; `#23 → serverless tier`.
The Cluster-B tail + Cluster-C legibility items are independent and parallelizable.

---

## 5. The sequenced roadmap (post-100%)

**Phase A — Finish & lock coverage** (mostly mine, parallelizable):
clear the ~13-issue modeling tail (cards exist) → run the promotion burn-down
serially (todo→watch) and **escalate #682** (the only route to green) → record the
verified-watch + lifecycle-n/a tail (Codex matrix-record). Output: 100% verified
disposition + an honest "what's watch/blocked and why."

**Phase B — Legibility & trust** (land it for a skeptic):
build the **per-chart fact sheets + public site** (matrix/residue → chart pages,
`dedicated-website-plan`) → close **#753** + put **cub-scout in the onboarding
path** + work the **#679** punch-list → stand up the sceptic apparatus (claims
register, fix the 4 failing blast-radius cases, torture suite) and **run external
reproduction** (`outside-user-test`, the single biggest trust gap).

**Phase C — Productize** (the commercial wedge):
the **serverless low-friction path** (#23: signed OCI catalog index → no clone,
in-cluster receipt) → **skills** (#671) + the **remediation intelligence** (#949,
mostly already built as residue cards) → **fix #682** → promotion goes green → the
headline "promote your Helm variants" claim becomes true → new surfaces #148
(compliance posture) and #149 (dependency graph).

**Phase D — Commercial:**
verified-install + support tiers (`verified-install-commercial-model`,
`product-support-tiers`) — but **signing infrastructure first** (key ceremony +
transparency log; selling a security claim without it is the security-theater
risk) → private catalog + remediation/patch SLA + config lifecycle intelligence.

---

## 6. Risks (the honest ones)

1. **Signing infra not in place** before security claims (cosign exists, no key
   ceremony / rekor) — security-theater headline risk.
2. **Lifecycle proof is the weakest + most-probed link** — 0/25 routes safe to
   auto-run; "CRD upgrade is a per-chart decision, not a mechanism."
3. **Blast-radius accuracy** — 4/13 cases fail (whole-release identity paths); one
   public wrong prediction damages the edges story.
4. **Single-party verification** — external reproduction (T6) has not run.
5. **Refresh SLA unproven at top-100 scale** — the abandonment/Bitnami argument.
6. **Missing product verbs** (`import helm`, `variant list/diff`, `catalog search`)
   — gap between the planned UX and the current substrate.
7. **The website / first-user experience is not built** — the "<2 min to pick the
   right Redis variant" launch gate isn't testable yet.
8. **Incumbents closing the gap** — Akuity/Kargo adding chart-health, a Flux public
   health feed, Artifact Hub install-test badges, Chkk moving pre-deployment,
   Chainguard becoming the post-Bitnami trusted catalog.

---

## 7. "Really nail it" — concrete next steps

1. **Per-chart legibility surface** (the next deliverable): a generated
   "can I use this chart, and how?" view per chart from the matrix + residue cards
   + chart-skills — closes #753, feeds #949 fact sheets, surfaces cub-scout as the
   post-apply check. This is the bridge from coverage data to the public site.
2. **Clear the modeling-tail quick-wins** (~13 × 1–2h; cards already written) —
   finishes Phase A coverage.
3. **Escalate #682** to the ConfigHub server team — the one bug capping the
   headline promotion claim (everything else in promotion already works via the
   no-changeset fallback).
4. **Run the external-reproduction test** (`outside-user-test`) — the single
   biggest trust gap; nothing internal can substitute.
5. **Build the signed OCI catalog index** (#23) — unlocks the honest "faster than
   Helm" serverless pitch (no repo clone) and the free-public tier.
