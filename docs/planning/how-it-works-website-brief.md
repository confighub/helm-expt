# Website brief: the "How it works" section (for Codex)

**UNOFFICIAL/EXPERIMENTAL.** Content + structure brief for the public site's *How it works*
section. The source of truth is the user-facing hub [docs/user/how-it-works.md](../user/how-it-works.md);
this brief tells the site builder **what to surface, in what order, with what honesty rails**.
Don't invent claims — every site assertion must trace to a linked doc or generated data.

## The spine — four moves

Lead the site with the same mental model the hub uses, in this order. Each is one screen /
section: a one-line claim, a short plain-English explainer, one visual, and a "go deeper" link.

| # | Move | One-line claim (site copy) | Honest caveat to keep visible | Backed by |
| --- | --- | --- | --- | --- |
| 1 | **Render** | "Your chart becomes the *exact* same Kubernetes objects — proven object-for-object." | Parity proves the *recipe*, not that it's live-ready. | render-parity lane; `direct-cub-helm-model`, `reading-the-matrix` |
| 2 | **Route** | "Anything Helm would run *for* you — hooks, CRD installs — becomes an explicit, named step you can see and approve." | `automatic: false` everywhere (0 of 25 route-actions are automatic). Nothing runs silently. | `chart-hooks-what-happens`, `pathway-route-hooks-transparently`, `tests/doctrine.md`, `data/lifecycle-route-actions/` |
| 3 | **Deliver** | "Published once to OCI; Argo, Flux, or kubectl all pull the *same* bundle — your choice of tool." | Argo-from-OCI is proven; Flux + cub-direct are in progress (don't show as done). | `cub-deployment-path`; G/P live-parity receipts |
| 4 | **Observe** | "Proven live, with receipts — and we tell you the honest disposition, never just 'green'." | `watch ≠ pass`; show the real lane mix, not a green wall. | `verification-lanes`, `what-we-refuse-to-claim`, `tests/README.md` |

## Cross-cutting sections (secondary nav)

- **Customize + promote** — variants, overlays, fleet promotion. (`creating-variants`, `derived-variant-walkthrough`, `custom-overlays`)
- **Day-1** — preview / dry-run / drift before you apply. (`cub-scout-diff-design`, `why-synced-is-not-working`)
- **Day-2** — upgrade / rollback / maintenance. (`helm-upgrade-crash-example`, `maintenance-sla`)
- **Secrets + credentials** — delivery creds (copied, never printed) vs app secrets. (`cub-deployment-path`, `target-prerequisites`)
- **Why this exists / why it holds** — the thesis + the hard cases. (`why-this-exists`, `generative-gitops-fit`, `why-this-does-not-collapse`)
- **Free vs managed** — where ConfigHub Server begins. (`offering`, `what-you-get`)

## Honesty rails (must carry to the site — non-negotiable)

1. **Never silent.** Every routed step is shown; no "we run it for you" without `automatic: false` + a receipt.
2. **Verified disposition, not green.** Show the real mix (pass / watch / blocked / refused / n-a); never a fake all-green.
3. **Proven vs in progress.** Mark Argo-OCI proven; Flux-OCI + cub-direct as "coming," not done. Mark `cub-scout object-set --dry-from` as forthcoming (only `three-way --dry-from` is shipped).
4. **Refusals are a feature.** Surface `what-we-refuse-to-claim` — it's a trust asset, not fine print.

## Suggested visuals (Codex to build)

- A **four-move flow** (render → route → deliver → observe) as the hero.
- A **"visible vs. silent" hook table** — reuse `data/hook-test-proof/visible-vs-silent.html` (already self-contained, colored).
- A **one-OCI-bundle / three-consumers** diagram (Argo / Flux / kubectl pulling the same artifact).
- The **honest disposition mix** as a small stacked bar (not a green checkmark wall).

## Content gaps — now filled (surface these prominently)

All four now exist as user docs, are linked from the [hub](../user/how-it-works.md), and are
already recapitulated on the site: 6 entries in the Docs/Guides list (`guideRows`) and a new
"How It Works" FAQ section (`faqSections`). Give them prominent placement:
1. **The data model** — [confighub-data-model.md](../user/confighub-data-model.md) (Unit / space / target / worker / OCI / target fact / route / receipt).
2. **Day-2: upgrade + rollback** — [day2-upgrade-rollback.md](../user/day2-upgrade-rollback.md).
3. **Security end to end** — [security-end-to-end.md](../user/security-end-to-end.md) (the "no silent privileged step" story).
4. **GitOps adopter guide** — [gitops-adopter-guide.md](../user/gitops-adopter-guide.md) (Argo/Flux from one OCI bundle).

Plus the spine docs: [how-it-works.md](../user/how-it-works.md) (hub) and
[cub-deployment-path.md](../user/cub-deployment-path.md).
