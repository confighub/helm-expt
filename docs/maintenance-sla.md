# Maintenance SLA

This repo separates proof from recommendation.

```text
Proof-grade recipes prove correctness.
Catalog-supported recipes are the recipes we recommend to Helm users.
```

## Supported Artifact Levels

| Level | Meaning | Maintenance Promise |
| --- | --- | --- |
| `proof-grade` | Helm equivalence and receipts pass for tested variants. | Keep verification runnable and digest-bound. |
| `catalog-candidate` | Useful shape, but not yet fully promoted. | Review obvious variants, UX, and upgrade behavior before recommendation. |
| `catalog-supported` | Recommended install path for Helm users. | Re-test on chart updates and keep supported variants current. |
| `deprecated` | Still recorded, no longer recommended. | Preserve receipts; avoid new adoption. |
| `blocked` | Known unsafe, ambiguous, or non-equivalent. | Keep blocker reason and mitigation path visible. |

## Chart Updates

When an upstream chart updates, do not mutate the old approved revision.

Create a new candidate:

```text
chart v1 + variant A -> approved revision r001
chart v2 + variant A -> candidate revision r002
```

Then run:

- source and dependency lock refresh;
- values/schema drift analysis;
- variant re-render;
- rendered object diff;
- Helm equivalence check;
- scan/gate check;
- upgrade-risk classification;
- catalog promotion review if the variant is catalog-supported.

Outcomes:

```text
auto-carry-forward
review-needed
blocked
deprecated
```

Old approved revisions remain valid evidence even if a newer chart changes.

## Variant Updates

When a user requests a new use case, create a variant candidate.

Examples:

```text
existing-secret
ha
external-database
ingress-tls
no-crds
restricted-rbac
cloud-provider-specific
```

The candidate runs through the customization algorithm and catalog promotion
review. Broadly useful variants may become catalog-supported. Customer-specific
variants remain private/local unless promoted deliberately.

## What Must Stay Fresh

For catalog-supported variants, keep these fresh:

- chart version support window;
- Kubernetes capability profiles;
- source and dependency locks;
- scan policy bundle version;
- supported variant list;
- known risks and mitigations;
- install-gate decisions;
- observation requirements where runtime truth matters.

## What Does Not Need To Change

Do not rewrite old proof revisions just because the chart moves on.

Old revisions are historical proof:

```text
this chart version
with these inputs
rendered these objects
passed these checks
at this digest
```

## Public Claims

Allowed:

```text
This recipe is proof-grade.
This variant is catalog-supported.
This rendered revision is Helm-equivalent under the recorded inputs.
This scan/gate result applies to this exact rendered object digest.
```

Avoid:

```text
All chart use cases are covered.
Every future chart version will work automatically.
This replaces all Helm expertise.
Live state is known without a fresh observation receipt.
```

## Current Baseline

The repo currently has:

```text
100 proof-grade recipes/packages
20 bespoke proofs with richer variants
80 generated full proofs with default variants
20 catalog-supported recipes for local-test scope
0 top-20 catalog candidates remaining
```

The next maintenance milestones are to add production dispositions for the
supported local-test recipes, promote selected proof-grade/default charts using
`docs/catalog-promotion-review.md`, and keep old-version patch reviews
repeatable.
