# Artifact Verifier Spec

This is the first executable proof contract for `helm-expt`.

The verifier starts small on purpose. V0 verifies the archived
render-and-vendor Helm import receipts because those are the only receipt
artifacts present today. The same invariant style must extend to the Redis
recipe/variant proof and the future top-N chart corpus.

## Scope

V0 verifies:

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

## Required Invariants

For every chart directory:

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

The verifier must include a self-test that copies one known-good chart fixture,
corrupts an input file, and proves that verification fails for the expected
reason. The first negative golden check corrupts Redis `values.yaml` and must
fail with a value SHA mismatch.

## Non-Scope For V0

V0 does not prove:

- source archive bytes, because the archives are not stored in this repo;
- scanner or install-gate digests, because those artifacts do not exist yet;
- ConfigHub upload/OCI/observation receipts, because those belong to the Redis
  courtroom-grade proof path;
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
