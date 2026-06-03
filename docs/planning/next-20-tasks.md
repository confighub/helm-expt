# Next 20 tasks — Helm catalog (distilled queue)

**Created:** 2026-06-02. A prioritized **top-20 queue distilled from the detailed plans** —
`next-execution-plan.md` (P0/P1/P2 gates), `agreed-execution-plan.md` (doctrine), `issue-backlog.md`
(GitHub issues), `catalog-promotion-next-candidates.md` (wave-2), and the `next80` / production-disposition
data. It does not replace them; it is the executive work queue over them.

## Where we actually are (so the queue is honest)
- 100 proof-grade recipes + packages; **20 top charts catalog-supported (local-test)** with bespoke variants;
  80 generated proofs (`next80`); 20/20 local-kind e2e + ConfigHub proof receipts; top-500 analysis done.
- `npm run verify` is green. The former #124 package-equivalence failures were fixed by regenerating packages
  without the post-render namespace transformer while preserving target-facts collectors.
- 100/100 charts are supported at Level 2; 54/100 are variant-rich. The remaining catalog work is user-shaped
  variants, production dispositions, and runtime/GitOps evidence, not basic proof creation.
- Current chart facts show 26 hard gaps for recommended extra capabilities: 15 existing-secret gaps (#113), 4
  template-CRD/no-crds gaps (#114), 6 curated-variant lanes, and 1 other gap.
- **0 production-supported** (20 production-blocked pending disposition). Open **P0 #76** (Helm import path).
- So the next 20 are about **depth (local-test → production), real variants, day-2, and adoption** —
  not building the catalog from scratch (that breadth largely exists).

## Now — the plan's immediate moves + the open P0
1. **Wave-2 real-variant promotion** — add user-shaped variants to the 5 selected proof-grade charts
   (traefik, external-dns, velero, istiod, kyverno): real recipe variant + package base + rendered revision +
   scan/gate + Helm-equivalence receipt each. *(P0.7)*
2. **Per-chart weirdness-and-mitigations notes** for every catalog-supported chart (hooks, CRDs, webhooks,
   lookup, generated secrets, required values, RBAC, stateful storage, upgrade/rollback). *(P1.2)*
3. **Close open P0 #76** — define + prove the Helm import path from `cub helm install` to durable
   `cub installer` recipes. The current import contract should cover public charts, wrapper charts,
   platform values, customer overlays, dependency closure, and render context.

## Next — take the top-20 from local-test toward production
4. **Production disposition for the top-20** — give every scan/gate/operating-policy finding an explicit
   disposition; move charts from `catalog-supported (local-test)` toward `production-supported`.
   *(P1.4; today 0/20 production-supported)*
5. **Target facts beyond required Secrets** — map existing-CRD, API availability, namespace, storage class,
   ingress class, runtime class to installer-native `externalRequires`/`provides`/`clusterSingleton`/collector
   facts. *(P1.3; today 10 charts, Secret-only)*
6. **Reconcile catalog-model vocabulary** — the docs added this session (`catalog-doctrine` / `fork-vocabulary` /
   `per-chart-recipes`, PR #100/#102) say "**fork**" for render-time shapes, while the canonical model
   (`agreed-execution-plan`) says "**Variant**". Unify to one vocabulary (fork ≡ render-time Variant;
   fill ≡ ConfigHub server-side variant) so the catalog reads consistently end to end.

## Variant lifecycle + day-2
7. **Creator porcelain over `cub variant create`** — blueprint → fill → preview → checks → create; the same
   plan across UX/AX/FX with goldens + verification. *(P0.5)*
8. **Old-version patch lane** — Redis old versions → patch diff + scan/gate + upgrade + rollback receipts
   (the paid patch shape). *(P1.5)*
9. **Day-2 upgrade/rollback propagation** — base/chart update → affected variants, conflict classification,
   scoped rollback by variant revision + target. *(extends #30)*
10. **Catalog metadata + views** — tags/attributes/filters/views/links so the catalog is searchable by chart,
    recipe, variant, target, risk, and support status. *(P1.9)*

## Breadth + honesty
11. **Promote high-value `next80` charts** from default-only → user-shaped variants (same bar as wave-2,
    applied to the 80 generated proofs). Prioritize the 46 default-only charts and the five selected wave-2
    charts before broadening the campaign.
12. **Hook lifecycle lane** — turn the 54 hook-using charts' scan into per-chart dispositions; production gate
    for hook charts; one safe Argo/GitOps lifecycle-translation proof. *(hook-lifecycle-strategy.md)*
13. **Image digest resolution (F2)** — pin mutable tags (e.g. bitnami `:latest`) to digests with a receipt,
    or gate. *(campaign finding F2 + agreed-plan watchlist)*
14. **Low-friction standalone try (Tier 0)** — public signed / OCI artifact pullable into a user cluster
    without full signup (auth/rate-limited) + local verification receipt.

## Review + adoption surfaces (P1 issues)
15. **ConsequencePreview** for rendered variant revisions — effects, not YAML noise. *(#11)*
16. **GitOpsCompatibilityReport** (Argo/Flux, #12) + **CRDCompatibilityReport** for CRD-heavy charts. *(#13)*
17. **Diagnose existing Helm release state + upgrade footguns** (#15) + **suggested fixes** for common pain
    (#16) — the migration on-ramp for existing Helm users.
18. **CI/PR comment mode** for chart analysis results — adopt in existing review flows. *(#14)*

## Story + UX
19. **User-facing Helm pain table** (#82) + keep per-chart artifact maps current (P0.2) + README
    low-friction path.
20. **Dedicated catalog website** — one line per chart: status, variants, proof, install command, caveats.
    *(P2.4 + dedicated-website-plan.md)*

## Suggested order
"Now" (1–3) is the plan's stated immediate work plus the one open P0. "Next" (4–6) converts existing breadth
into production-credible depth. 7–10 build the variant lifecycle. 11–14 add breadth + honesty. 15–20 are the
adoption/story surfaces once the proof is production-credible.
