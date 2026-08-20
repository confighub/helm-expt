# Promotion Workshop test program

Date: 2026-08-15

Status, updated 2026-08-20: the browser review now parses YAML as data, loads a
worked Redis source refresh, accepts the four object sets needed for source-aware
field attribution, carries Catalog prerequisites and lifecycle work into the result,
records one result per target, and generates an AI review prompt plus current
ConfigHub preview commands. A fresh ConfigHub run on 2026-08-20 retained a post-render
edit through a Redis chart upgrade, returned mutation previews for development and
staging, published one reviewed OCI to two Argo CD clusters, closed a rollback
ChangeSet, and verified the rollback on both clusters. A deterministic self-test covers source changes, retained
post-render edits, same-field review, Secret redaction, semantic no-ops, partial
fleets, digest mismatch, and lifecycle-versus-target-fact separation. The real-user
program remains outstanding.

This plan tests one proposed Config Workshop job:

> Given the configuration running now and a proposed change, show what the next
> environment would receive, what could break, and what must be tested before the
> change moves.

The first product is a promotion review, not an automatic production pipeline.
For a known Catalog configuration, the review can use retained chart evidence. For
an unknown configuration, it must mark unknowns and produce a provisional test
plan. A precise refusal is a useful result.

## What must be true

The review is useful only when it does all of the following.

1. Identifies the exact source, candidate, destination, and available digests.
2. Compares rendered Kubernetes objects, not only values files.
3. Separates changes produced by source inputs from edits made after rendering.
4. Shows destination settings that would be retained, changed, or lost.
5. Re-evaluates flattening safety for the exact chart version, base, and values.
6. Names lifecycle work such as hooks, CRDs, certificates, setup jobs, and pruning.
7. Ties test evidence to the exact candidate and target facts it covered.
8. States which checks ran, which did not run, and which require a cluster.
9. Makes zero desired-state changes when a blocker is found.
10. Keeps the free result useful as files, Git evidence, or OCI.

## Result vocabulary

| Result | Meaning |
| --- | --- |
| `pass` | The checks required for this bounded decision passed for the exact candidate. |
| `warn` | The change is understood, but a named decision remains. |
| `blocked` | A prerequisite, required check, policy, or destination fact is missing or failed. |
| `refused` | The requested operation would contradict retained evidence, such as flattening an unsafe base. |
| `stale` | The evidence or preview belongs to an older candidate, destination revision, or target fact set. |
| `partial` | Some targets or runtime checks completed and others did not. |

`safe-to-flatten` is not a promotion result. It says that one audited base can be
shipped as literal YAML without losing the Helm behavior covered by its verdict. It
does not prove upgrade compatibility, storage safety, runtime health, application
behavior, or rollback.

## Current evidence to reuse

The repository already has 90 base-scoped flattening verdicts: 42
`safe-to-flatten`, 32 `flatten-with-routes`, and 16 `unsafe-to-flatten`.

The following existing proofs form the positive baseline.

| Evidence | What it contributes |
| --- | --- |
| `data/redis-upgrade-app-proof/summary.md` | Chart upgrade, retained object edit, development and staging promotion, OCI, two Argo CD clusters, smoke test, and desired-state rollback. |
| `data/byo-helm-values-promotion-proof/summary.md` | AI-reviewed Helm values, a later object edit, and development-to-staging promotion. |
| `data/aicr-variant-promotion-proof/summary.md` | Source-neutral ConfigHub variant and promotion mechanics for AICR objects. |
| `data/apply-policy-profiles/summary.md` | Blocking schema, placeholder, lifecycle-route, Secret, and approval checks, plus advisory image and probe checks. |
| `data/lifecycle-boundary/summary.md` | Chart-specific hook, CRD, webhook, certificate, cleanup, and ordering routes with bounded evidence. |
| `data/flattening-safety/summary.md` | Per-version and per-base decisions about literal YAML, routes, and refusal. |

## First twelve adversarial scenarios

These scenarios give the first implementation enough breadth without pretending to
cover every chart.

