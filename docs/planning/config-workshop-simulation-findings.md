# Config Workshop simulation findings

Updated: 2026-08-24

This is the canonical record for the automated website journey checks. It does
not replace the [business purpose and user journey](../reference/config-catalog-doctrine.md#business-purpose-and-user-journey),
and it is not user research.

## What the simulation does

Four deterministic walkers represent an application developer, GitOps operator,
platform engineer, and release reviewer. Each walker starts from every main page,
follows visible internal links up to the configured click limit, and looks for the
facts and next action required by one practical task. The original runs allowed five
clicks; the latest first-use runs allow three.

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
| 2026-08-23 qualitative three-click review | 423 concrete, 122 partial, 55 failed or blocked out of 600 | Showed where impatient first-time readers lost the thread even when a maintained answer existed. The four agents used different task mixes, so this is a coverage count rather than a persona ranking. |
| 2026-08-23 deterministic three-click baseline | 892 success, 117 partial, 3 fail out of 1,012 | Tightened the first-use limit from five clicks to three and expanded the cross-format and managed-operation questions. |
| 2026-08-23 deterministic three-click rerun | 910 success, 99 partial, 3 fail out of 1,012 | Confirmed that targeted recovery, lifecycle, Catalog handoff, and Timoni changes converted 18 partial journeys to success. |
| 2026-08-24 managed-promotion baseline | 921 success, 121 partial, 14 fail out of 1,056 | Added exact questions about destination checks, approval, release OCI, and lifecycle-heavy promotion. |
| 2026-08-24 managed-promotion rerun | 931 success, 121 partial, 4 fail out of 1,056 | Confirmed that the worked Kube Prometheus Stack proof and clearer links removed ten failed journeys. |
| 2026-08-24 command-contract rerun | 938 success, 118 partial, 0 fail out of 1,056 | Confirmed that direct promotion, lifecycle, and identity links removed the remaining deterministic failures. |

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

## What the latest numbers mean

The latest deterministic three-click test found that 938 of 1,056 tasks reached
the required answer and a relevant action. This is strong evidence that maintained
answers are reachable. It is a navigation and content regression test, not proof
that a person understands the answer, trusts it, needs it, or will adopt ConfigHub.

The looser 600-journey review produced 423 concrete answers, 122 partial answers,
and 55 failed or blocked results. The lower result is useful. Impatient first-time
readers were more likely to lose the thread around lifecycle work, current evidence,
and live operations than the deterministic walker was.

The latest before-and-after runs used the same 1,056 journeys. Successful journeys
rose from 931 to 938, failed journeys fell from 4 to 0, and answers available on
the starting page rose from 465 to 471. The useful-first-click rate rose from 66.2%
to 67.0%. The repaired journeys now point directly to a destination-aware promotion
action, the lifecycle-heavy Kube Prometheus Stack result, and the three distinct
object and OCI identities. A high final success total does not remove the need to improve
the first choice or turn partial answers into completed actions.

The remaining weak goals are close to ConfigHub's managed value:

- check hooks and CRDs for a specific destination;
- compare desired configuration with live state;
- test a candidate in staging;
- retain approvals and current evidence;
- run controlled rollout waves; and
- prove rollback beyond the Kubernetes object set.

This does not mean every incomplete website journey is a sales opportunity. Some
are missing product capability or missing evidence and must remain named as such.
It does mean that more explanatory copy cannot complete these journeys by itself.

## The main remaining journey

The project has demonstrated this public sequence:

```text
question -> exact objects -> comparison -> reviewed files or OCI
```

The site explains this managed sequence:

```text
reviewed result -> ConfigHub -> variants -> promotion -> release -> live comparison
```

The repository now has one machine-run NGINX path that retains the accepted object
set in ConfigHub, creates a staging variant, previews and performs a promotion, and
binds the accepted object identity to the retained Unit. This proves that the current
commands can complete that bounded path. It does not show that an ordinary user can
discover or complete it easily. The next tests should therefore be end-to-end tasks
rather than another general navigation sweep:

1. Take AI-written Helm values through exact comparison to a reviewed OCI.
2. Retain that reviewed OCI as a ConfigHub base.
3. Change the base for staging and compare the candidate with production.
4. Check hooks, CRDs, and destination requirements before promotion.
5. Promote an exact release, deliver it through Argo CD or Flux, and compare it
   with live state.
6. Turn a useful public investigation into a retained Catalog answer.

The [managed journey coverage](../../data/managed-journey-coverage/summary.md)
records these six tasks separately. All six have a committed technical proof and
verifier. None has passed an outside-user trial. Keeping those results separate
prevents a working test harness from being mistaken for a usable product journey.

One automated Kube Prometheus Stack run now covers the technical core of tasks 3,
4, and 5 for a lifecycle-heavy chart: retained base, staging candidate, destination
preflight, approval, exact release OCI, Argo CD reconciliation, and live checks. It
also caught an invalid namespace rewrite before the accepted release. This is
machine evidence for one exact path. It is not evidence that an ordinary user can
discover or complete the path without help, and it does not cover rollback.

The website reflects the intended sequence. The next proof must come from people
completing it and finding that the retained result saves work when the configuration
changes again.

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
  --max-clicks 3 \
  --current-label "Check my config" \
  --out-dir data/site-persona-simulations-YYYY-MM-DD
```

Treat a green run as a link-and-content regression result, not as proof of human
understanding or demand.
