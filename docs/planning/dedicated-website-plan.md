# Dedicated Website Plan

The GitHub repo proves the work. A dedicated website should make the work easy
to understand and try.

## Goal

The website should answer three questions in under a minute:

```text
Why is this better than using Helm alone?
Which chart and variant should I start with?
What proof exists that it works?
```

It should also answer the next operational question without sending the reader
back into the repo:

```text
What do I do after the first install?
```

The answer should be concrete: upload or deliver through ConfigHub, inspect
Units, compare variants, run scans, approve changes, observe live state, and
know when a chart needs managed support rather than public-catalog use.

It should not expose the full internal noun ladder first. The first impression
should be:

```text
Use Helm charts.
Ship ConfigHub variants.
Get correct variants, safe operations, immediate proof.
```

## Primary Pages

### 1. Home

Purpose:

```text
Explain the problem, show the happy path, and separate free public use from
managed ConfigHub operations.
```

Content:

- the promise: use public Helm charts, but make the resulting config explicit,
  variant-aware, reviewable, and observable;
- a five-stage adoption ladder:
  `cub helm template`, `cub helm install`, public `cub installer` catalog
  package, live parity proof, ConfigHub operations;
- proof counters drawn from generated status data, not hand-edited numbers;
- a "what is not claimed" link next to the proof counters;
- three start buttons: inspect catalog, try Redis, read the serious-chart proof;
- clear note that Helm remains the source chart ecosystem.

### 2. Catalog

Purpose:

```text
Show what a user can install or inspect.
```

Content:

- chart cards grouped by category;
- recommended first variant;
- supported variants;
- chart version and latest-version status;
- proof status;
- complete-core status and missing lanes;
- hook, CRD, webhook, secret, storage, and extension-slot flags;
- pain/risk summary;
- free/managed route: public catalog, promotion review, better base needed,
  limitation decision, or managed overlay;
- install/download action.

Data source:

```text
data/master-catalog-matrix/matrix.csv
data/chart-use-guide/chart-use-guide.csv
data/top100-user-readiness/readiness.csv
data/production-support-decisions/decisions.csv
recipes/*/*/*/CATALOG.md
```

### 3. Chart Page

Purpose:

```text
Turn one chart into a confident install decision.
```

Content:

- chart/version/source digest;
- supported variants;
- "what Helm pain this absorbs";
- rendered object inventory;
- regular Helm equivalence result;
- scan/gate status;
- live e2e evidence;
- ConfigHub proof receipts;
- known production dispositions;
- hard quirks and the exact route for each: rendered, target fact, lifecycle
  route, observed, blocked, refused, or not applicable;
- previous-version/legacy-patch link when relevant.

Data source:

```text
recipes/<repo>/<chart>/<version>/
runs/<chart>-confighub-proof/latest/
runs/top20-local-kind/<chart-variant>/
data/master-catalog-matrix/matrix.csv
data/hook-disposition/top100-hook-dispositions.csv
```

### 4. Variant Page

Purpose:

```text
Show exactly what a variant changes and how to operate it.
```

Content:

- variant purpose;
- effective values and target facts;
- object count and diff from another variant;
- rendered objects;
- secret handling;
- checks and receipts;
- post-render Creator options where available.

The page should make the base/derived boundary visible:

```text
Base variant: changes Helm render input or object shape.
Derived ConfigHub variant: changes target, labels, approvals, links, scans,
or selected post-render fields after upload.
Delivery prerequisite: changes what must exist before Argo/Flux/apply can
converge.
```

### 5. Proof Page

Purpose:

```text
Make skeptical reviewers trust the catalog.
```

Content:

- how the harness works;
- invariants and golden checks;
- tampering self-tests;
- regular Helm versus `cub installer` comparison;
- live e2e doctrine;
- GitOps/runtime observation lane;
- hook and lifecycle disposition vocabulary;
- sceptic tests: claims register, blast-radius accuracy, torture fixtures,
  environment matrix, refresh survival;
- latest-version refresh policy.

### 6. Docs

Purpose:

```text
Keep deeper doctrine available without overwhelming first-time users.
```

Start with:

- How The Harness Works;
- Introduction To The Harness;
- Customization Algorithm;
- Variant Creator / Promotion;
- Kubara Customized Overlays;
- Hook Lifecycle Strategy;
- Product Support Tiers.

## Free / Authenticated Boundary

The website can allow low-friction browsing without letting anonymous users
abuse infrastructure:

| Mode | User value | Boundary |
| --- | --- | --- |
| Anonymous browse | view catalog, variants, proof, public digests | static pages only |
| Anonymous pull/download | inspect prebuilt public artifacts | rate-limited, signed public artifacts, no private inputs |
| Email/authenticated free | create a small custom public import or sandbox render | account rate limits, signatures, receipts |
| Paid/managed | private charts, private overlays, Kubara-style managed apps, legacy patches, support SLAs | ConfigHub Server, gates, receipts, support policy |

The free path must be genuinely useful. It should let a Helm user inspect a
popular chart, pull a public package, run the verifier, and understand the
supported variants without needing a sales conversation. Authentication becomes
necessary when the service stores private inputs, creates private variants,
uses managed compute, publishes to managed OCI, or provides support/SLA.

## Website UX Doctrine

- Lead with the happy path, not the artifact taxonomy.
- Show charts first, variants underneath.
- Every claim links to a receipt or generated artifact.
- "Latest available" and "supported proof version" must be visibly separate.
- If a chart is popular but production-disposition-blocked, say so clearly.
- Keep Kubara/private-overlay workflows out of the free public catalog unless
  they are explicitly marked managed examples.
- Make hard cases visible early. Kube-prometheus-stack should be the serious
  chart proof, not an appendix.
- Do not make proof receipts feel like the product. The product path is choose,
  install, inspect, verify, operate. Receipts are the evidence behind it.
- Do not imply that signatures equal safety. Signatures prove integrity and
  origin; scans, policies, support scope, and live receipts carry safety
  claims.

## First Website Slice

Build the launch website from generated repo data:

```text
/                       home
/catalog                chart catalog
/catalog/redis          Redis chart page
/catalog/redis/default  Redis default variant page
/catalog/kube-prometheus-stack serious chart page
/proof                  how the harness works
/status                 master matrix / proof status
/pricing-or-tiers       free, authenticated, managed, enterprise
/docs                   selected doctrine links
```

The Redis page should be the polished first demo. NGINX should show the small
web/live path. Kube-prometheus-stack should show the serious chart proof. The
next chart pages should be PostgreSQL, cert-manager, External Secrets,
ingress-nginx, and Argo Rollouts.

Launch acceptance:

- the home page explains the value without using internal harness vocabulary;
- the catalog page can be filtered by "ready to try", "needs prerequisites",
  "operator review", "needs better base", and "not ready";
- every chart page links to source chart URL, recipe URL, package base, variant
  file, proof receipts, known quirks, and next action;
- the status page shows generated timestamp, matrix link, and top residues;
- the proof page includes the current hard limits, not only successes;
- all pages are generated or verified by `npm run site:verify`.
