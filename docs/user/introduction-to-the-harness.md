# Introduction To The Harness

This document explains how a new Helm chart becomes a ConfigHub `cub installer`
recipe in this repo, and how decisions are made about where each part of the
install and customization process belongs.

```text
This is not one prompt.
It is an AI-assisted engineering workflow with mechanical proof.
```

AI helps analyze public Helm charts, draft artifacts, and spot control points.
The workflow decides whether the result is believable by comparing outputs,
binding digests, running scans, checking gates, and recording receipts.

## What To Say When Someone Asks "What Prompt Did You Use?"

Say this:

```text
We do not generate recipes from one prompt. We use AI as an analyst and code
assistant inside a deterministic recipe-construction workflow. The workflow
decides where each Helm behavior belongs, then cub installer and verifiers prove
the result against regular Helm output.
```

Or shorter:

```text
The prompt is less important than the workflow. The AI follows a chart-import
checklist, classifies Helm behavior into installer/ConfigHub control points,
drafts recipe and variant artifacts, then the repo proves or rejects them with
Helm equivalence, digest checks, scans, gates, and live receipts.
```

## Core Flow

The workflow turns this:

```text
public Helm chart
```

into this:

```text
1 Helm chart version
-> 1 core installer recipe/package
-> N curated install variants
-> immutable rendered revisions
-> Helm-equivalence receipts, scans, gates, and live observations
```

The default rule is:

```text
Recipe = reusable chart definition.
Variant = chosen install shape.
Revision = exact rendered object set.
ConfigHub server variant = post-upload operational clone when no new Helm render is needed.
Receipt = proof of what happened.
```

## How A New Recipe Is Generated

1. Pick a public Helm chart and exact version.
2. Lock the chart source and dependency closure.
3. Render with regular Helm under pinned inputs.
4. Analyze the chart for control points: values, dependencies, capabilities,
   hooks, CRDs, generated facts, target facts, raw manifests, `tpl`, RBAC,
   webhooks, storage, and runtime requirements.
5. Draft the core recipe and value model.
6. Choose a small set of useful install variants.
7. Render immutable variant revisions.
8. Compare `cub installer setup` output to regular Helm output.
9. Scan and gate the exact rendered objects.
10. Upload or publish through ConfigHub paths when that lane is being proven.
11. Record receipts and live observations.
12. Promote only when the variant is simple, useful, and mechanically proven.

The AI can help with steps 4-7 and with writing artifacts, but the workflow
checks steps 8-12.

## Where Pieces Go

| Thing found in chart/customization | Where it belongs |
| --- | --- |
| chart URL/version/digest | source lock / recipe |
| chart dependencies | dependency lock / recipe |
| known value paths/schema | value model / recipe |
| pre-install required Secret/ConfigMap/API/StorageClass | recipe requirement, variant target fact binding, and preflight receipt |
| pre-install hook, CRD, webhook, or bootstrap ordering | lifecycle policy, install gate, or blocker |
| generated password/cert/time | generated fact binding before render |
| kube version/API branching | capability profile |
| raw manifests, `tpl`, extra deploy | explicit extension slot, scan/gate, or block |
| replica count, HA, ingress, TLS choice | variant values |
| values file / `--set` overlay | recipe/base variant when it changes rendered objects; ConfigHub variant only when filling existing fields |
| wrapper chart + platform/customer values | managed overlay import with source/dependency/effective-values locks |
| Kustomize overlay that changes resources | recipe/base overlay with digest and rendered diff |
| Kustomize-like small edit to existing Units | ConfigHub function, TransformPaths, MutationSources, and receipt |
| namespace/release name | variant |
| rendered Kubernetes YAML | immutable variant revision |
| scan result | scan receipt bound to rendered digest |
| install approval | install gate |
| post-install test hook or smoke check | test/check action plus hook or observation receipt |
| post-install readiness, Job result, webhook health, PVC binding, drift | observation receipt from cub-scout/GitOps/etc. |

The goal is to absorb Helm weirdness into the model, not hide it in prose. If
the chart does something unusual, it should have a named home, a policy, a
status, and a proof artifact.

## Helm Hook Policy

Helm hooks are cluster-dependent lifecycle actions. They are not ordinary
configuration objects.

The hard boundary is:

```text
Chart -> recipe -> variant -> rendered normal objects can be deterministic.
Hook execution depends on the live target cluster.
```

That dependency is expected. Hook Jobs and hook-managed objects can depend on
RBAC, CRDs, admission webhooks, existing Secrets or ConfigMaps, StorageClasses,
PVCs, API versions, release history, upgrade/install phase, and delete policy.
ConfigHub does not pretend that live execution is deterministic. It makes that
cluster dependence explicit before install.

The top-500 source scan makes this concrete:

```text
54 / 495 scanned public charts use Helm hooks.
42 / 54 hook charts look likely problematic for production lifecycle support.
6 / 54 need review.
6 / 54 look probably benign/test-only.
```

