# Pilot Adversarial Testing

This runbook tells Pilot how to attack the 20-chart proof set.

The goal is not to confirm our story politely. The goal is to find the first
place where the story is false, unclear, too risky, or not yet supported by
evidence.

Current proof claim:

```text
Public Helm charts can be rendered into cub installer packages with clear
variants, receipts, scans/gates, deterministic checks, and Helm-equivalent
output where equivalence is expected.
```

Live-cluster claim, still to prove:

```text
Selected variants can be installed into isolated Kubernetes clusters and
observed safely, with failures recorded as explicit chart or environment
requirements rather than hidden Helm pain.
```

## Local Pilot

Use the ConfigHub Pilot checkout on this laptop:

```text
/Users/alexis/code/confighub-ai-demo
```

The repo-local front door is:

```sh
/Users/alexis/code/confighub-ai-demo/scripts/pilot
```

Start with the automated read-only package gate over all 20 current installer
packages:

```sh
npm run pilot:adversarial
```

To also run the full helm-expt verifier first:

```sh
npm run pilot:adversarial:with-verify
```

The runner writes receipts under:

```text
runs/pilot/<run-id>/
```

Expected first result:

```text
20/20 installer render previews ready
20/20 installer e2e gates in WATCH, waiting for live target-access,
ConfigHub upload/proof, OCI/GitOps, GUI, and Kubernetes runtime receipts
```

`WATCH` is not failure at this stage. It means Pilot has accepted the local
package shape and is correctly refusing to claim live success until the live
proof receipts exist.

This step is **not** a live e2e test. It is the offline Pilot gate before a
live run:

```text
current step: package inspection + render preview + e2e proof gate
separate live lane: ConfigHub upload, OCI/GitOps handoff, Kubernetes apply,
runtime observation
```

Call a run "live e2e" only after it includes target-access proof, a disposable
cluster, ConfigHub proof, OCI/GitOps/controller proof where relevant, exact
Kubernetes runtime observation, and cleanup/closeout receipts.

Useful single-chart probes:

```sh
cd /Users/alexis/code/confighub-ai-demo
./scripts/pilot start \
  --repo /Users/alexis/code/helm-expt \
  --task-brief-file /Users/alexis/code/helm-expt/docs/pilot-adversarial-testing.md \
  --out-dir /tmp/helm-expt-pilot-start \
  --json

./scripts/pilot installer-render-preview \
  --source /Users/alexis/code/helm-expt/packages/bitnami/redis/25.5.3 \
  --out-dir /tmp/helm-expt-pilot-redis-preview \
  --json

./scripts/pilot installer-e2e-gate \
  --source /Users/alexis/code/helm-expt/packages/bitnami/redis/25.5.3 \
  --out-dir /tmp/helm-expt-pilot-redis-gate \
  --json
```

## Safety Rules

Pilot must use only disposable clusters, namespaces, and credentials.

Never run these tests against a production or shared customer cluster.

Before any live apply, Pilot must record:

```sh
kubectl config current-context
kubectl cluster-info
```

If the context is not an approved test context, Pilot must stop.

Preferred first target:

```text
local kind cluster
```

## Evidence Contract

Each Pilot run should write a report under:

```text
runs/pilot/<YYYYMMDD-HHMMSS>/
```

Minimum files:

```text
summary.md
environment.md
offline-results.yaml
live-results.yaml
failures.md
commands.log
```

Every finding should include:

```text
chart
variant
claim attacked
command
expected result
actual result
severity: P0 | P1 | P2
artifact paths
recommended fix
```

## Pilot Mission Prompt

Use this as the main Pilot instruction:

```text
You are Pilot running an adversarial test of /Users/alexis/code/helm-expt.

Your job is to falsify, not flatter, the ConfigHub Helm proof claims.

Do not change source files except by writing reports under runs/pilot/<run-id>/.
Do not use production clusters. Stop before live apply unless the Kubernetes
context is clearly a disposable test cluster.

First run:

  git status --short --branch
  npm run verify

Then attack the proof in four passes:

1. Offline proof integrity:
   - Run every chart's compare/verify command.
   - Confirm cub installer setup output matches regular Helm output plus only
     documented intentional differences.
   - Confirm deterministic cub installer package receipts are still true.

2. Negative proof attacks:
   - Copy one or more chart proof directories into a temp run folder.
   - Tamper rendered manifests, effective values, target facts, scan receipts,
     and Helm-equivalence receipts.
   - Confirm the verifier rejects each tamper.
   - Report any false pass as P0.

3. Live dry-run attacks:
   - For each selected variant, run cub installer setup into a temp work dir.
   - Run kubectl server-side dry-run on manifests/secrets in an isolated
     namespace.
   - Classify failures as missing CRD, missing target Secret, admission issue,
     schema issue, resource issue, or chart bug.
   - Check whether the chart's HelmPlan/ChartDossier already predicted the
     failure.

4. Live smoke attacks:
   - Only on approved disposable clusters.
   - Apply selected low-risk variants first.
   - Wait for workloads, inspect events, and clean up.
   - For heavy/privileged charts, stop at dry-run unless explicitly approved.

Write a concise summary: what held, what broke, what would persuade a skeptical
Helm user, and what must not be claimed yet.
```