| ID | Case | Deliberate change or failure | Expected result |
| --- | --- | --- | --- |
| P01 | `metrics-server@3.13.1/default` | Change an ordinary workload field and retain the audited default settings. | `pass` after object, APIService, capability, and readiness checks. |
| P02 | `metrics-server@3.13.1/default` | Enable `tls.type: helm`, activating lookup and generated certificate behavior that is gated off in the audited base. | `refused` for flat YAML until a separately audited route exists. |
| P03 | `redis@27.0.0/default` | Publish the generated-credential render as a public flat package. | `refused`; recommend an existing-Secret configuration or render-late route. |
| P04 | Redis `25.5.3` to `27.0.0`, existing Secret | Retain a two-replica object edit through development, staging, OCI delivery, and rollback. | `pass` for the bounded path already proved; external Secret and data rollback remain separate. |
| P05 | `cert-manager@v1.21.0/default` | Omit startup API check, CRD ordering, or prune protection from the promotion pack. | `blocked`; name the missing companion route. |
| P06 | `kube-prometheus-stack@87.19.2/default` | Treat the rendered objects as a complete flat deployment and ignore hooks, lookup, webhook certificates, and CRDs. | `refused`; use a chart-specific lifecycle route or keep the render-late path. |
| P07 | Kube Prometheus Stack version upgrade | Keep the CRD count unchanged while changing CRD schemas. | `blocked` until schema compatibility and runtime behavior are tested. |
| P08 | BYO NGINX values | Add a plausible values key that changes no rendered object. | `blocked` as a no-op; identify the correct path or state that the chart does not expose it. |
| P09 | Production destination | Promote a development change while accidentally removing the production external-Secret reference or storage setting. | `blocked`; show the protected destination difference that would be lost. |
| P10 | Exact candidate evidence | Reuse a passing staging receipt after changing one candidate object or OCI digest. | `stale`; require evidence for the new candidate. |
| P11 | Three production targets | Make one target fail after another has confirmed. | `partial`; show every target separately and never report one overall success. |
| P12 | Rollback | Restore desired objects after a database migration or hook side effect. | `warn` or `blocked`; state that object rollback cannot reverse the external effect. |

## AI-written configuration scenarios

The user's AI may explain or propose a fix. It cannot override deterministic
findings.

| Test | Deterministic expectation |
| --- | --- |
| Plausible but nonexistent values path | Render with and without the key. Report no object change and block the claimed result. |
| Inline API key or password | Block the literal credential and identify the Secret reference that should replace it. |
| Existing-Secret mode removed during upgrade | Show the ownership change and block until credential handling is accepted and tested. |
| Namespaced RBAC becomes wildcard cluster RBAC | Show the exact permission expansion and block pending explicit policy approval. |
| Digest-pinned image becomes `latest` | Warn under the current Catalog profile; permit a stricter production policy to block it. |
| Same values, different image digest | Show the object change even though the values diff is empty. |
| PVC shrink or StorageClass replacement | Block and require a data and migration decision. |
| Immutable selector change | Block before apply and explain the replacement boundary. |
| Hook declared automatic without a receipt | Block through the lifecycle-route policy. |
| AI supplies a fabricated green receipt | Reject it when source, candidate, target, or digest identity does not match. |

## Config-as-data failure injection

These tests need ConfigHub Server but not necessarily Kubernetes.

| Test | Required behavior |
| --- | --- |
| Destination edited after preview | Fail on the stale destination revision or recompute visibly. Never overwrite the edit silently. |
| Source changed after the ChangeSet was sealed | Promote the sealed ChangeSet or refuse. Never substitute the moving source head. |
| One ChangeSet adds a Unit and changes another | Apply both as one governed operation or make no desired-state writes. |
| Client times out after server acceptance | Retry with the same operation identity and produce one result. |
| Multi-target operation is interrupted | Resume without duplicating completed target writes. |
| One target conflicts during fan-out | Produce zero writes on the conflicted target and report the aggregate as partial or blocked. |
| Production approval filter leaks into development | Fail the policy-scope test; development must keep common checks without the production-only approval. |
| Target facts change after staging | Mark old evidence stale when Kubernetes APIs, Secret references, region, storage, or another relevant fact changes. |

## Cluster and controller tests

The local review must label these `not run` until a cluster supplies evidence.

1. Apply CRDs first, wait for establishment, then apply dependent resources.
2. Interrupt a hook or setup route and retry it without duplicating harmful work.
3. Check webhook certificate creation and admission readiness.
4. Test external Secrets when absent, present, and changed.
5. Publish the reviewed OCI digest and verify that Argo CD or Flux reconciles that digest.
6. Run an application-specific smoke test, such as Redis write, read, restart, and `PONG`.
7. Change one target fact after rehearsal and prove production is rechecked.
8. Make one fleet target unhealthy and retain the per-target result.
9. Remove an object and verify whether the selected delivery route prunes, preserves, or blocks it.
10. Restore prior desired objects and report every external effect outside the rollback claim.

