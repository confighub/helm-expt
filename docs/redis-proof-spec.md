# Redis Proof Spec

This spec defines the first main-path Redis proof. It must be agreed before
creating `recipes/bitnami/redis/25.5.3/` artifacts.

The purpose is not to prove the old top-20 archive. The archive may be used as
a compatibility fixture and golden comparison input, but the proof artifacts
must live under the new recipe/variant/revision path.

## Product Claim

For `bitnami/redis@25.5.3`, ConfigHub must prove:

```text
correct variant
safe operation
immediate proof
```

The first Redis proof is the `standalone` install variant. Later slices can add
`ha` and `reuse-existing-secret`.

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
  recipe.yaml

  variants/
    standalone/variant.yaml

  revisions/
    standalone/r001/
      variant-revision.yaml
      rendered/release-objects.yaml
      rendered/object-inventory.yaml
      receipts/helm-equivalence-receipt.yaml
      receipts/render-receipt.yaml
      receipts/scan-receipt.yaml
      receipts/install-gate.yaml
```

## Minimum Readiness Card

`README.md` must show the happy path before the artifact ladder:

```text
Chart: bitnami/redis 25.5.3
Variant: standalone
Status: usable with controls
Helm objects: 14
ConfigHub/cub install objects: 15
Explained difference: installer namespace support object
Helm match: 14/14 semantic object matches
Secrets: 1 rendered secret separated from uploaded manifests
Scan/gate: exact rendered object digest bound; result explicit
Next action: publish via ConfigHub OCI, or direct apply only for local/test
Proof: equivalence, render, scan/gate receipts
```

If scan/gate is not executed yet, the card must say `not-run` or `blocked`.
It must not imply a pass.

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

4. `variants/standalone/variant.yaml` records:
   - variant name: `standalone`
   - namespace: `redis`
   - release name: `redis`
   - values profile reference
   - capability profile: Kubernetes `1.30.0`
   - hook policy: `no-hooks`
5. `effective-values.yaml` records the exact values used for the render and
   their SHA256.
6. Unknown, dead, or ignored values are represented explicitly as `unknown`,
   `not-checked`, or `none-detected`; silence is not allowed.

### Rendered Revision

7. `variant-revision.yaml` binds:
   - recipe digest
   - variant digest
   - effective-values digest
   - renderer/toolchain digest or version
   - rendered object set digest
8. `rendered/release-objects.yaml` contains the Helm-equivalent Redis release
   objects for the standalone variant.
9. `rendered/object-inventory.yaml` contains every rendered object identity:
   `apiVersion|kind|namespace|name`.
10. There are exactly 14 Helm release objects for the standalone variant.
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

### Scan And Gate

14. `scan-receipt.yaml` is bound to the rendered object set digest.
15. `scan-receipt.yaml` must state scanner name/version/policy digest when run.
16. If no scanner has run, `scan-receipt.yaml` must say `result: not-run`.
17. `install-gate.yaml` must derive its decision from available receipts:
    `allow`, `warn`, or `block`.
18. `install-gate.yaml` must not allow a production gate when scan result is
    `not-run`; it may allow only `local-test` if explicitly marked.

## Proof Commands

The first implementation must add commands or scripts that prove:

```sh
npm run verify
npm run redis:compare
```

and a new Redis proof verifier, for example:

```sh
npm run redis:verify-proof
```

The Redis proof verifier must fail if:

- any referenced digest changes;
- object count changes without receipt update;
- the namespace support object is not explicitly classified;
- scan/gate status is missing or falsely implies success;
- any required file is absent.

## Non-Scope For First Redis Slice

The first Redis proof does not need to complete:

- HA variant
- reuse-existing-secret variant
- live cluster observation receipt
- ConfigHub OCI publication receipt
- upgrade/rollback simulation receipts

Those are required later, but they must not block the first standalone proof as
long as their status is explicit.
