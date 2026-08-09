# The redis worked example

Redis is the catalog's reference chart. Its lanes were specified first, in the
most detail, and the shape they settled on is the one every later chart follows.
This is the whole contract in one place: seven specifications that used to sit in
seven files nothing linked to.

Each section below is a lane that still runs. The npm scripts are live
(`redis:verify-proof`, `redis:verify-package`, `redis:local-e2e`,
`redis:verify-confighub-proof`, and the variant lanes), so this is a description
of current behaviour rather than a record of how things once were.

Later charts are generated from declarative specs through
`scripts/lib/proof-kit.mjs` rather than hand-written, which is why no other chart
has prose at this depth. Read this to understand what the kit produces.


## The proof lane

From `redis-proof-spec.md`.

This spec defines the first main-path Redis proof. It must be agreed before
creating `recipes/bitnami/redis/25.5.3/` artifacts.

The purpose is not to prove the old top-20 archive. The old payload has been
removed from the active tree. This proof renders Redis with regular Helm under
pinned inputs, then verifies the current `cub installer` package against that
baseline.

### Product Claim

For `bitnami/redis@25.5.3`, ConfigHub must prove:

```text
correct variant
safe operation
immediate proof
```

The first Redis proof contains two install variants:

```text
default
reuse-existing-secret
```

Later slices can add `ha`.

### Required Files

```text
recipes/bitnami/redis/25.5.3/
  README.md
  helm-plan.yaml
  chart-dossier.yaml
  source-lock.yaml
  dependency-lock.yaml
  control-points.yaml
  value-model.yaml
  effective-values.yaml
  effective-values-reuse-existing-secret.yaml
  recipe.yaml
  diffs/default-to-reuse-existing-secret.yaml
  publication/installer-package-receipt.yaml

  variants/
    default/variant.yaml
    reuse-existing-secret/variant.yaml

  revisions/
    default/r001/
      variant-revision.yaml
      rendered/release-objects.yaml
      rendered/object-inventory.yaml
      receipts/helm-equivalence-receipt.yaml
      receipts/render-receipt.yaml
      receipts/scan-receipt.yaml
      receipts/install-gate.yaml

    reuse-existing-secret/r001/
      variant-revision.yaml
      rendered/release-objects.yaml
      rendered/object-inventory.yaml
      receipts/helm-equivalence-receipt.yaml
      receipts/render-receipt.yaml
      receipts/scan-receipt.yaml
      receipts/install-gate.yaml

packages/bitnami/redis/25.5.3/
  installer.yaml
  README.md
  bases/default/kustomization.yaml
  bases/default/upstream.yaml
  bases/reuse-existing-secret/kustomization.yaml
  bases/reuse-existing-secret/upstream.yaml

runs/redis-confighub/latest/
  upload-oci-receipt.yaml
```

### Minimum Readiness Card

`README.md` must show the happy path before the artifact ladder:

```text
Chart: bitnami/redis 25.5.3
Variants: default, reuse-existing-secret
Status: usable with controls
Helm objects: default 14; reuse-existing-secret 13
ConfigHub/cub installer objects: default 15; reuse-existing-secret 14
Explained difference: installer namespace support object
Helm match: default 14/14; reuse-existing-secret 13/13 semantic object matches
Secrets: default renders 1 Secret; reuse-existing-secret requires target Secret
Scan/gate: exact rendered object digest bound; result explicit
Installer package: deterministic cub installer package with two bases
Next action: publish via configured ConfigHub OCI, or direct apply only for local/test
Proof: equivalence, render, scan/gate, package, upload/OCI receipts
Variant diff: default -> reuse-existing-secret explains removed Secret, changed
StatefulSets, and added target fact
```

If scan/gate is not executed yet, the card must say `not-run` or `blocked`.
If the local scan runs and finds risks, the card must say `warn` and explain
which scopes are blocked. It must not imply a pass.

### Required Invariants

#### Source And Dependencies

1. `source-lock.yaml` identifies:
   - chart repository: `bitnami`
   - chart name: `redis`
   - chart version: `25.5.3`
   - content URL: `oci://registry-1.docker.io/bitnamicharts/redis:25.5.3`
   - chart digest/sha matching the captured source evidence
