# Generated Public Site

This directory is generated from helm-expt catalog data.

```sh
npm run site:generate
npm run site:verify
```

Open `site/index.html` first for the public launch front door.
Open `site/how-it-works.html` to choose where reviewed configuration lives and how it reaches Kubernetes.
Open `site/deployment-reference.html` for the detailed source, render, route, variant, check, and delivery model.
Open `site/try.html` for the short Redis example.
Open `site/ask.html` to check a new configuration and keep its review record.
Open `site/promote.html` to compare current and proposed objects before staging or production.
Open `site/base-variant-records.json` for the Catalog source-and-intent index used by
the Check and Promote pages. Open `site/promotion-review.schema.json` for the
browser promotion record.
Open `site/testing.html` for working starting, managed, platform, and App examples.
Open `site/kubara.html` for the Kubara buyer story, six adoption steps, GUI path,
evidence status, and full technical references.
Open `site/confighub.html` to sign up, follow the official tutorial, or read the blog.
Open `site/entry-path-reference.html` for detailed Helm, AICR, OCI, and YAML commands.
Open `site/variants.html` for base variants, derived variants, and promotion entry points.
Open `site/journey.html` for Apps that use configuration already saved in ConfigHub.
Open `site/custom-apps.html` for deeper application examples with custom apps,
multi-chart stacks, and overlays.
Open `site/existing-apps.html` for adopting existing Helm, Argo, Flux,
rendered YAML, or live-cluster state without taking over too early.
Open `site/ai.html` to install the Config Workshop agent skill and use it for
Catalog questions, local configuration checks, promotion reviews, and source-format inspection.
Open `site/security.html` for security, provenance, Secrets, scans, and evidence limits.
Open `site/future.html` for roadmap and managed ideas that should not be
confused with shipped public evidence.
Open `site/operations.html` for Ops: scans, gates, delivery, observation, adoption,
upgrades, rollback, bulk patching, and fleet questions.
Open `site/day1-operations.html` only as a compatibility redirect to `site/operations.html`.
Open `site/docs.html` to find instructions for the step or problem in front of you.
Open `site/docs-reference.html` for the complete technical guide and evidence index.
Open `../docs/user/installer-oci-packages.md` for the catalog package OCI refs
that users pull with `cub installer setup --pull oci://...`.
cub installer is a released, open-source plugin for the cub CLI. cub installer setup pulls a catalog package and writes its Kubernetes files locally. It does not apply those files to a cluster; use kubectl, Argo CD, or Flux for delivery.
Open `site/verification.html` for npm proof commands, fresh versus committed
evidence, and render-record-route.
Open `site/d/data/helm-catalog-readmes/summary.html` for the website-rendered
README index for the live `helm-catalog` demo org.
Open `site/known-gaps.html` for current watch findings the project surfaces deliberately.
Open `site/hard-questions.html` for the FAQ: hooks, upgrades,
custom values, target prerequisites, false-green sync, and refusal boundaries.
Open `site/proof.html` only as a deep reference for proof lanes, sceptic tests,
and refusal boundaries.
Open `site/quirks.html` for the short guide to chart quirks such as hooks,
CRDs, webhooks, generated facts, lookups, storage, and RBAC.
Open `site/charts/index.html#actions` for hooks and actions, including hook
and lifecycle route dispositions. `site/hooks.html` only redirects there for
compatibility.
Open `site/private/index.html` for private catalogs, managed operations, and commercial boundaries.
Open `site/tiers.html` only as a compatibility redirect to `site/private/index.html`.
Open `site/offering.html` for the longer public offering page.
Open `docs/user/choose-your-path.md` for the direct render, one-shot upload,
public catalog, and ConfigHub operations route picker.
Open `site/charts/index.html` for the Component Catalog and all retained package-version pages.
Open `docs/user/production-support-decisions.md` for the plain-English
boundary between production-review-ready and production-supported.

Data source:

- `data/top100-catalog-analysis/raw.json`
- `data/top500-catalog-analysis/raw.json`
- `data/latest-top20-refresh/promotion-readiness.csv`
- `data/runtime-gitops/wave1.csv`
- `data/image-digest-workdown/all-subjects.csv`
- `data/next-ten-waves/gap-review-wave.csv`
- `data/status-dashboard/status.csv`
- `data/status-dashboard/active-proof-queue.csv`
- `data/app-readiness/summary.md`
- `data/preview-readiness/summary.md`
- `data/cub-scout-diff/summary.md`
- `data/outcome-evidence-contract/summary.md`
- `data/top20-base-readiness/base-readiness.csv`
- `data/extension-slots/extension-slots.csv`
- `data/top100-readiness/readiness.csv`
- `data/top100-user-readiness/readiness.csv`
- `data/top100-coverage/work-queue.csv`
- `data/useful-base-design-queue/summary.md`
- `data/top100-promotion-wave/wave.csv`
- `data/refresh-survival/refreshes.csv`
- `data/live-parity-rerun-plan/rerun-plan.csv`
- `data/production-disposition/top20.csv`
- `data/production-support-decisions/decisions.csv`
- `data/hard-chart-production-packets/summary.md`
- `data/high-fanout-demo/prometheus-kps.csv`
- `docs/user/choosing-commands.md`
- `data/variant-goldens/redis-prod-us-east/`
- `data/managed-overlay-goldens/external-dns-customer-acme-prod/`

Do not edit generated files in this directory by hand.
