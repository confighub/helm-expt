# Knowledge Layer Schema

The `knowledge/` directory is a maintained orientation layer for helm-expt. It
helps humans and agents find the current model without rereading old chats,
planning notes, and generated data from scratch.

This layer is not a source of truth. It summarizes and routes to authoritative
evidence.

## Authority Order

When sources disagree, use this order:

1. Generated data under `data/`
2. Committed receipts under `runs/`
3. Recipes and packages under `recipes/` and `packages/`
4. Current public site output under `site/`
5. Current GitHub issues and PRs
6. Tests and verifiers, scoped to the claims they actually check
7. Manual docs under `docs/`
8. This knowledge layer

A knowledge page is wrong if it conflicts with generated data, receipts, current
issues, or verifier output.

## Page Shape

Each page under `knowledge/wiki/` must use this front matter:

```yaml
---
title: Short Title
status: current | draft | needs-refresh
last_reviewed: YYYY-MM-DD
---
```

Each page must also include:

- one `#` heading;
- a concise explanation in plain English;
- `## Authoritative Sources`;
- links to current generated data, docs, receipts, recipes, or issues;
- no unsupported support-status counts.

## Delivery Pattern Fields

Pages surveying a delivery family for #1758 also carry these fields:

```yaml
family: oci-sources
shapes: [installer-package, aicr-per-file, flux-native-artifact]
assumes: [registry, controller-version]
sources:
  - url: https://fluxcd.io/flux/cheatsheets/oci-artifacts/
    licence: Apache-2.0
  - url: https://argo-cd.readthedocs.io/en/stable/user-guide/oci/
    licence: Apache-2.0
run_with: "One line identifying the artifact-producing command or an explicit workflow gap."
```

Families are rendered-manifests, oci-sources, d2-stacks, app-of-apps, overlays,
image-automation, fleets, and helm-without-helm. Each family appears once.
Shapes are installer-package, aicr-per-file, flux-native-artifact, and none.
The shape list includes relevant inputs requiring conversion; the page must
explain direct consumption versus adaptation. It is not a compatibility verdict.

Use two or three representative public sources with HTTPS URLs and the exact
`licence` field. Record assumptions as short tags. Every page explains its
tradeoffs and proposed recipe, and cites receipts for repository capability claims.
The index page has the ordinary wiki front matter and no family field.
Do not start d2 analysis before the maintainer supplies the layout list.

## Index Rules

`knowledge/index.md` is the maintained map. Every `knowledge/wiki/*.md` file
must appear in the index table with:

- title;
- purpose;
- status;
- last reviewed date;
- main evidence links.

No orphan wiki pages are allowed.

## Log Rules

`knowledge/log.md` is append-only. Every manual maintenance pass should add a
heading in this shape:

```md
## [YYYY-MM-DD] category | short action
```

The entry should state:

- what changed;
- what evidence was used;
- what was deliberately not changed.

## Raw Sources

Raw source drops may be placed under `knowledge/raw/` in a later phase. They
must be treated as untrusted input until distilled into a wiki page with
authoritative links.

Do not copy prompt text, Slack exports, or customer material into public wiki
pages unless it is safe to publish.

## Freshness Rules

Use `status: needs-refresh` when:

- linked generated data has materially changed;
- a linked issue has been closed or superseded;
- a live receipt changes a previously stated outcome;
- a command surface changes.

Do not update a wiki page merely to chase generated timestamps.

## Adding A Page

When adding or changing a page:

1. Update the page.
2. Update `knowledge/index.md`.
3. Append an entry to `knowledge/log.md`.
4. Run `npm run knowledge:verify`.
5. Run `npm run docs:verify` if markdown paths or links changed.