2. `dependency-lock.yaml` records the Redis chart dependency closure, including
   the Bitnami `common` library chart version.
3. `source-lock.yaml` and `dependency-lock.yaml` are referenced by
   `recipe.yaml`.

#### Variant

4. `variants/default/variant.yaml` records:
   - variant name: `default`
   - namespace: `redis`
   - release name: `redis`
   - values profile reference
   - capability profile: Kubernetes `1.30.0`
   - hook policy: `no-hooks`
5. `effective-values.yaml` records the exact values used for the render and
   their SHA256.
5b. `effective-values-reuse-existing-secret.yaml` records the existing-secret
    values and must not store `auth.password`.
6. Unknown, dead, or ignored values are represented explicitly as `unknown`,
   `not-checked`, or `none-detected`; silence is not allowed.
6b. `variants/reuse-existing-secret/variant.yaml` records the target Secret
    requirement: namespace `redis`, name `redis-existing-secret`, key
    `redis-password`.

#### Rendered Revision

7. `variant-revision.yaml` binds:
   - recipe digest
   - variant digest
   - effective-values digest
   - renderer/toolchain digest or version
   - rendered object set digest
8. `rendered/release-objects.yaml` contains the Helm-equivalent Redis release
   objects for the default variant.
9. `rendered/object-inventory.yaml` contains every rendered object identity:
   `apiVersion|kind|namespace|name`.
10. There are exactly 14 Helm release objects for the default variant.
10b. There are exactly 13 Helm release objects for the
     `reuse-existing-secret` variant, and no rendered `Secret`.
11. There are no duplicate object identities.

#### Helm Equivalence

12. `helm-equivalence-receipt.yaml` proves:
    - regular Helm render SHA256:
      `362dbc4854421a23ea48da4ee7e72dbc98422fa9affc26ac372c761d4b90e10d`
    - regular Helm object count: `14`
    - `cub installer setup` object count including secrets/support objects: `15`
    - semantic object matches: `14/14`
    - allowed ConfigHub/cub-only object: `v1|Namespace||redis`
    - separated secret count: `1`
13. Every difference between Helm and cub output is classified as:
    - `semantic-normalization`
    - `installer-support-object`
    - `secret-separated`
    - `risk`
    - `blocked`
13b. The `reuse-existing-secret` equivalence receipt must prove:
    - regular Helm object count: `13`
    - `cub installer setup` object count including support objects: `14`
    - semantic object matches: `13/13`
    - separated secret count: `0`
    - target Secret requirement recorded separately from rendered output
13c. `diffs/default-to-reuse-existing-secret.yaml` must be recomputable from
     both rendered object sets. It must show:
    - removed object: `v1|Secret|redis|redis`
    - added objects: none
    - changed objects: Redis master and replica StatefulSets
    - added target fact: `Secret redis/redis-existing-secret` key
      `redis-password`

#### Installer Package

13d. `packages/bitnami/redis/25.5.3/installer.yaml` must declare a real
     installer `Package` with bases `default` and `reuse-existing-secret`.
13e. `cub installer package packages/bitnami/redis/25.5.3` must produce
     byte-identical `.tgz` files across two local runs.
13f. `cub installer setup --base default` must render the default variant and
     match Helm semantically, with only the namespace support object added.
13g. `cub installer setup --base reuse-existing-secret` must render the
     existing-secret variant and match Helm semantically, with only the
     namespace support object added.

#### ConfigHub Upload And OCI

13h. `cub installer upload` must create one visible ConfigHub Space per current
     Redis variant in the configured demo org.
13i. Each variant Space must contain 14 variant-labeled Kubernetes Units plus
     an `installer-record` Unit.
13j. Rendered Secrets must not be uploaded by the default variant.
13k. The reuse-existing-secret variant must leave `redis-existing-secret` as an
     expected target fact, not as rendered or stored secret material.
13l. ConfigHub's hosted OCI endpoint must return a unit-level OCI manifest for
     a representative Redis Unit, with secret and bearer token omitted from the
     receipt.

