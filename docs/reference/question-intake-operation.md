# How public chart questions are handled

Config Workshop asks for one exact question about a public Helm chart. This page explains what happens after someone submits that question.

The process has one purpose: give the submitter a useful, citable decision. Adding a chart to the catalog is one possible outcome. A clear refusal or a statement that the available evidence does not answer the question is also a valid outcome.

## What a complete report contains

A report is ready for triage when it includes:

1. the decision the operator needs to make;
2. the public chart and exact version;
3. public values or flags needed to reproduce it;
4. the expected and observed behavior; and
5. commands or public artifacts that reproduce the result.

Do not ask a submitter to publish private values, credentials, customer data, or private repository links. A private problem stays local or moves to a private support channel.

## Response targets

We aim to acknowledge a complete report within two business days. We aim to post a catalog entry, named refusal, or evidence decision within seven days.

Use these labels as the question moves:

| Label | Meaning |
| --- | --- |
| `challenge-intake` | The question arrived through the public Workshop path. |
| `intake-acknowledged` | A maintainer has read it and stated what happens next. |
| `intake-triage-ready` | The public report has enough information to reproduce. |
| `intake-decided` | The issue contains an entry, refusal, or evidence decision. |

## First response

Post this after reading the report. Replace the bracketed text.

```text
Thanks. We have read this as:

Question: [the operator's question]
Chart and version: [chart@version]

Status: [ready to reproduce / needs the public information listed below]
Next update due: [date]

We will not call this chart supported until the result is backed by a catalog entry, a named refusal, or linked evidence.
```

If information is missing, list only what is needed to reproduce the public case. Do not start the seven-day decision clock until the issue is triage-ready.

## Decision response

Close the loop with this structure:

```text
Outcome: [catalog entry / named refusal / evidence decision]

Decision: [plain-English answer to the submitted question]
Evidence: [links to the chart page, receipt, test, or refusal]
Limit: [what this result does not prove]
Next action: [the command or page the submitter should use]
```

Add `intake-decided` only when the comment contains all four lines. Close the issue when no further repository work is required. If implementation continues in another issue or pull request, link it before closing.

## Monthly record

The public aggregate lives in [`data/challenge-intake/monthly.csv`](../../data/challenge-intake/monthly.csv). It stores counts only. Contact names, outreach lists, and private conversations must not be committed.

Update the row for the current month, then run:

```bash
npm run challenge-intake:generate
npm run challenge-intake:verify
```

The generated [public summary](../../data/challenge-intake/summary.md) separates submissions from the controlled cohort from other public issues. This keeps the forty-invitation denominator honest.
