# Quirk Coverage

The catalog should not imply that every Helm behavior is fully understood. The
quirk coverage audit records which behaviors are tracked, which are only visible
in source scans, and which are known blind spots.

The generated audit is the current source of truth:

| File | Use it for |
| --- | --- |
| [data/quirk-coverage/summary.md](../../data/quirk-coverage/summary.md) | Human-readable coverage summary by quirk axis. |
| [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) | Spreadsheet-friendly coverage table. |

Each row has a coverage tier:

| Tier | Meaning |
| --- | --- |
| `tracked-and-surfaced` | The behavior appears in generated chart/user data and has recipe or receipt evidence. |
| `tracked-by-lock-not-front-door` | The behavior is recorded in locks or artifacts, but is not yet promoted into front-door tables. |
| `partly-tracked` | The behavior is visible, but one or more lifecycle or per-chart proof pieces is still missing. |
| `disclosed-not-complete` | The behavior is disclosed and gated, but not fully modeled or live-proven. |
| `source-scanned-not-surfaced` | The behavior is detected in source scans, but not promoted to chart facts or outcome tables. |
| `not-scanned` | The behavior is a known blind spot in the current scanner or data model. |

Use the audit when adding chart facts, pain reports, variant paths, hook
lifecycle routes, and top-100/top-500 analysis. A chart can still be usable when
one of its axes is incomplete, but the incomplete axis should stay visible.

The generated summary also carries the current high-value counts for
NGINX-like extension slots. These distinguish explicit catalog control points
from broader source-scan signals such as raw `tpl` usage.

Regenerate and check the audit:

```sh
npm run quirk-coverage
npm run quirk-coverage:verify
```