#### Scan And Gate

14. `scan-receipt.yaml` is bound to the rendered object set digest.
15. `scan-receipt.yaml` must state scanner name/version/policy digest when run.
16. If no scanner has run, `scan-receipt.yaml` must say `result: not-run`.
17. `install-gate.yaml` must derive its decision from available receipts:
    `allow`, `warn`, or `block`.
18. `install-gate.yaml` must not allow a production gate when scan result is
    `not-run`; it may allow only `local-test` if explicitly marked.
19. When the deterministic local scan is present, `scan-receipt.yaml` must bind
    scanner name/version, policy bundle digest, finding counts, and findings to
    the rendered object digest.
20. When any high finding exists, `install-gate.yaml` must block production and
    may allow only `local-test`.

### Proof Commands

The first implementation must add commands or scripts that prove:

```sh
npm run verify
npm run redis:compare
```

and a new Redis proof verifier, for example:

```sh
npm run redis:verify-proof
npm run redis:verify-package
```

The Redis proof verifier must fail if:

- any referenced digest changes;
- object count changes without receipt update;
- the namespace support object is not explicitly classified;
- scan/gate status is missing or falsely implies success;
- any required file is absent.
- the durable Redis installer package changes without receipt update;
- `cub installer package` stops being byte-deterministic;
- either package base stops matching the corresponding Helm-equivalent variant
  revision.

### Non-Scope For First Redis Slice

The first Redis proof does not need to complete:

- HA variant
- upgrade/rollback simulation receipts

Those are required later, but they must not block the first Redis proof as long
as their status is explicit.


## The installer package lane

From `redis-installer-package-spec.md`.

This spec defines the next executable Redis proof slice: turn the existing
Redis variant revisions into a real `cub installer` package, then verify that the
package remains deterministic and Helm-equivalent.

This is not the old archived top-20 pathway. The package source is generated
from the current Redis proof revisions:

```text
recipes/bitnami/redis/25.5.3/revisions/*/r001/rendered/release-objects.yaml
```

The durable package source lives at:

```text
packages/bitnami/redis/25.5.3/
```

### Product Claim

For `bitnami/redis@25.5.3`, the current installer package must prove:

```text
correct variants
safe operations
immediate proof
```

The package contains two real installer bases:

```text
default
reuse-existing-secret
```

The current executable selection UX is:

```sh
cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3 --base default --work-dir <work> --non-interactive --namespace redis
cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3 --base reuse-existing-secret --work-dir <work> --non-interactive --namespace redis
```

### Required Files

```text
packages/bitnami/redis/25.5.3/
  installer.yaml
  README.md
  bases/default/kustomization.yaml
  bases/default/upstream.yaml
  bases/reuse-existing-secret/kustomization.yaml
  bases/reuse-existing-secret/upstream.yaml

recipes/bitnami/redis/25.5.3/publication/
  installer-package-receipt.yaml
```

### Required Invariants

1. `installer.yaml` declares a real installer `Package`.
2. The package name is `bitnami-redis` and version is `25.5.3`.
3. Exactly one base is default: `default`.
4. The `default` base points at the default Redis rendered object set.
5. The `reuse-existing-secret` base points at the existing-secret rendered
   object set.
6. `cub installer package` produces byte-identical `.tgz` files across two local
   runs from the same source tree.
7. The package receipt records every package source file and SHA256.
8. The package receipt records the deterministic `.tgz` SHA256.
9. `cub installer setup --base default` renders all 14 Helm Redis objects, plus
   only the installer namespace support object and one separated Secret.
10. `cub installer setup --base reuse-existing-secret` renders all 13 Helm Redis
    objects, plus only the installer namespace support object and no separated
    Secret.
11. Every `cub installer` difference from Helm is semantic-equivalent or
    explicitly classified as the namespace support object.
12. OCI publication is a real gated command, not a fake transcript. It runs only
    when a registry ref is supplied:

```sh
REDIS_INSTALLER_OCI_REF=oci://<registry>/<repo>:<tag> npm run redis:publish-package
```

