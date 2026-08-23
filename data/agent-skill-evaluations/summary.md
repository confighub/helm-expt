# Config Workshop agent skill evaluations

This evaluation checks whether a new coding agent can use the Config Workshop
skill to answer practical configuration questions without changing a cluster or
uploading private data.

## Run

- Date: 2026-08-23
- Mode: fresh ephemeral sessions, read-only checkout, no web access, no cluster
- Models: GPT-5.4-Mini for the first two cases; GPT-5.3-Codex-Spark for the final rerun
- Skill: `skills/config-workshop/SKILL.md`
- Task contract: `tests/agent-skills/config-workshop/evals.json`

## Results

| Case | Result | What the agent did | What changed afterward |
| --- | --- | --- | --- |
| Find the Redis 25.5.3 existing-Secret configuration | pass with documentation finding | Selected `reuse-existing-secret`, named the required Secret, separated render evidence from production readiness, and retained the scan warnings. | Narrow `jq` lookup examples were added. A stale 25.5.3 evidence pointer that resolved to a 27.0.0 receipt was replaced with the matching retained receipt. |
| Explain the Timoni Redis 8.10.1 entry | pass | Identified the immutable module and seven exact objects, then explained the master-first wait, optional test, destination requirements, and checks that have not run. | No model change was needed. |
| Distinguish source OCI from deployable configuration | partial, then pass | The first answer separated the source and object digests but did not make route resolution a firm precondition for Argo CD. The rerun named every remaining step before delivery. | The skill now states that publishing configuration OCI does not execute lifecycle routes. |

The final response hashes were:

- Redis known answer: `72b64894f20d79b8cf86b8fcb5e06d6c27018d49c2939cca16e8e0451c036bb7`
- Timoni lifecycle answer: `dc00bbfdf6bb2f2d6276734bfe1bed5e9263476fc828b8ffe8a97d1a08656f3a`
- OCI-role rerun: `6f04e1f4ef9f81943ac515784043af0188b458685ce10bf9c9e731ddc6b7d82f`

## Limit

These three runs test source resolution, lifecycle explanation, and OCI-role
separation. They do not prove every task in the seven-case contract, every agent,
or live deployment behavior. The static skill verifier checks the complete task
contract but does not claim that an agent completed those tasks.
