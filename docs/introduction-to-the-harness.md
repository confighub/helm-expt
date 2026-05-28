# Introduction To The Harness

This document explains how a new Helm chart becomes a ConfigHub/cub installer
recipe in this repo, and how decisions are made about where each part of the
install and customization process belongs.

The important point:

```text
This is not one prompt.
It is an AI-assisted engineering harness with mechanical proof.
```

AI helps analyze public Helm charts, draft artifacts, and spot control points.
The harness decides whether the result is believable by comparing outputs,
binding digests, running scans, checking gates, and recording receipts.

## What To Say When Someone Asks "What Prompt Did You Use?"

Say this:

```text
We do not generate recipes from one prompt. We use AI as an analyst and code
assistant inside a deterministic recipe-construction workflow. The workflow
decides where each Helm behavior belongs, then cub install and verifiers prove
the result against regular Helm output.
```

Or shorter:

```text
The prompt is less important than the harness. The AI follows a chart-import
checklist, classifies Helm behavior into installer/ConfigHub control points,
drafts recipe and variant artifacts, then the repo proves or rejects them with
Helm equivalence, digest checks, scans, gates, and live receipts.
```

## Core Flow

The harness turns this:

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
Recipe = reusable chart contract.
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
8. Compare `cub install setup` output to regular Helm output.
9. Scan and gate the exact rendered objects.
10. Upload or publish through ConfigHub paths when that lane is being proven.
11. Record receipts and live observations.
12. Promote only when the variant is simple, useful, and mechanically proven.

The AI can help with steps 4-7 and with writing artifacts, but the harness
checks steps 8-12.

## Where Pieces Go

| Thing found in chart/customization | Where it belongs |
| --- | --- |
| chart URL/version/digest | source lock / recipe |
| chart dependencies | dependency lock / recipe |
| known value paths/schema | value model / recipe |
| required Secret/ConfigMap/API/StorageClass | recipe requirement + variant target fact binding |
| generated password/cert/time | generated fact binding before render |
| kube version/API branching | capability profile |
| hooks/CRDs/install phases | lifecycle policy / gate |
| raw manifests, `tpl`, extra deploy | explicit extension slot, scan/gate, or block |
| replica count, HA, ingress, TLS choice | variant values |
| namespace/release name | variant |
| rendered Kubernetes YAML | immutable variant revision |
| scan result | scan receipt bound to rendered digest |
| install approval | install gate |
| live cluster result | observation receipt from cub-scout/GitOps/etc. |

The goal is to absorb Helm weirdness into the model, not hide it in prose. If
the chart does something unusual, it should have a named home, a policy, a
status, and a proof artifact.

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

Variant-level:
  chosen values
  selected components
  target fact bindings
  capability profile
  generated fact bindings
  explicit overlays
  namespace and release name
```

Normal changes such as namespace, replica count, HA mode, TLS posture,
cloud/provider settings, or existing-Secret use become variants. Create another
recipe only when the chart source, chart version, umbrella composition, import
strategy, or recipe semantics materially differ.

## How Decisions Are Checked

A generated recipe is not trusted because the AI wrote it. It is trusted only
when the proof chain passes.

The main checks are:

```text
source lock exists and has stable digest
dependency lock exists
recipe and variant artifacts exist
variant revision binds recipe/effective values/facts/capability/renderer/output
regular Helm render semantically matches cub install setup output
allowed differences are classified
exact rendered objects are scanned
install gate records allow/warn/block decision
ConfigHub upload or OCI path records proof when used
live observation receipt records what reached a cluster
```

For Redis, an allowed difference is the installer Namespace support object. For
the Redis `default` variant, the rendered Secret is classified as separated by
`cub install`; for `reuse-existing-secret`, the Secret becomes a target fact
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
- Customization placement algorithm: [customization-algorithm.md](customization-algorithm.md)
- Current pathway review: [current-pathway-review.md](current-pathway-review.md)
- Repo consistency review: [repo-consistency-review.md](repo-consistency-review.md)
- Full execution plan and doctrine: [agreed-execution-plan.md](agreed-execution-plan.md)
- Artifact verifier contract: [artifact-verifier-spec.md](artifact-verifier-spec.md)
