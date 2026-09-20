# Agent configuration work plan

Current adoption delivery: [Workshop adoption doctrine and execution plan](./workshop-adoption-execution-plan.md). Follow its journey sequence for public experience and user trials; the technical obligations below remain in force.

Status: active implementation, 2026-09-19.

## Outcome

An agent takes responsibility for configuration problems, from a chart whose
values do not behave as intended to five custom EKS inference stacks assembled
from Helm, AICR, OCI and authored YAML, including testing patches and rollouts.
Platform assembly extends the existing diagnosis, adaptation and delivery work.
Every operational step also has a deterministic manual path through `cub`.

The agent or person chooses. The CLI presents candidates and checks explicit
choices. ConfigHub Server manages shared state, governance and concurrent writes.
A static check does not prove a deployment, nondisruptive rollout or successful
rollback. Those require separate target observations and retained receipts.

## Delivery sequence and acceptance

| Block | Work | Acceptance |
| --- | --- | --- |
| 1 | Role discovery in listings and CLI | Find cache, metrics, logs, ingress and certificates without scraping prose. Return all candidates; distinguish operators, services and agents. Unclassified entries stay explicit. |
| 2 | Publish the existing stack schema and composition path | A fresh human or agent can author a valid manifest from the public contract, with no reverse engineering of examples. |
| 3 | Deterministic assembly | Assemble explicitly chosen entries with real artifact references; present alternatives rather than silently selecting. Both CLI and AI paths can build new stacks. |
| 4 | Missing-bundle route | Explain and expose as data how an entry without a published object bundle can participate, without inventing a publication or digest. |
| 5 | Cross-component checks | Refuse the observed wrong-namespace log destination; explicitly bound which connections are checked. |
| 6 | Structured refusals and checking triggers | An agent can recover using structured choices; a configured CI gate catches a bad edit without a reminder. |
| 7 | Parallel local use and durable handoffs | Concurrent read-only runs preserve results; a fresh agent can resume from the retained record. Shared writes remain the server's responsibility. |
| 8 | Human explanations and mission trials | Principles, limits and one useful action lead each page. Trial chart diagnosis, adaptation, new stack assembly, patch testing and rollout assessment using both manual and AI paths. |

## Evidence and follow-ups

The prior ten-minute trial reported static assembly in 8 minutes 43 seconds,
with 10 components and 231 objects. That is a baseline, not a live platform
readiness result. It exposed missing roles, the unpublished stack schema,
missing-bundle navigation, cross-namespace log wiring, missing cert-manager CRDs,
and the difference between a PostgreSQL operator and a database instance.
Reproduce those cases as acceptance tests rather than converting the report
into new readiness claims.

Image inventory and digest resolution landed in
[Catalog #1948](https://github.com/confighub/helm-expt/pull/1948) and
[plugin #29](https://github.com/confighub/cub-workshop/pull/29).
The public command is `cub stack check`, with `CHECKED` and `REFUSED`, from
[plugin #30](https://github.com/confighub/cub-workshop/pull/30) and
[site #1949](https://github.com/confighub/helm-expt/pull/1949).
Existing receipt kinds remain historical evidence, not a certification promise.

Also investigate the reported mechanical flattening rationale inconsistency,
fix the cert-manager and PostgreSQL composition data gaps, and keep infrastructure
and registry blockers attached to their issues. Breadth, outreach and image
vulnerability work are deferred; they do not displace these acceptance tasks.

## Design boundaries

- Use the existing Stack manifest rather than invent another composition format.
- Explore structural input recognition without interpreting ambiguous intent as a fact.
- Docker Compose intake remains a proposal, not a supported adapter.
- Kubara generates platforms; Workshop can resolve, inspect and check its output.
- Reviewed stacks are examples and starting points, not the limit of new assembly.
- Initial roles are a small extensible vocabulary. Classification is tied to exact
  retained configuration digests and is not a support or compatibility verdict.
- CI triggers precede optional local hooks. Broader port, volume and application
  semantics need explicit contracts before they become checks.