The risk estimate comes from stored hook details: phase, weight, delete policy,
Jobs, CRDs, cluster RBAC, webhooks, APIServices, `lookup`, and generated-fact
signals. The detailed strategy lives in
[Hook Lifecycle Strategy](./hook-lifecycle-strategy.md).

During import, the harness must not execute hooks. It should inventory hook
templates and record:

```text
hook phase
hook weight/order
hook object kind/name
hook delete policy
required RBAC / APIs / CRDs / Secrets / storage
expected side effect
safe-to-automate decision
required observation
```

Each hook then receives a disposition:

| Hook behavior | ConfigHub disposition |
| --- | --- |
| Helm test hook | explicit post-install test/check |
| pre-install setup | preflight, target fact requirement, or install phase action |
| post-install readiness/bootstrap | readiness gate or observation requirement |
| pre-upgrade / post-upgrade | upgrade lifecycle action with upgrade receipt |
| cleanup/delete policy | rollback/delete lifecycle policy |
| CRD/webhook bootstrap | CRD/webhook lifecycle gate plus live observation |
| unclear or unsafe procedure | production blocker until reviewed |

The proof claim must stay precise:

```text
Helm equivalence proves the selected rendered object set.
It does not prove hook execution unless there is a hook/lifecycle receipt.
```

So a production-ready chart with hooks needs at least a hook inventory,
lifecycle policy, target-fact/preflight decision, execution-or-skip receipt,
and observation receipt. A chart can still have a deterministic recipe and
rendered object proof while its hook execution lane is blocked or not yet
supported.

For GitOps delivery, safe hook-like behavior may be translated into Argo CD
sync hooks or sync waves, but only when the semantics match and the translation
gets its own lifecycle receipt. Unsafe or unclear procedural hooks remain
blockers.

## Recipe Or Variant?

Use this split:

```text
Recipe-level:
  chart source
  dependency closure
  value schema and known value paths
  fact requirements
  allowed extension slots
  lifecycle policy
  forbidden or review-only mechanisms

Recipe/base variant-level:
  chosen values
  selected components
  target fact bindings
  capability profile
  generated fact bindings
  explicit overlays
  namespace and release name

ConfigHub server variant-level:
  target / environment / region / customer identity
  labels and annotations
  gates and approvals
  links
  placeholders and TransformPaths
  existing rendered field values
  observation policy
```

Normal Helm-rendered changes such as replica count, HA mode, TLS posture,
cloud/provider settings, CRD posture, or existing-Secret mode become
recipe/base variants. Normal operational changes such as target, environment,
region, labels, gates, links, and already-rendered editable fields become
ConfigHub server variants. Create another recipe only when the chart source,
chart version, umbrella composition, import strategy, or recipe semantics
materially differ.

For product-tier boundaries, see
[Product Support Tiers For Helm Scenarios](./product-support-tiers.md).

## How Decisions Are Checked

A generated recipe is not trusted because the AI wrote it. It is trusted only
when the proof chain passes.

The main checks are:

```text
source lock exists and has stable digest
dependency lock exists
recipe and variant artifacts exist
variant revision binds recipe/effective values/facts/capability/renderer/output
regular Helm render semantically matches cub installer setup output
allowed differences are classified
exact rendered objects are scanned
install gate records allow/warn/block decision
ConfigHub upload or OCI path records proof when used
live observation receipt records what reached a cluster
```

For Redis, an allowed difference is the installer Namespace support object. For
the Redis `default` variant, the rendered Secret is classified as separated by
`cub installer`; for `reuse-existing-secret`, the Secret becomes a target fact
requirement instead of rendered secret material.

## What The Harness Produces

For each promoted chart, expect these artifacts:

```text
recipes/<repo>/<chart>/<version>/
  recipe.yaml
  source-lock.yaml
  dependency-lock.yaml
  helm-plan.yaml
  chart-dossier.yaml
  control-points.yaml
  value-model.yaml
  helm-pain-report.yaml
  variants/<variant>/variant.yaml
  revisions/<variant>/r001/
    variant-revision.yaml
    rendered/release-objects.yaml
    receipts/*

packages/<repo>/<chart>/<version>/
  installer.yaml
  bases/<variant>/*
```

Aggregate proof lives under `data/` and `runs/`. The root `CATALOG.md` is the
human entry point for choosing charts and variants.

## Related Docs

- Public mission and quick start: [README.md](../README.md)
- Short explanation: [how-the-harness-works.md](./how-the-harness-works.md)
- Customization placement algorithm: [customization-algorithm.md](./customization-algorithm.md)
- Current pathway review: [current-pathway-review.md](../planning/current-pathway-review.md)
- Repo consistency review: [repo-consistency-review.md](../planning/repo-consistency-review.md)
- Full execution plan: [agreed-execution-plan.md](../planning/agreed-execution-plan.md)
- Artifact verifier specification: [artifact-verifier-spec.md](../reference/artifact-verifier-spec.md)