## Metamorphic and fuzz tests

These tests create many cheap variations while retaining deterministic assertions.

- Reorder YAML documents without changing object identity or content.
- Change formatting and comments without changing semantic objects.
- Mutate one supplied values key at a time and identify keys with no rendered effect.
- Change one protected destination field at a time and require preservation or a visible conflict.
- Replay evidence across chart versions, bases, target profiles, and OCI digests; every replay must fail.
- Remove one lifecycle companion artifact at a time from a route-dependent bundle.
- Toggle values that change a base's flattening lane, such as Helm-managed TLS or generated credentials.
- Replace one exact image digest with a mutable tag.
- Change CRD schema while keeping the CRD count and names unchanged.
- Rename an object so the result is represented as an add and a delete, not a harmless field edit.
- Insert one unknown field under each Kubernetes object kind and separate schema rejection from server-side admission behavior.
- Generate partial fan-out outcomes in every target order so overall status never depends on iteration order.

## New-user simulations

Run the page with at least these starting points:

1. A known Redis Catalog configuration.
2. A private chart not present in the Catalog.
3. Helm values written by Claude or Codex.
4. Two rendered YAML directories with no source information.
5. An OCI artifact whose role is not yet known.
6. An Argo CD Application.
7. A Flux HelmRelease or OCIRepository.
8. A production-only team with no staging environment.
9. An existing Helm release reconstructed from `helm get` output.
10. A hook- and CRD-heavy chart.
11. A three-region deployment with one failing region.
12. An existing Git to CI to OCI to GitOps pipeline that must remain in place.

For every run, record the question in the user's words, the minimum inputs they can
provide, the first useful result, the first point of confusion, and whether the
ConfigHub handoff feels earned.

## Promotion-review pack

The anonymous result should be useful on its own.

~~~text
promotion-review/
  current/              exact objects and source record
  candidate/            exact objects and source record
  destination/          preview and preserved differences
  comparison/           object diff and values-versus-overrides explanation
  checks/               deterministic results and explicitly not-run checks
  chart/                render intent, lifecycle routes, and known risks
  plan/                 promotion plan, test plan, and local AI prompt
  oci/                  input/output digests and provenance when applicable
  ci/                    repeatable verification command
  review.json           summary, identities, result, limits, and next action
~~~

The first ConfigHub call to action appears after this pack exists:

> Keep this exact reviewed result in ConfigHub when you need named environments,
> approvals, promotion history, or live comparisons.

## Graduation criteria

The first public page can provide a useful browser-local promotion review. It must
not present that review as a complete promotion pipeline. A managed or automatic
promotion path is ready for a stronger claim only when it meets these criteria.

1. A Catalog example produces a useful result in under five minutes without an account.
2. A user can state what changes, what remains different, and what blocks promotion.
3. The same candidate and digest appear in the local report, optional OCI, and ConfigHub handoff.
4. Every deterministic seeded failure above produces its expected result.
5. Unsafe and route-dependent charts are not shown as ordinary flat-YAML successes.
6. Cluster checks remain explicitly not run until evidence exists.
7. A stale candidate, target, or receipt causes zero desired-state writes.
8. A partial fleet result names every target and never collapses to a green total.
9. The free result works with Git, CI, Argo CD, or Flux without ConfigHub.
10. ConfigHub adds durable identity, variants, gates, promotion, and observation rather than unlocking a deliberately incomplete free report.

## Checks run while writing this plan

The following committed evidence verified successfully on 2026-08-15.

~~~sh
npm run flattening-safety:verify
npm run lifecycle:boundary:verify
npm run redis-upgrade-app:verify
npm run byo-helm-values:promotion-verify
npm run aicr-variant-promotion:verify
npm run config-catalog:policy:verify
npm run config-catalog:self-test
~~~

Five low-cost agent reviews also simulated 12 new-user visits, 15 chart-specific
promotion attacks, 20 config-as-data failure cases, 12 anonymous-path tests, and 15
AI-written configuration failures. Agent suggestions informed this plan; the
deterministic repository checks above remain the evidence.
