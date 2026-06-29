# Verification

**UNOFFICIAL/EXPERIMENTAL**

Verification is how a reader checks a claim instead of trusting a screenshot.
The npm commands in this repo are proof checks, not product install commands.
Use the narrowest check that answers the question in front of you.

## The Short Rule

- Product commands render, install, and manage configuration: `cub ...`,
  `helm ...`, `kubectl ...`, Argo, or Flux.
- Npm commands verify repo evidence: generated site files, generated docs,
  generated data, tutorial renders, committed receipts, or fresh live parity
  lanes.
- `npm run verify` is a broad repo gate. It is useful before publishing or
  reviewing a large change, but it is not the first-user path.
- Fresh live checks create evidence and may need kind, ConfigHub, OCI, or
  GitOps controllers. Committed checks read evidence that is already in the
  repo.

## Render, Record, Route

The verification model has three moves:

| Move | Meaning | What gets checked |
| --- | --- | --- |
| Render | Turn a chart, version, values, release name, namespace, and capability profile into exact Kubernetes objects. | The rendered object set matches the recorded package or Helm baseline. |
| Record | Keep the inputs, source lock, objects, diffs, receipts, scans, and observations with the chart configuration. | A later reviewer can see what changed and rerun the same proof boundary. |
| Route | Name everything Helm leaves around the edges: hooks, CRDs, webhooks, generated facts, target prerequisites, Secrets, setup jobs, and GitOps handoff. | Each extra is applied, observed, blocked, refused, or marked target-specific instead of being hidden inside prose. |

This is why a flat YAML render is only the start. The value is that the render
has recorded intent and named routes for the work that is not just a literal
Kubernetes object.

## Which Check Should I Run?

| Question | Command or surface | Needs a cluster? | What it proves |
| --- | --- | --- | --- |
| Are the generated website, docs, and data current? | `npm run site:verify`, `npm run docs:verify`, `npm run data:index:verify` | No | Generated surfaces match committed source and data. |
| Does a rendered Redis tutorial output match the catalog contract? | `npm run redis:verify-install:render -- ...` | No | A user's workdir render matches the expected chart/base/package contract. |
| Do I need the broad repo gate? | `npm run verify` | No cluster by default | The committed corpus, generated files, receipts, and docs are self-consistent. |
| Does regular Helm and cub reach the same live result? | `npm run kind-parity:run -- ...` | Yes, kind | A fresh two-cluster Helm-vs-cub comparison for one chart/version/base. |
| Do committed two-cluster parity receipts still check out? | `npm run kind-parity:verify` | No | Existing receipts and summaries are internally consistent. |
| Does the ConfigHub, OCI, and Argo path pass for a row? | `npm run live-parity:run -- ...` | Yes, kind plus live ConfigHub and OCI path | The stricter live lane for a committed recipe/base. |
| What does a lane mean? | `npm run lane-tests:verify` and [Verification Lanes](./verification-lanes.md) | No | The lane matrix semantics and status vocabulary are still valid. |
| Can I validate a cub-scout receipt? | `cub-scout receipt validate <receipt.json>` | No | The receipt fingerprint and structure validate locally. |

## User-Side And Maintainer Checks

User-side checks answer "can I inspect or compare this chart path myself?"
Examples are `cub installer setup`, `npm run redis:verify-install:render`, and
`npm run kind-parity:run`.

Maintainer checks answer "is the repo still internally consistent?" Examples
are `npm run site:verify`, `npm run docs:verify`, `npm run data:index:verify`,
and `npm run verify`.

Evidence-refresh checks answer "should we create new live receipts?" Examples
are `npm run live-parity:run`, `npm run outcomes:generate`, and
`npm run status:dashboard`. Run those deliberately because they can create or
refresh evidence files.

## Fresh Evidence And Committed Evidence

Committed evidence is already in the repo. It is good for review, publishing,
and checking that generated pages still match the receipts and CSVs they cite.

Fresh evidence creates a new run. It may create kind clusters, use ConfigHub,
publish OCI artifacts, wait for Argo or Flux, or write new receipts. Run fresh
live lanes serially so clusters, namespaces, credentials, and receipts do not
trample each other.

## Subtopics

| Topic | Use it for |
| --- | --- |
| [Verify It Yourself](./verify-it-yourself.md) | The practical command list for offline checks, rendered installs, kind parity, ConfigHub/OCI live parity, and cub-scout receipts. |
| [Verification Lanes](./verification-lanes.md) | What each proof lane means, what it does not prove, and how to read pass, watch, blocked, missing, and fail. |
| [Choosing Commands](./choosing-commands.md) | When to use product commands versus repo verifiers. |
| [Expected Results And Clusters](./expected-results-and-clusters.md) | What output should appear and which steps need a cluster. |
| [Outcomes And Tests](./outcomes-and-tests.md) | Which repo promises map to which test commands and CSVs. |
| [Live Parity](./live-parity.md) | How to read live Helm-vs-ConfigHub parity status. |
| [Chain Of Proof](./chain-of-proof.md) | Which boundary is proven by render receipts, ConfigHub receipts, delivery receipts, and live observations. |
| [What We Refuse To Claim](./what-we-refuse-to-claim.md) | The refusal boundaries that keep proof language honest. |
| [Two-Cluster Helm Parity Harness](../reference/two-cluster-parity-harness.md) | The stricter Helm-vs-cub kind harness. |
| [NPM Test And Verification Scripts](../../tests/npm-scripts.md) | The full script catalog for maintainers. |
| [Outcome Coverage](../../data/outcome-coverage/summary.md) | Generated lane coverage across the corpus. |
| [Status Dashboard](../../data/status-dashboard/summary.md) | Current generated proof counters and active queue. |