### Proof Commands

```sh
npm run redis:generate-package
npm run redis:verify-package
npm run redis:compare
npm run verify
```

The default `npm run verify` must include `redis:verify-package`.

### Non-Scope For This Slice

This slice does not require a live ConfigHub OCI endpoint to be running. If a
registry ref and credentials are available, `npm run redis:publish-package`
must package, push, inspect, and write a publication receipt under `runs/`.
Without a registry ref, publication remains unrun rather than simulated.


## The local end-to-end lane

From `redis-local-e2e-spec.md`.

This slice proves the Redis `default` and `reuse-existing-secret` rendered
objects can run in a local Kubernetes cluster.

It is intentionally local. It does not prove ConfigHub OCI publication, GitOps
handoff, or production readiness.

### Scope

Input:

```text
recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml
recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml
```

Output:

```text
runs/redis-local-kind/latest/observation-receipt.yaml
runs/redis-local-kind/reuse-existing-secret-latest/observation-receipt.yaml
runs/redis-local-kind/latest/kubectl-objects.txt
runs/redis-local-kind/latest/redis-pong.txt
```

### Cluster Rule

Use a dedicated local kind cluster:

```text
helm-expt-redis
```

The e2e script may create this cluster if it is missing. It must not mutate any
other cluster context.

### Apply Rule

The rendered Redis release objects do not include the installer Namespace
support object. For local e2e only, apply:

```text
v1|Namespace||redis
```

before applying `release-objects.yaml`.

This is the same intentional cub-only support object already classified in the
Helm equivalence receipt.

### Required Checks

The e2e proof must:

1. Verify the rendered object SHA256 before applying.
2. Create/use only the `helm-expt-redis` kind cluster.
3. Check that a default StorageClass exists. If it does not, the script may
   install the pinned local-path provisioner for this dedicated kind cluster
   and must record that target fact in the receipt.
4. Create the `redis` Namespace support object.
5. For `reuse-existing-secret`, create the required target Secret
   `redis-existing-secret` with key `redis-password` before applying the
   release objects, and record it as a target fact.
6. Apply the exact rendered release objects.
7. Wait for:
   - `statefulset/redis-master`
   - `statefulset/redis-replicas`
8. Wait for the four Redis PVCs to be `Bound`.
9. Run a Redis client command that returns `PONG`.
10. Write an observation receipt with:
   - observer name/version
   - cluster kind/name
   - observed timestamp
   - rendered object digest
   - variant revision reference
   - result
   - freshness TTL
   - target facts, including default StorageClass
   - required Secret target fact for `reuse-existing-secret`
   - checked resources
   - bound PVC evidence
   - PONG evidence digest

### Gate Rule

Local e2e success may satisfy `local-test`.

It must not override the production block from the scan gate. Production remains
blocked until high scan findings are fixed or explicitly waived.


## The local scan lane

From `redis-local-scan-spec.md`.

This slice replaces the Redis placeholder scan with a deterministic local scan
that is bound to the rendered object digest.

The goal is not to replace Trivy, Snyk, kube-linter, Kubescape, Checkov, or
ConfigHub policy functions. The goal is to prove the receipt/gate model with a
small scanner that always runs in this repo and catches real Redis risks.

### Scope

Input:

```text
recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml
```

Output:

```text
recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/scan-receipt.yaml
recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/install-gate.yaml
```

### Scanner Contract

The scanner name is:

```text
helm-expt-local-rendered-object-scan
```

The scanner must:

1. Bind findings to `renderedObjectSetSHA256`.
2. Emit a stable `policyBundleDigest`.
3. Emit deterministic finding IDs, severities, object identities, and messages.
4. Fail verification if the scan receipt digest does not match the rendered
   object set.
5. Fail verification if the install gate allows production while any high
   finding exists.

### Minimum Rules

V0 rules:

