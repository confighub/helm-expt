# Top 100 Full Proof Target

The current public proof surface is **100 public Helm charts**:

- 20 bespoke proofs with chart-specific variants and mitigations;
- 80 generated full proofs with the same minimum artifact contract.

The next-80 lane is generated from:

```text
data/next80-full-proofs/corpus.yaml
```

Generated outputs:

```text
data/next80-full-proofs/proof-index.csv
data/next80-full-proofs/summary.md
recipes/<repo>/<chart>/<version>/
packages/<repo>/<chart>/<version>/
```

Every next-80 chart must prove:

- pinned chart source and dependency closure;
- deterministic regular Helm render under Kubernetes `1.30.0`;
- a Recipe, HelmPlan, ChartDossier, ValueModel, and ControlPoints file;
- a default Variant and digest-bound VariantRevision;
- rendered release objects and object inventory;
- render, Helm-equivalence, scan, install-gate, and installer-package receipts;
- deterministic `cub installer package` output;
- `cub installer setup` output semantically matching regular Helm output, aside
  from the allowed Namespace support object.

Verification:

```sh
npm run next80:verify
npm run next80:verify:packages
npm run verify
```

The lane is intentionally strict. Charts that render with Helm but change
semantics through the installer/Kustomize round trip do not count as passing
full proofs. They belong in the adversarial backlog until the difference is
classified and mitigated.

## Currentness And Promotion

The top-100 proof surface has two different maturity levels:

```text
top-20: catalog-supported public entries with bespoke variants and live proof
next-80: generated proof-grade artifacts
```

The top-20 set now has a latest-version refresh lane:

```text
data/latest-top20-refresh/
npm run top20:latest-refresh
```

That lane should be applied to the top-100 only after the six current top-20
update candidates are refreshed. Otherwise the repo would produce a larger but
less trustworthy matrix.

The top-100 update sequence is:

1. Keep the top-20 catalog-supported rows current and live-tested.
2. Promote a small wave of next-80 charts into bespoke, user-shaped variants.
3. For each promoted chart, add catalog status, production disposition,
   ConfigHub proof receipts, and live e2e receipts.
4. Only then add latest-version currentness columns for the broader top-100.

Generated next-80 rows remain valuable, but they are not the same as
catalog-supported entries until a human/product review has selected the
variants a real Helm user would choose.
