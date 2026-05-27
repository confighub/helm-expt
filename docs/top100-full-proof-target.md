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
- deterministic `cub install package` output;
- `cub install setup` output semantically matching regular Helm output, aside
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
