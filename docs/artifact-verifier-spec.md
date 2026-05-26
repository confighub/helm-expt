# Artifact Verifier Spec

This is the executable proof contract for `helm-expt`.

The verifier started with archived render-and-vendor Helm import receipts, but
the current default `npm run verify` also checks the Redis
recipe/variant/revision proof and the durable Redis installer package proof.

## Scope

The legacy reference verifier checks:

```text
archive/render-and-vendor-top20/charts/index.yaml
archive/render-and-vendor-top20/charts/*/helm-import.receipt.yaml
archive/render-and-vendor-top20/charts/*/helm-import.spec.yaml
archive/render-and-vendor-top20/charts/*/installer.yaml
archive/render-and-vendor-top20/charts/*/values.yaml
archive/render-and-vendor-top20/charts/*/base/upstream.yaml
archive/render-and-vendor-top20/charts/*/base/kustomization.yaml
```

This is legacy evidence, not the main product pathway. It is still useful as
the first golden corpus because it has 20 deterministic chart imports and one
negative-control shape we can corrupt in a self-test.

The Redis proof verifier checks:

```text
recipes/bitnami/redis/25.5.3/
packages/bitnami/redis/25.5.3/
```

That includes HelmPlan, ChartDossier, source/dependency locks, control points,
effective values, variants, variant revisions, rendered objects, object
inventories, Helm equivalence receipts, render receipts, scan receipts, install
gates, variant diff evidence, the installer package receipt, and the package
source tree. Remote ConfigHub upload/OCI evidence is recorded separately under
`runs/redis-confighub/latest/` because it depends on hosted ConfigHub auth.

## Required Invariants

For every archived chart directory:

1. Required files exist.
2. `helm-import.receipt.yaml` has `kind: HelmImportReceipt`.
3. `helm-import.spec.yaml` has `kind: HelmImportSpec`.
4. `installer.yaml` has `kind: Package`.
5. `installer.yaml` has one default base at `base`.
6. `base/kustomization.yaml` references `upstream.yaml`.
7. The receipt chart identity matches the import spec chart identity.
8. The receipt render context matches the import spec render context.
9. The receipt value-file path exists and is `values.yaml`.
10. The receipt value-file SHA256 equals the actual `values.yaml` SHA256.
11. The receipt import-spec SHA256 equals the actual `helm-import.spec.yaml`
    SHA256.
12. The receipt upstream YAML SHA256 equals the actual `base/upstream.yaml`
    SHA256.
13. The receipt upstream YAML byte count equals the actual `base/upstream.yaml`
    byte count.
14. The receipt resource count equals the number of Kubernetes objects parsed
    from `base/upstream.yaml`.
15. Every parsed Kubernetes object has a stable identity:
    `apiVersion|kind|namespace|name`.
16. No rendered object identities are duplicated.
17. For successful renders, `secondRenderSHA256` equals `upstreamYAMLSHA256`
    and `deterministicAcrossTwoLocalRenders` is `true`.
18. For failed renders, resource count is `0`.
19. The index row for the chart matches the receipt for rank, path, chart
    identity, status, determinism, resource count, and upstream YAML digest.

## Negative Golden Check

The verifier must include self-tests that corrupt known-good fixtures and prove
verification fails for the expected reason.

Current self-tests include:

- corrupt archived Redis `values.yaml` and require a value SHA mismatch;
- corrupt the Redis rendered object digest and require rejection;
- remove the namespace support classification and require rejection;
- claim false scan success and require rejection;
- reintroduce the old `standalone` variant shape and require rejection;
- tamper with the reuse-existing-secret target fact and require rejection;
- lie about the variant diff and require rejection.

The Redis installer package verifier must also prove:

- every package source file SHA and byte count matches the package receipt;
- `cub install package` produces byte-identical bundles across two local runs;
- the package bundle SHA matches the receipt;
- `cub install setup --base default` matches the default Helm-equivalent
  variant, plus only `v1|Namespace||redis`;
- `cub install setup --base reuse-existing-secret` matches the existing-secret
  Helm-equivalent variant, plus only `v1|Namespace||redis`.

## Non-Scope For V0

The current verifier does not prove:

- source archive bytes, because the archives are not stored in this repo;
- hosted ConfigHub upload/OCI state in the default local `npm run verify`, even
  though the latest remote receipt is recorded under
  `runs/redis-confighub/latest/upload-oci-receipt.yaml`;
- upload receipts, upgrade simulation receipts, or rollback simulation
  receipts;
- full JSON Schema enforcement, because the immediate gate is hash/reference
  integrity over existing artifacts.

## Extension Rule

Every new proof artifact family must add:

```text
schema or contract file
positive fixture or generated corpus
negative golden check
receipt/reference/digest verification
npm script entry point
```

Do not add a new chart proof stage unless its verifier contract lands first.
