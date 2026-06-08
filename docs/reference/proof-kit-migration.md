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

### Result for migrated charts

| Chart | Current script lines |
| --- | ---: |
| `metrics-server-proof.mjs` | 218 |
| `ingress-nginx-proof.mjs` | 182 |
| `cert-manager-proof.mjs` | 292 |
| `postgresql-proof.mjs` | 237 |
| `external-secrets-proof.mjs` | 328 |
| `nginx-proof.mjs` | 385 |
| `kube-prometheus-stack-proof.mjs` | 352 |
| `mysql-proof.mjs` | 247 |
| `mongodb-proof.mjs` | 257 |
| `grafana-proof.mjs` | 251 |
| `prometheus-proof.mjs` | 298 |
| `tempo-proof.mjs` | 362 |
| `secrets-store-csi-driver-proof.mjs` | 240 |
| `vault-proof.mjs` | 259 |
| `longhorn-proof.mjs` | 242 |
| `argo-cd-proof.mjs` | 245 |
| `loki-proof.mjs` | 384 |
| `rabbitmq-proof.mjs` | 262 |
| `scripts/lib/proof-kit.mjs` (shared, amortized over all migrated charts) | 1005 |

The original proof scripts were usually around 1,000 lines each. The migrated
scripts are now chart specs plus chart-specific checks, while the repeated
generate/verify/package machinery lives in `scripts/lib/proof-kit.mjs`.

## Equivalence evidence

This is a behaviour-preserving refactor. For each migrated chart, against the
**unchanged committed artifacts**:

- `--verify-proof`, `--verify-proof-self-test`, and `--verify-package` all pass
  (the same three modes the `verify` gate runs; `--verify-package` exercises
  `cub installer package` + `cub installer setup` + the semantic Helm-vs-cub compare).
- The migration PRs regenerate the committed proof artifacts without semantic
  product changes.
- Known pre-existing digest drift remains out of scope when the old script
  reproduced it too. Migration PRs should not mix refactor and behavior changes.

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
- `variants[]` `{ name, base, displayName, valuesFile, valuesText, valuesSummary, expectedObjectCount, targetFactNote?, targetFacts?, apiVersions? }`
- `variants[].targetFacts.requiredSecrets[]` — when present, generated packages include installer-native `externalRequires` and a target-facts collector script
- package setup receipts mark each base as `targetFactMode: collector-facts` or `not-required`
- `scanPolicy` `{ scanner, version, rules[] }`
- `valueModel` `{ checkedValues[], unknownValues?, deadValues?, ignoredValues? }`
- `controlPoints[]`, `dossier { maintainedNotes[], knownControlPoints[] }`
- `dossier.extra?` — extra chart-specific dossier fields, such as a successor chart note
- `plan.extraReadiness?` — additional HelmPlan readiness fields, such as a default-render status
- `plan { status, scanGate, nextAction }`, `readme { intro, proves[] }`
- `supportObjects?` — cub-only objects allowed in the diff (default `["v1|Namespace||<ns>"]`)
- `dependencies?`, `renderFlags?`, `helmChartRef?`, `receiptSlug?`, `scriptPrefix?`
- `extraRequiredFiles?` — additional proof files that must exist, such as a default-render blocker

Hooks:

- `installGate(variant) -> { decision, reasons, allowedScopes?, blockedScopes? }`
- `extraProofDocuments({ ctx, source }) -> [{ path, document }]` — optional generated proof files written after source/dependency locks
- `extraEquivalenceClassifications(variant) -> []` — optional Helm equivalence classifications in addition to installer support objects
- `allowedSemanticDiff({ key, helmObjectJson, cubObjectJson, variant }) -> boolean` — optional package-setup compare allowance for documented serialization differences
- `verifyExtra(ctx)` — chart-specific assertions; `ctx` exposes
  `{ root, controlPoints, perVariant, check, readYaml, readFileSync, join, … }`,
  where `perVariant.get(name)` returns the parsed
  `{ releasePath, releaseDigest, objects, identities, inventory, revision, renderReceipt, equivalence, scan, gate }`.

## Status & caveats

Migrated to the shared proof kit:

```text
metrics-server
ingress-nginx
cert-manager
postgresql
external-secrets
nginx
kube-prometheus-stack
mysql
mongodb
grafana
prometheus
tempo
secrets-store-csi-driver
vault
longhorn
argo-cd
loki
rabbitmq
```

Remaining chart proof scripts:

```text
consul
```

Redis remains bespoke because it is the first complete proof slice and has
additional user-install verification helpers.

Charts with extra artifacts, target-fact collector scripts, multi-leg lifecycle
hooks, or multiple revisions will extend the spec with additional hooks as they
are migrated. The kit should continue to cover only the shared proof shape; new
product behavior belongs in separate PRs.
