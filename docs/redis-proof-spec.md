# Redis Proof Spec

This spec defines the first main-path Redis proof. It must be agreed before
creating `recipes/bitnami/redis/25.5.3/` artifacts.

The purpose is not to prove the old top-20 archive. The old payload has been
removed from the active tree. This proof renders Redis with regular Helm under
pinned inputs, then verifies the current `cub install` package against that
baseline.

## Product Claim

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

## Required Files

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

## Minimum Readiness Card

`README.md` must show the happy path before the artifact ladder:

```text
Chart: bitnami/redis 25.5.3
Variants: default, reuse-existing-secret
Status: usable with controls
Helm objects: default 14; reuse-existing-secret 13
ConfigHub/cub install objects: default 15; reuse-existing-secret 14
Explained difference: installer namespace support object
Helm match: default 14/14; reuse-existing-secret 13/13 semantic object matches
Secrets: default renders 1 Secret; reuse-existing-secret requires target Secret
Scan/gate: exact rendered object digest bound; result explicit
Installer package: deterministic cub install package with two bases
Next action: publish via configured ConfigHub OCI, or direct apply only for local/test
Proof: equivalence, render, scan/gate, package, upload/OCI receipts
Variant diff: default -> reuse-existing-secret explains removed Secret, changed
StatefulSets, and added target fact
```

If scan/gate is not executed yet, the card must say `not-run` or `blocked`.
If the local scan runs and finds risks, the card must say `warn` and explain
which scopes are blocked. It must not imply a pass.

## Required Invariants

### Source And Dependencies

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

### Variant

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

### Rendered Revision

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

### Helm Equivalence

12. `helm-equivalence-receipt.yaml` proves:
    - regular Helm render SHA256:
      `362dbc4854421a23ea48da4ee7e72dbc98422fa9affc26ac372c761d4b90e10d`
    - regular Helm object count: `14`
    - `cub install setup` object count including secrets/support objects: `15`
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
    - `cub install setup` object count including support objects: `14`
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

### Installer Package

13d. `packages/bitnami/redis/25.5.3/installer.yaml` must declare a real
     installer `Package` with bases `default` and `reuse-existing-secret`.
13e. `cub install package packages/bitnami/redis/25.5.3` must produce
     byte-identical `.tgz` files across two local runs.
13f. `cub install setup --base default` must render the default variant and
     match Helm semantically, with only the namespace support object added.
13g. `cub install setup --base reuse-existing-secret` must render the
     existing-secret variant and match Helm semantically, with only the
     namespace support object added.

### ConfigHub Upload And OCI

13h. `cub install upload` must create one visible ConfigHub Space per current
     Redis variant in the configured demo org.
13i. Each variant Space must contain 14 variant-labeled Kubernetes Units plus
     an `installer-record` Unit.
13j. Rendered Secrets must not be uploaded by the default variant.
13k. The reuse-existing-secret variant must leave `redis-existing-secret` as an
     expected target fact, not as rendered or stored secret material.
13l. ConfigHub's hosted OCI endpoint must return a unit-level OCI manifest for
     a representative Redis Unit, with secret and bearer token omitted from the
     receipt.

### Scan And Gate

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

## Proof Commands

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
- `cub install package` stops being byte-deterministic;
- either package base stops matching the corresponding Helm-equivalent variant
  revision.

## Non-Scope For First Redis Slice

The first Redis proof does not need to complete:

- HA variant
- upgrade/rollback simulation receipts

Those are required later, but they must not block the first Redis proof as long
as their status is explicit.
