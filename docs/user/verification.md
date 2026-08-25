# Verification

**UNOFFICIAL/EXPERIMENTAL**

Verification is how a reader checks a claim instead of trusting a screenshot.
The npm commands in this repo are proof checks, not product install commands.
Use the narrowest check that answers the question in front of you.

## Four Different Questions

| Question | Required input | Does it need deployment? |
| --- | --- | --- |
| **What do I have?** | The source, snapshot, package, OCI, or exact files. | No. A live snapshot needs read access to what it measures. |
| **What will it produce?** | The source and intent plus its native tool, unless the configuration is already literal. | No. |
| **Can this destination accept it?** | The exact candidate plus current facts from the named destination. | No, but it needs destination access. |
| **Did it work?** | The exact delivered revision plus the live evidence required by the claim. | Yes. |

Evidence state and result state are separate. A missing prerequisite makes the
dependent check `blocked` or `not-run`; it does not make the source,
configuration, workload, or conformance result fail. A Catalog listing does not
turn missing destination or runtime evidence into a pass.

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

## Source, Materialize, Record, Route

The verification model has four steps:

| Step | Meaning | What gets checked |
| --- | --- | --- |
| Source and intent | Lock and record the source, version or digest, selected options, target assumptions, and source-specific inputs. A Helm recipe is one source-specific form of this record. | The inputs are pinned and named, so the source operation can be repeated. |
| Materialize | Run Helm render, AICR generation, Timoni build, Kubara or Sveltos generation, OCI extraction, or another source-native operation. For literal YAML this is a no-op. | The exact Kubernetes object set and its identity are recorded. |
| Record | Keep the output evidence with the render: objects, diffs, receipts, scans, and observations. | A later reviewer can see what changed and rerun the same proof boundary. |
| Route | Name the lifecycle work around ordinary object delivery: hooks, CRDs, tests, waits, generated facts, target prerequisites, Secrets, setup jobs, and controller-specific handling. | Each step has an owner, order, destination decision, execution result, or explicit not-run state. |

This is why a flat object set is only the start. The source and intent explain
where it came from. Route intent records the lifecycle work that is not an
ordinary Kubernetes object. A resolved route says how that work is handled for
one candidate, destination, and delivery runtime.

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
