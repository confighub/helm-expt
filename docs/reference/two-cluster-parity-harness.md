# Two-Cluster Helm Parity Harness

**UNOFFICIAL/EXPERIMENTAL**

Strict Helm parity should use two vanilla Kubernetes clusters by default. This
is the required 100% live parity test for maintained base variants.

The question is narrow:

```text
Do regular Helm and cub installer produce the same install outcome for the
same chart, version, base variant, and values?
```

The safest default test is:

| Cluster | Path |
| --- | --- |
| A | `helm upgrade --install ...` |
| B | `cub installer setup ...` followed by `kubectl apply` |

The clusters should be identical vanilla kind clusters unless the chart
requires a named capability profile. This prevents one leg from contaminating
the other with CRDs, controllers, webhooks, admission state, or existing
cluster-scoped objects.

This does not reduce the live parity bar. It makes the bar cleaner:

```text
100% live parity = Helm on cluster A and cub installer on cluster B reach the
same object and readiness outcome.

GitOps/OCI delivery = the already-proven cub installer output is published and
reconciled through Argo CD or Flux.
```

Both matter. They should be separate receipts because they answer different
questions.

## Why Not cub-lk By Default

`cub lk` is useful for ConfigHub/OCI/GitOps proof because it creates a local
cluster, ConfigHub target, OCI endpoint, and Argo CD controller. That is a
delivery proof.

Strict Helm parity is different. It should not preinstall a controller unless
the chart itself requires that controller as a target fact. The Argo CD chart
showed the problem: the test rig installed Argo CD CRDs for delivery, then the
Argo CD chart-under-test tried to install those same CRDs through Helm.

Use `cub lk` or an equivalent prepared target for:

- ConfigHub OCI delivery proof;
- Argo/Flux reconciliation proof;
- target-bound derived variant proof;
- tutorials that explicitly need a ConfigHub target.

Use two vanilla kind clusters for:

- Helm-vs-installer live parity;
- rerunning all base variants;
- user-supplied parity checks;
- diagnosing chart readiness without GitOps/controller noise.

## Required Outcome

For every maintained base variant, the strict parity receipt should record:

- chart, version, package, recipe, and base variant;
- the exact values profile used by regular Helm and `cub installer`;
- regular Helm install result on cluster A;
- `cub installer` render and apply result on cluster B;
- semantic object comparison between the Helm-rendered object set and installer
  output;
- workload readiness in both clusters;
- functional checks where the chart has chart-specific checks;
- cleanup result.

The receipt can be:

| Result | Meaning |
| --- | --- |
| `pass` | Object parity passed and both clusters reached expected readiness. |
| `watch` | Object parity passed but at least one runtime condition did not settle in time. |
| `blocked` | Install, apply, semantic parity, required target facts, or cluster prerequisites failed. |

Receipts may include `semanticNormalizations` copied from the base variant's
Helm-equivalence receipt. The harness applies only those declared
normalizations before comparing objects. Current examples are a single leading
newline in Loki's embedded `ConfigMap` YAML and leading newlines in Consul
shell command blocks. Other object differences remain `blocked`.

## Current Command

Run one chart/base from the maintained recipe catalog:

```sh
npm run kind-parity:run -- \
  --chart grafana/loki \
  --version 7.0.0 \
  --base single-binary-filesystem
```

Or use a recipe path:

```sh
npm run kind-parity:run -- \
  --recipe recipes/grafana/loki/7.0.0 \
  --base single-binary-filesystem
```

Run every top-20 chart variant that does not already have a receipt:

```sh
npm run kind-parity:run-top20-variants:missing
```

Run every top-20 chart variant, replacing existing receipts:

```sh
npm run kind-parity:run-top20-variants -- --continue-on-fail
```

Run this lane serially. The harness cleans up parity-owned kind clusters before
and after a run; two concurrent parity runs can interfere with each other and
turn an infrastructure collision into a false chart failure.

The command writes a receipt under:

```text
runs/live-kind-parity/<chart>-<base>/receipt.yaml
```

Summarize and verify committed receipts:

```sh
npm run kind-parity:summary
npm run kind-parity:verify
```

## User-Supplied Parity

The lower-level test can be used by automation or an assistant when the user
has created a recipe/package from their own chart and values:

```sh
python3 tests/live-helm-installer-kind-parity-test \
  --chart <repo/chart> \
  --version <chart-version> \
  --repo-url <helm-repo-url> \
  --release <release> \
  --namespace <namespace> \
  --package <packages/...> \
  --recipe <recipes/...> \
  --base <base> \
  --variant-revision <recipes/.../revisions/<base>/r001/variant-revision.yaml> \
  --values <recipes/.../effective-values.yaml> \
  --slug <short-name> \
  --rig <unique-kind-name-prefix> \
  --out <receipt-path>
```

This is still recipe/package based. If the user only has a raw chart and values
file, the first step is to import or create the recipe/package candidate.

## Relationship To OCI/GitOps

The two-cluster parity harness does not prove Argo CD or Flux delivery.
That is deliberate. It protects the required parity test from delivery-system
state.

Use the GitOps/OCI lane after parity:

```text
parity first
then OCI/GitOps delivery
then runtime observation
```

This separation keeps the proof readable:

- parity says Helm and `cub installer` produce the same outcome;
- delivery says ConfigHub can publish and a controller can reconcile;
- observation says what the live target reports later.

For catalog support, the target state is not "either/or":

```text
base variant
-> 100% live parity receipt
-> delivery receipt where GitOps/OCI is claimed
-> observation receipt for the target
```
