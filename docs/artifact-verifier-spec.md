# Artifact Verifier Spec

This is the executable proof contract for `helm-expt`.

The verifier started with archived render-and-vendor Helm import receipts, but
the current default `npm run verify` also checks the Redis
recipe/variant/revision proof, the durable Redis installer package proof, the
promoted metrics-server, ingress-nginx, cert-manager, and external-secrets
proofs, and the first adversarial public-chart harness.

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

The adversarial public-chart harness verifier checks:

```text
data/adversarial10/corpus.yaml
data/adversarial10/corpus.lock.yaml
data/adversarial10/proof-readiness.csv
data/adversarial10/charts/*/helm-plan.yaml
data/adversarial10/charts/*/render-receipt.yaml
data/adversarial10/charts/*/rendered/default.yaml
data/adversarial10/charts/*/rendered/object-inventory.yaml
```

This is the first scale-out proof index. It is not a full recipe/variant proof
for all 10 charts. It proves that the corpus is pinned, every row has a
machine-readable HelmPlan and render receipt, successful render attempts bind
stored manifests by SHA256, failed attempts record blocker receipts, and the CSV
is generated from those artifacts.

The metrics-server proof verifier checks:

```text
recipes/metrics-server/metrics-server/3.13.0/
packages/metrics-server/metrics-server/3.13.0/
```

That proof is the first promoted row from the adversarial harness. It checks two
variants, `default` and `external-tls-ca`, including source/dependency locks,
control points, effective values, target fact requirements, rendered object
inventories, render receipts, Helm equivalence receipts, scan receipts, install
gates, and deterministic `cub install` package/setup behavior.

The ingress-nginx proof verifier checks:

```text
recipes/ingress-nginx/ingress-nginx/4.15.1/
packages/ingress-nginx/ingress-nginx/4.15.1/
```

That proof is the second promoted row from the adversarial harness. It checks
two variants, `default` and `admission-disabled`, including source/dependency
locks, control points, effective values, rendered object inventories, render
receipts, Helm equivalence receipts, scan receipts, install gates, and
deterministic `cub install` package/setup behavior.

The cert-manager proof verifier checks:

```text
recipes/jetstack/cert-manager/v1.20.2/
packages/jetstack/cert-manager/v1.20.2/
```

That proof is the third promoted row from the adversarial harness. It checks two
variants, `default` and `crds-enabled`, including source/dependency locks,
control points, effective values, rendered object inventories, render receipts,
Helm equivalence receipts, scan receipts, install gates, and deterministic
`cub install` package/setup behavior.

The external-secrets proof verifier checks:

```text
recipes/external-secrets/external-secrets/2.5.0/
packages/external-secrets/external-secrets/2.5.0/
```

That proof is the fourth promoted row from the adversarial harness. It checks
two variants, `default` and `no-crds`, including source/dependency locks,
control points, effective values, rendered object inventories, render receipts,
Helm equivalence receipts, scan receipts, install gates, separated Secret
handling, and deterministic `cub install` package/setup behavior.

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

For the adversarial public-chart harness:

1. The corpus lock has one row for every chart in `corpus.yaml`.
2. Every chart row has a HelmPlan, render receipt, and object inventory.
3. Successful render receipts point at a stored rendered manifest.
4. Stored rendered manifest SHA, byte count, and resource count match the
   receipt.
5. Failed render receipts do not claim a rendered manifest and record an
   `errorSHA256`.
6. CSV status, readiness, feature flags, primary control point, paths, counts,
   and rendered manifest SHA match the receipt.
7. Chart identity, version, render context, and package SHA are present in the
   receipt.

For the promoted metrics-server proof:

1. Both variants render deterministically with Helm under the pinned capability
   profile.
2. `external-tls-ca` binds `tls.existingSecret.lookup=false`, an explicit
   `apiService.caBundle`, and the target Secret requirement
   `kube-system/metrics-server-tls`.
