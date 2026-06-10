# Hook Lifecycle Strategy

**UNOFFICIAL/EXPERIMENTAL**

Helm hooks are not ordinary rendered configuration. They are lifecycle actions
that Helm may run before, during, or after install, upgrade, test, rollback, or
delete phases.

The rule is:

```text
Do not execute Helm hooks during recipe import.
Do not hide hooks inside the normal rendered-object proof.
Do not claim hook execution is deterministic without a lifecycle receipt.
```

The hook policy uses the same seven-stage lifecycle as the rest of the harness:

```text
acquire and pin -> render and capture -> shape base variants -> scan and gate
-> settle prerequisites -> publish and deploy -> observe and operate
```

Render parity proves the desired non-hook object set. Hook support starts with
source inventory and becomes a support claim only when the lifecycle route and
receipts exist. The full doctrine is
[Seven-Stage Helm Lifecycle](../reference/seven-stage-helm-lifecycle.md).

For serious chart support, hooks are required lifecycle work. A chart can have
valid render parity while still being unready for production if its hooks are
only inventoried or routed. Production support requires the hook route to be
observed, translated with equivalent lifecycle evidence, or explicitly blocked
with a reason.

## What The Top-500 Scan Shows

The retained source scan is:

```text
data/top500-catalog-analysis/source/source-feature-scan.raw.json
```

It stores more than a hook count: hook examples, phases, weights, delete
policies, Jobs, CRDs, cluster RBAC, webhooks, APIServices, `lookup`, generated
fact signals, and related source features.

Current estimate from the stored top-500 source scan:

```text
charts requested: 500
charts scanned: 495
charts with Helm hooks: 54
total hook templates found: 176

likely problematic hook charts: 42
needs review: 6
probably benign/test-only: 6
```

Risk signals among the 54 hook charts:

```text
non-test lifecycle hooks: 42
post-* hooks: 26
pre-* hooks: 26
hook weights/order: 21
hook delete policies: 44
Job resources: 46
cluster RBAC: 35
CRDs: 22
webhooks: 15
APIService: 6
lookup / cluster facts: 41
```

This means hooks are not most charts, but they are real. Roughly 11% of scanned
public charts use Helm hooks, and most hook-using charts need lifecycle review
before production support.

## Status Vocabulary

Use these states when discussing hook or hook-like lifecycle behavior:

| Status | Meaning |
| --- | --- |
| `inventoried` | The source scan found hook templates or hook-like lifecycle behavior. |
| `render-proven` | The normal non-hook object set is deterministic under recorded inputs. |
| `route-selected` | A candidate handling route is recorded, such as test action, preflight, Argo hook, sync wave, managed action, or blocker. |
| `lifecycle-observed` | The selected route has a receipt with execution or controller behavior, runtime result, timestamp, and freshness. |
| `blocked` | The hook is unsafe, ambiguous, target-dependent, or not yet mapped. |

Do not treat `inventoried` or `render-proven` as lifecycle support.
`route-selected` means the route has been recorded, usually in a route receipt,
but it is still not lifecycle proof until execution or observation evidence
exists. `blocked` is a valid catalog outcome when a hook does not fit the
current model safely.

## Classification

| Hook class | Default disposition |
| --- | --- |
| Helm test hook only | Convert to explicit post-install check/test where useful. |
| `pre-install` / `post-install` | Preflight, target fact requirement, install phase action, readiness gate, or blocker. |
| `pre-upgrade` / `post-upgrade` | Upgrade lifecycle action plus upgrade receipt. |
| Delete or cleanup hook | Delete/rollback lifecycle policy. |
| Hook with weight/order | Preserve ordering through lifecycle policy or sync-wave-style mechanism. |
| Hook with delete policy | Preserve cleanup behavior explicitly or block. |
| CRD/webhook/bootstrap hook | CRD/webhook lifecycle gate plus live observation. |
| Hook depending on lookup, existing objects, RBAC, storage, or release history | Target facts, preflight, managed lifecycle action, or blocker. |
| Unclear procedural hook | Unsupported for production until reviewed. |

## Public Catalog Strategy

For public catalog entries:

```text
inventory hooks
classify hook phase and risk
render normal objects with an explicit hook policy
bind scan/gate findings to the rendered revision
record whether hook behavior is skipped, translated, tested, or blocked
```

