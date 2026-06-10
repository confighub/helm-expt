# Generated Public Site

This directory is generated from helm-expt catalog data.

```sh
npm run site:generate
npm run site:verify
```

Open `site/offering.html` directly in a browser for the public offering page.
Open `site/try.html` for the short try-now page.
Open `site/index.html` for the static catalog and status dashboard.
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
- `data/top20-base-readiness/base-readiness.csv`
- `data/extension-slots/extension-slots.csv`
- `data/top100-readiness/readiness.csv`
- `data/top100-coverage/work-queue.csv`
- `data/top100-promotion-wave/wave.csv`
- `data/refresh-survival/refreshes.csv`
- `data/live-parity-rerun-plan/rerun-plan.csv`
- `data/production-disposition/top20.csv`
- `data/production-support-decisions/decisions.csv`
- `data/high-fanout-demo/prometheus-kps.csv`
- `docs/user/choosing-commands.md`
- `data/variant-goldens/redis-prod-us-east/`
- `data/managed-overlay-goldens/external-dns-customer-acme-prod/`

Do not edit generated files in this directory by hand.
