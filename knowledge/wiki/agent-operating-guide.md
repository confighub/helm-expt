---
title: Agent Operating Guide
status: current
last_reviewed: 2026-06-14
---

# Agent Operating Guide

The canonical agent/operator docs now live in
[docs/agent/README.md](../../docs/agent/README.md). Use this page as a compact
knowledge-layer reminder, not as a replacement for the agent docs.

Start from the generated front doors, not from old planning prose.

Use:

- `data/master-catalog-matrix/matrix.html` for chart/version/base status;
- `data/status-dashboard/summary.md` for aggregate status;
- `data/claims-register/summary.md` for claim support;
- `docs/README.md` for the manual doc map;
- `tests/npm-scripts.md` for command families.

When editing generated surfaces, update the generator and regenerate the output.
When editing live lanes, run only one live lane at a time and preserve receipts.
When checking a narrow change, use scoped checks. Use full `npm run verify` only
for a broad release gate or when explicitly asked.

Do not make a `watch` or `blocked` row green from prose. The receipt must carry
the evidence.

Parallel agents should communicate through PRs, avoid live-lane collisions, and
state exactly which generated surfaces they touched.

## Authoritative Sources

- [Documentation map](../../docs/README.md)
- [NPM script catalog](../../tests/npm-scripts.md)
- [Live parity guide](../../docs/user/live-parity.md)
- [Master catalog matrix reference](../../docs/reference/master-catalog-matrix.md)
- [What we refuse to claim](../../docs/user/what-we-refuse-to-claim.md)
