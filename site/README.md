# Generated Public Site

This directory is generated from helm-expt catalog data.

```sh
npm run site:generate
npm run site:verify
```

Open `site/index.html` first for the public launch front door.
Open `site/try.html` for the short try-now page.
Open `site/journey.html` for the path from inspect, to no-account try-out, to
ConfigHub-managed operations.
Open `site/hard-questions.html` for the skeptical user route: hooks, upgrades,
custom values, target prerequisites, false-green sync, and refusal boundaries.
Open `site/proof.html` for the proof lanes, sceptic tests, and refusal boundary.
Open `site/hooks.html` for hook and lifecycle route dispositions.
Open `site/tiers.html` for the free, authenticated, managed, and enterprise tier shape.
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
