# Blog Post Plan

This is the public-facing story sequence for explaining the Helm experiment
without making the reader learn the internal noun ladder first.

## 1. Stop Approving Helm Guesses

Audience: Helm users who have felt install, upgrade, and audit pain.

Core claim:

```text
Helm is good at producing Kubernetes objects. The operational pain is that
teams often approve values files, not the exact objects those values produce.
```

Show:

- the chart -> recipe -> variant -> rendered objects path;
- why pre-rendering makes Day 0 review and Day 1/Day 2 operation easier;
- Redis as the first small worked example;
- the phrase: "Use Helm charts. Ship ConfigHub variants."

Proof links:

- `README.md`
- `CATALOG.md`
- `docs/demo/redis/demo-script.md`

## 2. Redis In Five Minutes

Audience: practical users asking "what do I run?"

Core claim:

```text
Start from a public Redis chart, render through cub installer, upload to
ConfigHub, inspect Units, and verify your own install with receipts.
```

Show:

- `cub installer setup`;
- `npm run redis:verify-install:render`;
- `kubectl apply`;
- `npm run redis:verify-install:cluster`;
- `cub installer upload`;
- `npm run redis:verify-install:confighub`;
- ConfigHub Unit list, labels, data, diff, scan, approval, and dry-run apply.

Proof links:

- `docs/demo/redis/demo-script.md`
- `recipes/bitnami/redis/25.5.3/CATALOG.md`
- `recipes/bitnami/redis/25.5.3/install-checks.yaml`

## 3. Proof, Not Promises: What The Top-20 Catalog Verifies

Audience: skeptical platform engineers and reviewers.

Core claim:

```text
The catalog is not a screenshot demo. The claims are backed by committed
receipts and verifiers that fail when artifacts drift.
```

Show:

- 20/20 local kind live/e2e receipts;
- 20/20 ConfigHub upload, scan, and safe-ops proof receipts;
- 100 recipe/package proof artifacts;
- tampering self-tests;
- the difference between governance proof, local live/e2e proof, and the
  separate GitOps/OCI live proof lane.

Proof links:

- `data/live-e2e/summary.md`
- `data/production-disposition/summary.md`
- ConfigHub proof receipts under `runs/`
- `npm run verify`

## 4. Variants Are More Than Values Files

Audience: teams that already use multiple Helm values files per environment.

Core claim:

```text
A ConfigHub variant is useful only when it carries exact rendered objects,
labels, scans, receipts, approvals, and operation history.
```

Show:

- root `CATALOG.md` as the human shelf of chart variants;
- Redis `default` and `reuse-existing-secret`;
- NGINX `http-clusterip` and `existing-tls-ingress`;
- PostgreSQL `generated-passwords` and `existing-secret`;
- server-side `cub variant create` for environment/region/customer variants
  after upload;
- how target facts turn "this Secret must exist" into an explicit contract.

Proof links:

- `CATALOG.md`
- `docs/reference/customization-algorithm.md`
- `docs/user/maintenance-sla.md`

## 5. Live Truth Without A Magic Worker

Audience: operators who care about what is actually running.

Core claim:

```text
ConfigHub stores desired/config truth and receipts. Live cluster truth should
arrive as fresh observation receipts from explicit tools.
```

Show:

- what `redis:verify-install:cluster` proves for Redis;
- where cub-scout fits for object-set receipts, drift checks, source truth,
  ownership graphs, snapshots, and GitOps convergence evidence;
- why freshness is part of the claim.

Proof links:

- `runs/redis-local-kind/latest/observation-receipt.yaml`
- `data/live-e2e/summary.md`
- `https://github.com/confighub/cub-scout/tree/main/examples/helm-expt`

## 6. The Hard Charts Are The Point

Audience: Helm experts who know real charts include hooks, CRDs, lookups,
generated secrets, globals, `tpl`, and raw manifest slots.

Core claim:

```text
We do not need to pretend Helm charts are simple. We need to surface each pain
point and map it to a recipe, fact, capability profile, lifecycle policy,
scan, gate, or blocker.
```

Show:

- the adversarial-10 chart set;
- CRDs, hooks, target facts, generated facts, capability profiles, extension
  slots, and scan/gate warnings;
- how the top-500 catalog analysis is planning data, not certification theater.

Proof links:

- `docs/corpus/known-adversarial-charts.md`
- `data/adversarial10/summary.md`
- `data/top500-catalog-analysis/summary.md`

## 7. Catalog Maintenance, Old Versions, And Patch Value

Audience: customers who need maintained, boring, production-relevant install
paths rather than one-off demos.

Core claim:

```text
A useful catalog needs promotion review, production disposition, upgrade
checks, and support for important old versions, not just latest-chart demos.
```

Show:

- catalog promotion review;
- production disposition;
- legacy patch review;
- how new customer use cases become new variants or new support work orders.

Proof links:

- `docs/planning/catalog-promotion-review.md`
- `docs/user/maintenance-sla.md`
- `docs/planning/legacy-patch-review.md`
- `data/legacy-patch-review/summary.md`

## 8. GitOps Handoff: ConfigHub OCI To Argo CD Or Flux

Audience: teams that already use Argo CD or Flux and do not want a second
deployment controller.

Core claim:

```text
ConfigHub should make the reviewed rendered object set available through OCI,
then let the customer's existing GitOps controller sync it.
```

Status:

```text
The live GitOps/OCI proof lane exists as a separate Pilot/cub-scout path. This
post should make that proof easy to understand and link from the Helm catalog
story, without folding live-cluster requirements into the local npm verifier.
```

Show:

- ConfigHub OCI artifact as the handoff point;
- Argo CD or Flux pulling the same reviewed rendered object set;
- cub-scout or controller receipts proving convergence;
- no claim that ConfigHub Server is a hidden cluster worker.

Proof links:

- `docs/planning/pilot-adversarial-testing.md`
- GitHub issue `#12` for GitOps compatibility reporting
- `https://github.com/confighub/cub-scout/tree/main/examples/helm-expt`
