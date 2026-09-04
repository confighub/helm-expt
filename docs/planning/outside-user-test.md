# Outside-User Journey Test

_An outside-user test in the [helm-expt test map](../../tests/README.md)._

This protocol tests whether ordinary users can complete the six journeys that
connect ConfigHub Workshop to ConfigHub. It is not another navigation simulation.
A participant must produce a real result, understand its limits, and know what
to do next.

Use a participant who knows Kubernetes configuration but has not worked on this
repository. Let them use the Claude, Codex, or other AI assistant they normally
use. Do not coach them through the product.

## What Counts As A Pass

A journey passes only when all of these are true:

1. The participant completes the task without a facilitator choosing the next
   command or page.
2. They produce a durable artifact: exact objects, a `WorkshopResult`, an OCI
   digest, a ConfigHub revision, a promotion record, or a Catalog decision.
3. They can state what was checked and what remains untested.
4. The source identity and accepted object-set hash stay consistent at every
   handoff where the journey claims continuity.

A working link, readable page, generated command, or synthetic simulation is not
a user pass. A command failure, unexplained hash mismatch, or treating `not-run`
as success is a failed journey.

## The Six Journeys

Use the exact examples below for the first wave. Later waves should substitute a
participant's own configuration without weakening the result contract.

| Journey | Starting question | Required result | Common failure |
| --- | --- | --- | --- |
| AI values to reviewed OCI | Can I turn these Helm values into exact reviewed objects and OCI? | Exact objects, comparison, completed and omitted checks, `WorkshopResult`, and pullable OCI with the accepted object-set hash. | The participant stops at prose, cannot find the output, or assumes static checks prove deployment. |
| Reviewed OCI to ConfigHub base | Can I keep these exact reviewed objects in ConfigHub? | A retained base whose canonical object-set hash matches the accepted local result. | The source must be selected again, the object set changes silently, or the participant cannot find the retained revision. |
| Candidate versus production | Can I test this staging candidate against production and decide whether to promote it? | Candidate-to-destination diff, destination checks, decision, and promotion preview or recorded refusal. | A generic diff is mistaken for a destination check, or preview is described as completed promotion. |
| Lifecycle and destination preflight | What must happen to hooks, CRDs, Secrets, namespaces, and setup Jobs before this candidate can move? | Route intent resolved after the final variant, with named owners, order, target requirements, and unrun work. | Lifecycle work is hidden, inherited from the wrong version, or treated as automatic without evidence. |
| Exact release to live state | Did the promoted release reach the target and work? | Exact release OCI, GitOps reconciliation, desired-versus-live result, and separate workload observation. | A green publish or sync is treated as workload success, or the live digest cannot be joined to the release. |
| Public investigation to Catalog answer | Can this public configuration question become an answer other users can reuse? | A Catalog entry, warning, refusal, or evidence decision with source/version, result, limits, and follow-up status. | The answer remains in a private conversation, loses the exact version, or makes a claim without evidence. |

The technical fixtures and current evidence for these tasks are generated in
[Managed Journey Coverage](../../data/managed-journey-coverage/summary.md).

## How To Run One Session

1. Give the participant the direct page and input for one journey. Do not make
   them rediscover context that the test already knows.
2. Ask them to say what they expect to learn before they begin.
3. Let them use the website, terminal, ConfigHub, and their normal AI assistant.
4. Do not redirect a wrong turn. Record the route, alternatives considered, and
   the point where they stop or ask for help.
5. Ask them to show the durable result and identify its source, object-set hash,
   checks run, checks not run, and next action.
6. Ask whether a different path looked easier and why they did or did not take it.
7. Record the outcome outside Git, then commit aggregate counts only.

Use the released commands shown by the site. Proposed commands do not count as a
completed path. Private values, prompts, credentials, names, and contact details
must remain outside this repository.

## Session Record

Keep the detailed record privately:

```text
participant-code:
role:
experience:
normal-ai-assistant:
journey-id:
repo-commit:
site-commit:
start-page:
input-kind:
route-taken:
alternative-paths-considered:
first-dropoff:
facilitator-help:
commands-run:
durable-artifact:
source-identity:
accepted-object-set-hash:
checks-understood:
not-run-understood:
next-action-understood:
result: pass | partial | fail
reason:
```

## First-Wave Gate

Run at least one outside-user session for each journey. The first wave succeeds
only when:

- at least five of six journeys complete without facilitator help;
- all six participants can state the important limitation or unrun check;
- all six journeys produce the required durable artifact or a correctly recorded
  refusal;
- no journey passes because a page was reachable without the task being done; and
- every claimed handoff preserves the accepted object-set identity.

If a journey fails, classify the first blocking cause as website, command,
ConfigHub product, evidence, external dependency, or user expectation. Fix the
smallest owning surface, then rerun that journey with a fresh participant.

## Public Aggregate

Update `config-catalog/managed-journeys.yaml` and regenerate the coverage page
only after a real session. Publish aggregate results in this shape:

```text
trial-period:
journeys-attempted:
passes:
partials:
fails:
facilitator-free:
durable-artifacts-produced:
limitations-understood:
hash-mismatches:
top-dropoff-categories:
routes-used:
alternative-routes-considered:
issues-filed:
```

The separate 40-person public-question cohort remains tracked in
[#1553](https://github.com/confighub/helm-expt/issues/1553). Recheck every public
thread before contact, keep personal details outside Git, and record only
aggregate invitations and outcomes.