| Rule | Severity | Purpose |
| --- | --- | --- |
| `mutable-image-tag` | high | Catch unpinned or `latest` images. |
| `pdb-unhealthy-pod-eviction-policy` | medium | Catch PDBs missing explicit unhealthy pod eviction behavior. |
| `service-selector-has-workload-match` | high | Catch Services whose selector matches no workload pod template. |
| `workload-service-account-exists` | high | Catch workloads using a ServiceAccount absent from the rendered set. |

### Expected Redis Findings

For `bitnami/redis@25.5.3` default, V0 is expected to produce:

```text
high: 2
medium: 2
low: 0
info: 0
result: warn
```

Expected finding types:

- two `mutable-image-tag` findings for Redis StatefulSets using
  `registry-1.docker.io/bitnami/redis:latest`
- two `pdb-unhealthy-pod-eviction-policy` findings for Redis PDBs

Because high findings exist, the install gate must:

```text
decision: warn
allowedScopes: [local-test]
blockedScopes: [production]
```

This is the right outcome: the proof is correct and useful precisely because
it shows the chart is not production-clean under this policy yet.


## The default variant

From `redis-default-variant-spec.md`.

The first Redis proof variant must be named `default`, not `standalone`.

Reason:

```text
bitnami/redis@25.5.3 default render includes:
- redis-master StatefulSet with 1 pod
- redis-replicas StatefulSet with 3 pods
```

Calling this `standalone` is misleading. It weakens trust because the proof
label would contradict the rendered objects.

### Required Rename

Rename:

```text
variants/standalone/variant.yaml
revisions/standalone/r001/
```

to:

```text
variants/default/variant.yaml
revisions/default/r001/
```

All receipts, run evidence, README cards, verifier scripts, and e2e scripts
must refer to the `default` variant.

### Invariant

The verifier must prove:

```text
variant metadata.name == default
variant revision path == revisions/default/r001/variant-revision.yaml
observation receipt variantRevision points at revisions/default/r001/variant-revision.yaml
```

No proof file should present the default Bitnami Redis render as standalone.


## The variant diff

From `redis-variant-diff-spec.md`.

This slice makes the easy variant path visible.

Input:

```text
default/r001 rendered object set
reuse-existing-secret/r001 rendered object set
reuse-existing-secret target fact requirement
```

Output:

```text
recipes/bitnami/redis/25.5.3/diffs/default-to-reuse-existing-secret.yaml
```

The diff must show:

```text
removed Helm object: v1|Secret|redis|redis
added Helm objects: none
changed Helm objects:
- apps/v1|StatefulSet|redis|redis-master
- apps/v1|StatefulSet|redis|redis-replicas
added target fact: Secret redis/redis-existing-secret key redis-password
```

The verifier must recompute the object-level diff from the two rendered object
sets and reject the artifact if the summary lies.


## The reuse-existing-secret variant

From `redis-reuse-existing-secret-variant-spec.md`.

This slice proves the first easy variant path after `default`.

The variant is named `reuse-existing-secret`.

Purpose:

```text
Move Redis credential ownership out of Helm-generated Secret output and into
an explicit target secret requirement.
```

### Helm Values

The variant must set:

```yaml
auth:
  existingSecret: redis-existing-secret
  existingSecretPasswordKey: redis-password
```

It must not set or store `auth.password`.

### Required Files

```text
recipes/bitnami/redis/25.5.3/
  effective-values-reuse-existing-secret.yaml
  variants/reuse-existing-secret/variant.yaml
  revisions/reuse-existing-secret/r001/
    variant-revision.yaml
    rendered/release-objects.yaml
    rendered/object-inventory.yaml
    receipts/helm-equivalence-receipt.yaml
    receipts/render-receipt.yaml
    receipts/scan-receipt.yaml
    receipts/install-gate.yaml
```

### Invariants

The verifier must prove:

```text
variant metadata.name == reuse-existing-secret
rendered Helm object count == 13
rendered Secret count == 0
target secret requirement is recorded
regular Helm output and cub installer setup output are semantically equivalent
cub installer adds only the Namespace support object
```

The proof must make the happy path visible:

```text
default variant: Helm renders Redis Secret
reuse-existing-secret variant: Helm does not render Redis Secret
safe operation: target must provide redis-existing-secret/redis-password
```