## Offline Commands

Start with the whole repo:

```sh
npm run verify
npm run pilot:adversarial
```

Then run chart-local checks when narrowing a failure:

```sh
npm run redis:compare
npm run metrics-server:compare
npm run ingress-nginx:compare
npm run cert-manager:compare
npm run external-secrets:compare
npm run argo-cd:compare
npm run kube-prometheus-stack:compare
npm run postgresql:compare
npm run rabbitmq:compare
npm run loki:compare
npm run longhorn:compare
npm run vault:compare
npm run secrets-store-csi-driver:compare
npm run prometheus:compare
npm run grafana:compare
npm run mysql:compare
npm run mongodb:compare
npm run nginx:compare
npm run tempo:compare
npm run consul:compare
```

## Live Test Tiers

Tier 0 is required. Tiers 1-3 are live-cluster work.

| Tier | Scope | Purpose |
| --- | --- | --- |
| 0 | all 20 charts | Offline equivalence, determinism, receipts, and tamper rejection. |
| 1 | Redis, Nginx, Grafana, Tempo | Low-risk live smoke tests for common app shapes. |
| 2 | PostgreSQL, MySQL, MongoDB, RabbitMQ, Prometheus | Stateful and monitoring tests; expect PVC/storage class requirements. |
| 3 | cert-manager, external-secrets, ingress-nginx, Argo CD, secrets-store-csi-driver, Vault, Loki, kube-prometheus-stack, Longhorn, Consul | CRD/webhook/privileged/heavy control-plane tests; dry-run first, live apply only with explicit approval. |

## Live Smoke Procedure

For a selected chart variant:

```sh
RUN_ID="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="runs/pilot/$RUN_ID/<chart>/<variant>"
mkdir -p "$WORK_DIR"

cub installer setup \
  --pull packages/<repo>/<chart>/<version> \
  --base <variant> \
  --work-dir "$WORK_DIR/work" \
  --non-interactive \
  --namespace <namespace>

kubectl create namespace <namespace> --dry-run=client -o yaml \
  | kubectl apply --dry-run=server -f -

kubectl apply --dry-run=server -f "$WORK_DIR/work/out/manifests"
kubectl apply --dry-run=server -f "$WORK_DIR/work/out/secrets"
```

If dry-run passes and the chart is approved for live smoke:

```sh
kubectl apply -f "$WORK_DIR/work/out/manifests"
kubectl apply -f "$WORK_DIR/work/out/secrets"
kubectl -n <namespace> get all
kubectl -n <namespace> get events --sort-by=.lastTimestamp
```

Cleanup:

```sh
kubectl delete namespace <namespace> --wait=false
```

## Attacks Pilot Should Try

Pilot should actively try to break these claims:

| Claim | Attack |
| --- | --- |
| Helm equivalence is true | Compare every Helm object with cub installer output; fail on unexplained object drift. |
| Receipts bind to artifacts | Tamper rendered manifests, values, receipts, and package files; verifier must reject. |
| Variants are meaningful | Check each variant changes real objects or target facts, not just labels. |
| Target facts are explicit | Remove or omit required Secrets/CRDs and verify failure is predicted by HelmPlan/ChartDossier. |
| Control points are complete | For CRDs, hooks, webhooks, RBAC, generated facts, raw/tpl slots, and storage, check each is documented and gated. |
| Live apply is safe | Dry-run first; report schema/admission/resource failures by chart and variant. |
| UX is simpler than Helm pain | Record how many commands and decisions were needed before seeing proof. |

## Severity

P0:

```text
False equivalence, verifier false pass, missing receipt binding, live apply
mutates outside the intended namespace/scope, or docs claim a chart is live
tested when it is not.
```

P1:

```text
Dry-run/live failure not predicted by the chart artifacts, missing target fact,
missing CRD/capability note, unclear lifecycle policy, or painful UX that makes
the proof harder than Helm.
```

P2:

```text
Wording, report shape, noisy output, incomplete examples, or useful additional
checks that do not invalidate the proof.
```

## What Would Persuade A Helm User

The Pilot report should end with numbers:

```text
20/20 offline proof checks passed
N/N tamper attacks rejected
N/N dry-runs passed or failed with predicted reasons
N/N live smoke tests passed on disposable clusters
0 unexplained object diffs
0 unpredicted cluster-scope writes
```

That gives us the honest public message:

```text
Same Helm chart output, clearer variants, visible risks, and receipts proving
what happened. Live-tested where appropriate; blocked or gated where not.
```
