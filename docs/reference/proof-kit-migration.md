# Proof Kit — shared generator/verifier for chart proofs

## Problem

Each `scripts/<chart>-proof.mjs` historically carried a near-identical ~1,000-line
copy of the same generate / verify / package machinery. With 19 charts that is
**~24,300 lines, ~85–90% duplicated**. Consequences:

- A change to the proof contract (a new receipt field, a stronger digest check)
  means editing 19 files by hand.
- Drift risk: a fix can land in some copies and not others.
- The repo's `verify` gate hard-codes every chart × verb as a separate command.

## Solution

`scripts/lib/proof-kit.mjs` factors the identical control flow into one shared
module. Each chart script becomes a **declarative spec** plus a one-line call:

```js
import { runProofCli } from "./lib/proof-kit.mjs";
runProofCli({ chart, variants, scanPolicy, /* … */, verifyExtra });
```

The CLI surface is unchanged, so every existing `npm run <chart>:*` script and the
`verify` gate keep working verbatim:

```
--generate-proof  --generate-package  --verify-proof
--verify-proof-self-test  --verify-package  --compare
```

### Result for the reference chart (metrics-server)

| | lines |
| --- | ---: |
| `metrics-server-proof.mjs` before | 1000 |
| `metrics-server-proof.mjs` after | 218 |
| `scripts/lib/proof-kit.mjs` (shared, amortized over all charts) | 912 |

Projected across all 19 charts: **~5,050 lines vs ~24,300 → ~19,300 deleted (≈79%).**

## Equivalence evidence

This is a behaviour-preserving refactor. For metrics-server, against the
**unchanged committed artifacts**:

- `--verify-proof`, `--verify-proof-self-test`, and `--verify-package` all pass
  (the same three modes the `verify` gate runs; `--verify-package` exercises
  `cub installer package` + `cub installer setup` + the semantic Helm-vs-cub compare).
- `verify-installer-command-surface`, `verify-variant-command-surface`,
  `verify-p0-proof-contracts`, and `verify-doc-map` all pass
- **Byte-for-byte generation:** running `--generate-proof` with the old code and
  with the new code produces identical bytes (verified by regenerating under each
  and diffing). The only delta vs the committed tree is a pre-existing staleness in
  `recipe.yaml`'s digest that the *old* code reproduces too — unrelated to this change.

## Migrating a chart

1. Open `scripts/<chart>-proof.mjs`. Keep the `chart`, `variants`, and scan-policy
   objects as-is — they are already pure data.
2. Move the per-chart document bodies into the spec fields below (copy the object
   literals verbatim to preserve byte output): `valueModel`, `controlPoints`,
   `dossier`, `plan`, `readme`, `installGate`.
3. Move any chart-specific assertions from `verifyProof` into a `verifyExtra(ctx)`
   hook. The generic checks (required files, kinds, digest consistency, object
   counts, duplicate identities, equivalence/scan/gate digests, gate decision) are
   already in the kit — delete those copies.
4. Replace the function bodies and CLI dispatch with `runProofCli(spec)`.
5. Validate with **zero** working-tree churn:

   ```sh
   node scripts/<chart>-proof.mjs --verify-proof
   node scripts/<chart>-proof.mjs --verify-proof-self-test
   node scripts/<chart>-proof.mjs --verify-package      # needs cub (local, no network)
   ```

   For full confidence, regenerate to a scratch checkout and confirm
   `git diff` under `recipes/<repo>/<chart>/` is empty.

## Spec reference

Data fields:

- `chart` `{ repository, repositoryURL, name, version, releaseName, namespace, kubeVersion }`
- `variants[]` `{ name, base, displayName, valuesFile, valuesText, valuesSummary, expectedObjectCount, targetFactNote?, targetFacts? }`
- `scanPolicy` `{ scanner, version, rules[] }`
- `valueModel` `{ checkedValues[], unknownValues?, deadValues?, ignoredValues? }`
- `controlPoints[]`, `dossier { maintainedNotes[], knownControlPoints[] }`
- `plan { status, scanGate, nextAction }`, `readme { intro, proves[] }`
- `supportObjects?` — cub-only objects allowed in the diff (default `["v1|Namespace||<ns>"]`)
- `dependencies?`, `renderFlags?`, `helmChartRef?`, `receiptSlug?`, `scriptPrefix?`

Hooks:

- `installGate(variant) -> { decision, reasons, allowedScopes?, blockedScopes? }`
- `verifyExtra(ctx)` — chart-specific assertions; `ctx` exposes
  `{ root, controlPoints, perVariant, check, readYaml, readFileSync, join, … }`,
  where `perVariant.get(name)` returns the parsed
  `{ releasePath, releaseDigest, objects, identities, inventory, revision, renderReceipt, equivalence, scan, gate }`.

## Status & caveats

- `metrics-server` migrated (reference).
- 18 charts remaining, tracked in the migration issue.
- Charts with extra artifacts (e.g. target-facts collector shell scripts, multi-leg
  lifecycle hooks, multiple revisions) will extend the spec with additional hooks
  as they are migrated; the kit covers the core proof shape shared by all of them.
