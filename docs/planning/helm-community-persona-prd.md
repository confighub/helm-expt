# Helm Community Persona PRD

**Status:** experimental planning document.

## Purpose

This project should make experienced Helm users believe that ConfigHub is the
safest way to operate popular public Helm charts after day 0.

The entry point is simple:

```text
Use Helm charts. Ship ConfigHub variants.
```

The product value is not only pre-rendering Helm. Rendering creates the first
trust boundary: the user can see the exact Kubernetes objects. The larger value
is what happens after that: base variants, derived ConfigHub variants, scans,
gates, promotion, observation, upgrade review, and blast-radius control.

## Product Promise

```text
Correct variants, safe operations, immediate proof.
```

For a Helm user, that means:

- choose a reviewed base variant instead of inventing a values file from scratch;
- see the exact objects before install;
- create environment, region, customer, or target variants without rerendering
  Helm unless the object shape changes;
- scan and gate the objects that will actually be delivered;
- promote changes in controlled waves;
- show receipts for render, upload, apply, GitOps sync, and live observation;
- know when a chart needs target facts, lifecycle policy, or manual production
  review.

## Personas

### 1. Helm User Trying A Popular Chart

This user wants Redis, NGINX, Prometheus, or another common chart to work
without learning a new platform first.

They need:

- a clear catalog page;
- a small set of recommended base variants;
- local verification that the artifact is what the catalog claims;
- a live proof path that does not require handing over private data.

Free value:

- browse public catalog entries;
- inspect rendered objects, variants, pain reports, and receipts;
- pull or download public artifacts with digest and signature checks where
  available;
- run local verification.

Paid or authenticated value begins when the user wants private variants,
production records, long-lived receipts, or organization workflows.

Success signal:

```text
I can try the chart as quickly as Helm, but I can see and prove more.
```

### 2. Application Team Or Service Owner

This user owns an application and needs dev, staging, and production variants.
They care less about Helm internals and more about safe changes.

They need:

- a base variant that matches their install shape;
- a derived ConfigHub variant for target, namespace, region, secret reference,
  labels, approvals, and observation policy;
- a small preview of what changed;
- checks before the variant can be approved or applied.

Free value:

- public base variants and examples.

Paid or authenticated value:

- storing private variants in ConfigHub;
- team approval flows;
- target-bound variants;
- private values and secret references;
- audit history.

Success signal:

```text
I can create prod from a reviewed base and see the few changes that matter.
```

### 3. Platform SRE Or Fleet Operator

This user manages many clusters, environments, or tenants. They do not want
uncontrolled fanout from raw Helm values.

They need:

- variant inventory across chart, component, environment, region, target, and
  version;
- bulk scan, bulk patch, and bulk promotion with explicit scope;
- wave-based rollout;
- clear blast-radius summaries before any operation;
- live freshness and drift evidence after delivery.

Free value:

- public examples showing how fanout is controlled.

Paid or authenticated value:

- private fleet inventory;
- bulk operation execution;
- policy and compliance rollups;
- promotion waves;
- SLO-based observation receipts.

Success signal:

```text
I can change 100 variants without guessing which clusters or objects are in scope.
```

### 4. Security, Compliance, Or Audit Reviewer

This user needs proof that the reviewed object set is the object set that was
scanned, approved, published, and observed.

They need:

- rendered object digests;
- scan receipts bound to those digests;
- gate decisions and approvals;
- image, RBAC, CRD, webhook, hook, and secret handling notes;
- observation receipts with freshness.

Free value:

- public chart pain reports;
- public scan/gate examples;
- signed or digest-pinned artifacts when available.

Paid or authenticated value:

- organization policy packs;
- private scan evidence;
- compliance reports;
- retention, signatures, and audit export.

Success signal:

```text
I can prove which objects were checked and what was observed later.
```

### 5. GitOps Operator

This user already runs Argo CD or Flux and does not want ConfigHub to replace
the controller.

They need:

- OCI or Git handoff that GitOps controllers can consume;
- digest-pinned desired state;
- controller sync evidence;
- a clear boundary between ConfigHub proof and GitOps reconciliation.

Free value:

- public GitOps examples and local verification.

Paid or authenticated value:

- private OCI access;
- signed release artifacts;
- target assignments;
- GitOps import and runtime receipts across clusters.

Success signal:

```text
I can keep Argo or Flux, but the input becomes reviewed and provable.
```

### 6. Chart Or Managed-Service Catalog Maintainer

This user maintains a catalog of charts, wrapper charts, platform overlays, or
customer-specific managed service packages.

They need:

- an import path from chart plus values plus dependency closure into a durable
  installer package;
- per-chart pain reports;
- weirdness and mitigation notes;
- base variants for common render-time choices;
- derived variants for post-render customer and target differences;
- refresh and patch review for old chart versions.

Free value:

- public methodology and examples for popular charts.

Paid or authenticated value:

- private chart import;
- private overlays;
- old-version patch support;
- managed catalog review;
- custom lifecycle migration for hooks and CRDs.

Success signal:

```text
I can turn maintained Helm usage into a supported catalog, not a pile of values files.
```

## Product Boundaries

### Free Or Public

The public experience should show enough value that a Helm user can trust the
model before signing up for a production workflow:

- public catalog browsing;
- public chart pain reports;
- public base variants;
- local verification;
- live examples where practical;
- signed or digest-pinned public artifacts where available;
- rate-limited or authenticated public OCI pulls if ConfigHub provides the
  gateway.

Anonymous browsing can be useful. Anonymous production infrastructure is not a
goal. OCI pulls should be protected with rate limits, scoped credentials, or
other abuse controls when ConfigHub operates the gateway.

### Paid Or Managed

Paid value begins where the user asks ConfigHub to store, govern, operate, or
support private or production state:

- private charts and private values;
- customer overlays and wrapper charts;
- private OCI artifacts;
- derived ConfigHub variants;
- approvals, gates, and audit history;
- fleet-wide scan, patch, and promotion;
- live observation receipts across many targets;
- old-version patch SLAs;
- commercial support for hook, CRD, storage, and upgrade complexity.

## Main UX Requirement

Users should not be forced to learn every proof artifact before they get value.
The public path should route them by intent:

| Intent | First page or action |
| --- | --- |
| I want to try a chart | Catalog entry with recommended variants |
| I want to deploy safely | Base variant plus verify-your-install path |
| I want prod from staging | Derived ConfigHub variant and promotion guide |
| I operate many clusters | Bulk operation and blast-radius guide |
| I need audit evidence | Receipts, scans, gates, and observation freshness |
| I have private values | Managed import and private overlay path |

The proof remains available underneath each path, but the user should first see
the chart, the variants, the operation, and the expected result.

## Success Metrics

- A first-time Helm user can identify the right Redis or Prometheus variant in
  less than two minutes.
- The user can tell whether a choice is a base variant, a derived ConfigHub
  variant, or a managed/private import case.
- Each top-20 chart shows its variant choices, pain report, live status, and
  production disposition.
- Bulk operations show the selected scope and blast radius before mutation.
- Day-1 and day-2 guides explain promotion, scanning, patching, and observation
  more prominently than pure render tests.
- Public docs separate current capability from planned or paid capability.