The catalog can safely prove:

```text
source chart contains hooks
normal rendered object set has render parity under recorded inputs
hook behavior has an explicit disposition
production support is blocked unless lifecycle proof exists
```

The catalog must not claim:

```text
Helm hook execution was reproduced by normal render equivalence
cluster-dependent hook behavior is deterministic
all hook behavior can be translated automatically
```

Some charts will have hooks that do not fit the first-pass categories cleanly.
The correct behavior is to record the uncertainty and block production support
for that chart/base until the lifecycle route is reviewed and receipted.

## GitOps And Argo Route

When Helm is not the runtime installer, many hook-like behaviors need another
lifecycle surface. The first practical route is GitOps lifecycle handling,
especially Argo CD sync hooks and sync waves where they are safe.

Suggested mapping:

| Helm hook need | Candidate route |
| --- | --- |
| `pre-install` setup Job | Argo `PreSync` hook, explicit preflight, or managed install action. |
| `post-install` smoke test | Argo `PostSync` hook, ConfigHub check, or observation receipt. |
| `pre-upgrade` migration | Argo `PreSync` in an upgrade revision, gated by approval. |
| `post-upgrade` validation | Argo `PostSync` plus observation receipt. |
| hook weight/order | Argo sync waves where semantics match. |
| hook delete policy | Argo hook delete policy or explicit cleanup/rollback policy. |
| unsafe side effect | Block until reviewed. |

Argo translation is not automatic. It is one implementation strategy that must
produce lifecycle receipts and observations.

## Related Lifecycle Observations

Some charts have no Helm hook but still need lifecycle observation because
controllers populate fields or Secrets after apply. External Secrets is the
current example: the chart does not use a Helm hook in the tested bases, but
the controller and webhook flow populate runtime data that rendered YAML alone
cannot prove.

Cert-manager is the opposite cross-lane case. It does have the
`startupapicheck` Helm post-install hook, but the retained top-100 source-scan
row did not flag hooks. The lifecycle lane therefore records cert-manager
explicitly: both `default` and `crds-enabled` model `startupapicheck` as a
post-apply API dry-run and readiness check.

The cert-manager / External Secrets lifecycle lane records this pattern:

```text
data/lifecycle-observations/cert-manager-eso/summary.md
```

That lane is not a claim that all hooks are solved. It proves the receipt shape
for common lifecycle issues: CRD ownership, webhook API readiness, CA bundle
injection, controller-populated Secret data, and server dry-run checks.

The generated boundary page keeps the two claims separate:

[Hook And Lifecycle Boundary](../../data/lifecycle-boundary/summary.md)

## Managed / Commercial Strategy

Hooks can support paid value, but the offer should not be "we run arbitrary
hooks for you." The valuable paid work is lifecycle intelligence and managed
translation:

```text
hook inventory for private or old chart versions
classification of install/upgrade/delete side effects
safe Argo/GitOps lifecycle mapping where possible
preflight and target fact requirements
upgrade/rollback simulation and receipts
blocked-hook remediation recommendations
fresh observation receipts after live execution
evidence pack for audit and change review
```

This fits naturally beside a broader commercial lifecycle-intelligence story:

```text
chart/version inventory
known-risk and breaking-change analysis
annotated rendered-object diffs
upgrade project templates
agent-ready remediation tasks
policy and misconfiguration findings
freshness-aware runtime observations
auditable receipts
```

The differentiation should remain ConfigHub-shaped:

```text
We reason about the exact rendered configuration variants you approve and run.
```

Competitors can summarize Kubernetes upgrade risk. ConfigHub should connect the
risk to concrete recipe inputs, rendered objects, ConfigHub variants, scans,
gates, approvals, observations, and evidence.

## Acceptance Criteria

For any catalog-supported chart with hooks:

- `helm-pain-report.yaml` lists hook pain and disposition.
- `helm-plan.yaml` records hook policy.
- scan/gate receipts include hook findings or explicit test/check mapping.
- production disposition states whether hooks are skipped, translated, tested,
  blocked, or supported by live lifecycle receipts.
- if translated to Argo/GitOps lifecycle, the mapping has its own receipt and
  live observation when cluster behavior matters.
