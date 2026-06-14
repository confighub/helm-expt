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

