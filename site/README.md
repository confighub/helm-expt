# Generated Public Site

This directory is generated from helm-expt catalog data.

```sh
npm run site:generate
npm run site:verify
```

Open `site/index.html` first for the public launch front door.
Open `site/how-it-works.html` for the four-move model: render, route, deliver, observe.
Open `site/try.html` for the short try-now page.
Open `site/variants.html` for base variants, derived variants, and promotion entry points.
Open `site/journey.html` for Apps: public charts, custom apps, stacks,
and platform groups from inspect, to no-account try-out, to managed variants
and promotion.
Open `site/custom-apps.html` for deeper application examples with custom apps,
multi-chart stacks, and overlays.
Open `site/operations.html` for Ops: scans, gates, delivery, observation, adoption,
upgrades, rollback, bulk patching, and fleet questions.
Open `site/day1-operations.html` only as a compatibility redirect to `site/operations.html`.
Open `site/docs.html` for the public documentation hub.
Open `site/known-gaps.html` for current watch findings the project surfaces deliberately.
Open `site/hard-questions.html` for the FAQ: hooks, upgrades,
custom values, target prerequisites, false-green sync, and refusal boundaries.
Open `site/proof.html` only as a deep reference for proof lanes, sceptic tests,
and refusal boundaries.
Open `site/charts/index.html#actions` for ConfigHub Actions, including hook
and lifecycle route dispositions. `site/hooks.html` only redirects there for
compatibility.
Open `site/private/index.html` for private catalogs, managed operations, and commercial boundaries.
Open `site/tiers.html` only as a compatibility redirect to `site/private/index.html`.
Open `site/offering.html` for the longer public offering page.
Open `docs/user/choose-your-path.md` for the direct render, one-shot upload,
public catalog, and ConfigHub operations route picker.
Open `site/charts/index.html` for the generated per-chart catalog pages.
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
