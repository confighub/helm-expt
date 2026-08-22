# Config Workshop simulation findings

Date: 2026-08-22

This is the canonical record for the automated website journey checks. It does
not replace the [business purpose and user journey](../reference/config-catalog-doctrine.md#business-purpose-and-user-journey),
and it is not user research.

## What the simulation does

Four deterministic walkers represent an application developer, GitOps operator,
platform engineer, and release reviewer. Each walker starts from every main page,
follows visible internal links for at most five clicks, and looks for the facts and
next action required by one practical task.

The test answers one narrow question: can a visitor reach the maintained answer from
each main page? It cannot tell us whether a person trusts the answer, understands a
technical term, runs a command successfully, or adopts ConfigHub.

## Retained runs

The dated directories under `data/site-persona-simulations-*` retain the journey
rows and language trials. The important checkpoints are:

| Checkpoint | Result | Why it matters |
| --- | --- | --- |
| 2026-08-13 first broad run | 667 success, 53 partial, 0 fail out of 720 | Established the four-persona baseline. |
| 2026-08-21 final navigation run | 720 success out of 720 | Confirmed that every original task had a reachable answer. |
| 2026-08-22 stricter model run | 708 success, 11 partial, 1 fail out of 720 | Replaced easy OCI and AICR checks with precise questions about artifact identity, nested sources, and unrun hardware work. |
| 2026-08-22 final model run | 720 success out of 720 | Confirmed that the targeted AICR and OCI fixes made the precise answers reachable. |

Only runs that use the same goals and scoring rules should be compared directly.
The individual summary files state when such a comparison is valid.

## What the stricter run found

The 2026-08-22 run exposed two useful gaps.

1. A visitor could find a general AICR starter but could miss the v0.19.0 record that
   shows all 16 nested source renders, the public input artifacts, the ConfigHub
   release OCI, and the H100 work that has not run.
2. The Deployment page named three OCI roles but did not state plainly that the
   exact-object digest, OCI manifest digest, and release OCI digest identify
   different records.

The corresponding site changes are deliberately small: name AICR in the examples
link, link the starter to the v0.19.0 stage record, and add one digest-identity
paragraph to Deployment.

In the final run, 363 of 720 tasks were answered on the starting page. When a task
needed navigation, 253 of 357 first clicks moved toward the answer. Every task reached
the answer within five clicks. These figures are regression metrics, not a target for
putting every answer on every page.

## Stable findings

- `Check my config` remains the clearest tested navigation label. It won 39 of 80
  synthetic forced-choice trials. This is not an observed human preference.
- The top-level sequence remains useful: Catalog, Check my config, Promote my
  config, ConfigHub.
- The Catalog should answer a case we already maintain. Check my config should
  investigate a new case. A useful result from either path must remain usable as
  files or OCI before the ConfigHub handoff.
- Advanced examples should remain on the Examples page. Simplification means a
  clearer first choice, not deleting promotion, fleet, AICR, OCI, YAML, or App
  evidence.
- Helm has the deepest evidence and should remain the main acquisition path. AICR,
  OCI, and YAML need precise entry points rather than equal amounts of introductory
  copy.

## Human tests still required

Use the 40 public Helm questions in the doctrine as the first recruitment set. A
test begins with the exact chart, version, values, OCI, or running configuration
that the person already has. Let the person use their normal AI assistant.

Record these outcomes:

1. Could the person state the question in their own words?
2. Did the first page show the right starting action?
3. Could they obtain exact objects and a comparison?
4. Could they identify prerequisites and lifecycle work?
5. Could they tell which checks ran and which did not?
6. Could they keep the accepted result as files or OCI?
7. When ConfigHub was offered, did keeping history, promotion, approvals, or live
   comparison provide a reason to use it?

The promotion test must continue through candidate, destination, staging checks,
and the recorded result. The AICR test must separate configuration inspection from
GPU execution. Personal details remain outside Git; only aggregate invitations and
outcomes belong in this repository.

## Commands

Run the deterministic navigation check against a local generated site:

```bash
python3 -m http.server 8766
npm run site:persona:simulate -- \
  --base-url http://127.0.0.1:8766/site/ \
  --out-dir data/site-persona-simulations-YYYY-MM-DD
```

Treat a green run as a link-and-content regression result, not as proof of human
understanding or demand.
