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
Explain the problem and show the happy path.
```

Content:

- short statement of the Helm pain;
- `chart -> recipe -> variants -> rendered objects -> proof receipts`;
- one Redis demo path;
- proof counters: top-20 live e2e, 100 recipe/package artifacts, top-500
  analysis;
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
- pain/risk summary;
- install/download action.

Data source:

```text
CATALOG.md
recipes/*/*/*/CATALOG.md
data/production-disposition/top20.csv
data/latest-top20-refresh/review.csv
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
- previous-version/legacy-patch link when relevant.

Data source:

```text
recipes/<repo>/<chart>/<version>/
runs/<chart>-confighub-proof/latest/
runs/top20-local-kind/<chart-variant>/
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

## Website UX Doctrine

- Lead with the happy path, not the artifact taxonomy.
- Show charts first, variants underneath.
- Every claim links to a receipt or generated artifact.
- "Latest available" and "supported proof version" must be visibly separate.
- If a chart is popular but production-disposition-blocked, say so clearly.
- Keep Kubara/private-overlay workflows out of the free public catalog unless
  they are explicitly marked managed examples.

## First Website Slice

Build the website from generated repo data:

```text
/                       home
/catalog                chart catalog
/catalog/redis          Redis chart page
/catalog/redis/default  Redis default variant page
/proof                  how the harness works
/docs                   selected doctrine links
```

The Redis page should be the polished first demo. The next chart pages should be
NGINX, PostgreSQL, cert-manager, ingress-nginx, and kube-prometheus-stack.
