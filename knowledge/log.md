# Knowledge Layer Log

This log is append-only. It records maintenance actions for the knowledge
layer, not every change in the repo.

## [2026-06-14] issue | create project knowledge layer

Created the first maintained knowledge layer from issue
[helm-expt#702](https://github.com/confighub/helm-expt/issues/702).

Added:

- `knowledge/SCHEMA.md`;
- `knowledge/index.md`;
- this log;
- eight seed pages under `knowledge/wiki/`;
- a verifier for index/page consistency.

Evidence used:

- `docs/README.md`;
- `data/master-catalog-matrix/matrix.html`;
- `data/status-dashboard/summary.md`;
- `data/claims-register/summary.md`;
- `data/lifecycle-routes/summary.md`;
- `docs/user/*` and `docs/reference/*` pages linked from the index.

Deliberately not changed:

- no generated status data was replaced;
- no old planning notes were moved;
- no support-status counts were copied into wiki prose;
- no raw chat or customer material was imported.

## [2026-09-06] survey | map delivery patterns to OCI roles

Added seven draft delivery-family pages and a cross-family index with a candidate
shortlist for #1758. Replaced the bootstrap page-count ceiling with pattern-field
validation, including negative schema checks and unique family enforcement.
Sources are upstream Flux, Argo CD, Image Updater and Sveltos
worked examples and their repository licenses. Catalog claims link to retained
installer, AICR and Sveltos receipts and generated summaries.

The d2 family remains unassessed pending the maintainer's requested layout list.
No catalog status, live receipt, website output or docs/user content changed.
Candidate admission remains a maintainer decision.
