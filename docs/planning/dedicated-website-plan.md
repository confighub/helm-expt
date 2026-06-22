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

The answer should be concrete: choose or create variants, upload or deliver
through ConfigHub, inspect Units, compare variants, run scans, approve changes,
observe live state, operate custom apps and stacks, and know when a chart needs
managed support rather than public-catalog use.

Website work should be checked with the persona UX strategy:
[persona-ux-strategy.md](../../tests/persona-ux-strategy.md). That audit uses
novice, Helm-fluent, GitOps, SRE, maintainer, AI-curious, and skeptical-reviewer
personas to test whether the public site is understandable before users reach
the proof surfaces.

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
- start buttons: inspect catalog, try Redis, open variants, open apps and
  operations, and read the serious-chart proof;
- clear note that Helm remains the source chart ecosystem.

### 2. Helm Catalog

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

Detailed spec: [per-chart-fact-sheet-spec.md](./per-chart-fact-sheet-spec.md) -
the full section list, the exact data source per item, a solid /
needs-more-testing status for each, and the "level of support vs evidence depth"
rule.

### 4. Variants

Purpose:

```text
Explain base variants, derived ConfigHub variants, promotion, and the boundary
between render-time choices and post-render refinements.
```

Content:

- when to create a base variant;
- when to create a derived variant;
- when to go back to the recipe/import path;
- first command flow: `cub installer setup`, upload, `cub variant create`,
  `cub variant promote --dry-run`;
- links to Redis, Prometheus, kube-prometheus-stack, and promotion receipts;
- honest note that promotion proof is row-specific and must stay visible in
  the matrix.

```text
Base variant: changes Helm render input or object shape.
Derived ConfigHub variant: changes target, labels, approvals, links, scans,
or selected post-render fields after upload.
Delivery prerequisite: changes what must exist before Argo/Flux/apply can
converge.
```

Current generated page:

```text
site/variants.html
```

### 5. Apps

Purpose:

```text
Show what happens after the first install: public charts, custom apps, stacks,
and platform groups become one managed desired-state graph with variants and
promotion.
```

Content:

- six-stage path from inspect to serverless try-out to sign-up to server
  try-out to day-2 operations to managed/private use;
- explicit Day 0 / Day 1 distinction for public charts, custom apps, stacks,
  platform groups, variants, and promotion;
- links to variants, custom apps, operations, private paths, and chart pages;
- clear free/account/paid boundary.

Current generated page:

```text
site/journey.html
```

### 6. Custom Apps And Stacks

Purpose:

```text
Provide a deeper example inside Apps for cases where a real application
is several public charts plus a custom service, wrapper chart, overlay values,
private inputs, target facts, or existing live state.
```

Content:

- where each piece belongs: public chart, custom app Unit, wrapper chart,
  overlay values, derived variant, private catalog;
- Day 0 composition versus Day 1 change management;
- links to the managed overlay golden, app-readiness surface, custom overlays
  guide, and private paths;
- clear note that private sources and production responsibility are managed
  product lanes.

Current generated page:

```text
site/custom-apps.html
```

### 7. Ops

Purpose:

```text
Turn the strongest post-render product functions into one readable product
page: scans, gates, delivery, observation, adoption, upgrades, rollback, bulk
patching, and fleet operations.
```

Content:

- operation cards with status, boundary, command, value, and evidence link;
- bulk scan, bulk patch, fleet operations, upgrade, rollback, and observation
  as productisation targets;
- clear note that variants and promotion are application SDLC, while operations
  makes releases governed and observable;
- clear watch/planned wording where receipts or product implementation are not
  complete.

Current generated page:

```text
site/operations.html
```

### 8. FAQ

Purpose:

```text
Answer hard skeptical questions without making the first screen a proof lab.
```

Content:

- hooks, secrets, target prerequisites, GitOps false green, upgrades, custom
  values, free versus managed, and what is not claimed;
- any unanswered question becomes a P1 hard-question issue rather than vague
  copy.

Current generated page:

```text
site/hard-questions.html
```

### 9. Docs

Purpose:

```text
Keep deeper doctrine available without overwhelming first-time users.
```

Start with:

- choose your path;
- choosing commands;
- creating variants;
- custom overlays;
- verification lanes;
- hook lifecycle strategy.

Current generated page:

```text
site/docs.html
```

### 10. Database And Deep Proof

Purpose:

```text
Make skeptical reviewers trust the catalog without turning proof into the main
product navigation.
```

Content:

- Helm Catalog links to `site/matrix.html` as the current database of supported
  charts and variants;
- Docs links to generated evidence and claims register;
- `site/proof.html` remains a deep reviewer reference, not a main menu item;
- proof counters and generated status should come from generated data, not
  hand-maintained copy.

Current generated pages:

```text
site/matrix.html
site/proof.html
```

## Productisation And Test Roadmap

The website should track the features that carry the most product value, not
only the proof lanes. Each feature needs accommodation, tests, and a product
surface.

```text
public page -> concise user flow -> evidence surface -> verifier or receipt -> product surface
```

| Feature | Public accommodation | Test or evidence | Productisation target |
| --- | --- | --- | --- |
| Variants and promotions | `site/variants.html`, `site/journey.html`, chart pages, matrix variant rows. | Variant promotion receipts and `cub variant` command-surface checks. | UI/CLI flow for base selection, derived variant creation, preview, checks, approval, and promotion as application SDLC. |
| Apps, custom apps, and stacks | `site/journey.html`, `site/custom-apps.html`, private boundary, overlay examples. | Managed overlay golden, app-readiness surface, import/adoption receipts. | Private catalog/import workflow for wrapper charts, customer values, internal services, and application release. |
| Bulk scan, bulk patch, and fleet ops | `site/operations.html`, Docs links, fleet/blast-radius evidence. | Bulk tutorial, blast-radius fleet, cub-scout desired-vs-live design, future fleet receipts. | Server-backed fleet inventory, bulk changesets, policy gates, wave rollout, and audit after the application graph exists. |
| Upgrade and crash prevention | FAQ, serious-chart proof, future upgrade example page. | Old/new render diffs, CRD upgrade delta, workload upgrade rehearsals, refresh-survival data. | Managed upgrade campaign: candidate version, blast radius, rehearsal, approvals, rollout, rollback, receipt pack. |
| Target prerequisites and lifecycle routes | Helm Catalog ConfigHub Actions section, FAQ, chart pages, matrix hard-gap fields. | Target-prerequisite action packets, lifecycle-route actions, hook dispositions, live observations. | Preflight UX and machine-readable action packets for CLI, UI, agents, and fleet runs. |
| Matrix/database reading | Helm Catalog intro and Docs database section. | `master-matrix:verify`, matrix completion audit, chart-use guide. | Future Database page/menu item if browsing/filtering becomes a first-class product surface. |

Planning docs should stay private/internal unless they are distilled into one
of these product pages. Proof data is the evidence underneath; the public
product path should stay chart-first, application-first, and operation-aware.

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