3. Each variant has exactly 9 Helm objects and a rendered APIService.
4. `cub install package` produces byte-identical bundles across two local runs.
5. `cub install setup --base default` and
   `cub install setup --base external-tls-ca` match Helm semantically, plus only
   `v1|Namespace||kube-system`.
6. Semantic comparison prunes null fields, because `cub install`/kustomize
   drops `metadata.annotations: null` from the APIService.

For the promoted ingress-nginx proof:

1. Both variants render deterministically with Helm under the pinned capability
   profile.
2. `default` renders exactly 11 Helm objects, including the admission Service
   and ValidatingWebhookConfiguration.
3. `admission-disabled` renders exactly 9 Helm objects and deliberately omits
   the admission Service and ValidatingWebhookConfiguration.
4. Both variants render the controller Deployment and `nginx` IngressClass.
5. `cub install package` produces byte-identical bundles across two local runs.
6. `cub install setup --base default` and
   `cub install setup --base admission-disabled` match Helm semantically, plus
   only `v1|Namespace||ingress-nginx`.
7. Scan/gate receipts flag admission webhook observation, Helm hook lifecycle
   policy, and cluster RBAC where applicable.

For the promoted cert-manager proof:

1. Both variants render deterministically with Helm under the pinned capability
   profile.
2. `default` renders exactly 42 Helm objects and zero CRDs.
3. `crds-enabled` renders exactly 48 Helm objects, including the six
   cert-manager CRDs.
4. Both variants render the controller, cainjector, webhook Deployment, webhook
   Service, MutatingWebhookConfiguration, and ValidatingWebhookConfiguration.
5. `cub install package` produces byte-identical bundles across two local runs.
6. `cub install setup --base default` and
   `cub install setup --base crds-enabled` match Helm semantically, plus only
   `v1|Namespace||cert-manager`.
7. Scan/gate receipts flag CRD lifecycle, admission webhook observation, Helm
   startup hook lifecycle policy, and cluster RBAC.

For the promoted external-secrets proof:

1. Both variants render deterministically with Helm under the pinned capability
   profile.
2. `default` renders exactly 42 Helm objects, including 23 CRDs and one
   webhook Secret.
3. `no-crds` renders exactly 19 Helm objects, including zero CRDs and one
   webhook Secret.
4. Both variants render the controller, cert-controller, webhook Deployment,
   webhook Service, and both ValidatingWebhookConfigurations.
5. The disabled `bitwarden-sdk-server` dependency is recorded in
   `dependency-lock.yaml`.
6. `cub install package` produces byte-identical bundles across two local runs.
7. `cub install setup --base default` and
   `cub install setup --base no-crds` match Helm semantically, plus only
   `v1|Namespace||external-secrets`, while preserving the separated webhook
   Secret.
8. Scan/gate receipts flag CRD lifecycle, admission webhook observation,
   webhook Secret/cert-controller observation, dependency lock review, and
   cluster RBAC.

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
- lie about the variant diff and require rejection;
- corrupt the metrics-server rendered object set and require rejection;
- corrupt the ingress-nginx rendered object set and require rejection;
- corrupt the cert-manager rendered object set and require rejection;
- corrupt the external-secrets rendered object set and require rejection;
- corrupt an adversarial harness rendered manifest and require a rendered
  manifest SHA mismatch.

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

- source archive bytes for legacy artifacts, because those archives are not
  stored in this repo;
- hosted ConfigHub upload/OCI state in the default local `npm run verify`, even
  though the latest remote receipt is recorded under
  `runs/redis-confighub/latest/upload-oci-receipt.yaml`;
- upload receipts, upgrade simulation receipts, or rollback simulation
  receipts;
- full JSON Schema enforcement, because the immediate gate is hash/reference
  integrity over existing artifacts.
- full recipe/variant/revision proofs for every chart in
  `data/adversarial10/`; that harness is the first generated readiness and
  blocker map, not the final product proof for those charts.

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
