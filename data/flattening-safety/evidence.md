# What the catalog's charts actually contain

Every catalog entry with a recorded witness is scanned for the constructs that render-time flattening loses. This view reports what 132 packaged charts contain. It does not decide whether any of them may ship as flattened YAML: that is a flattening-safety verdict, which weighs values gating, the audited base, and the routes available to discharge each construct. 32 of these chart versions have a decided lane today; the rest read "not yet decided" rather than reading as safe by omission.

| construct | charts | share | what it costs a flattened bundle |
| --- | --- | --- | --- |
| capabilities | 96 | 73% | the wrong apiVersion for the target cluster |
| crds | 61 | 46% | per-file Units race the CRDs they depend on |
| lookup | 49 | 37% | renders valid but wrong, because it read a cluster that was not there |
| hooks | 47 | 36% | Hook Jobs never fire, or fire under a different hook dialect |
| generated-secrets | 40 | 30% | one credential draw frozen into a shared artifact |
| gated-subcharts | 31 | 23% | the flatten step must render with the audited base's condition set |
| keep-policy | 30 | 23% | a reconciler prunes what Helm promised to keep |
| webhooks | 27 | 20% | an empty caBundle makes admission fail closed |
| test-hooks | 24 | 18% | stray test resources shipped to a cluster |
| namespace | 7 | 5% | the namespace ships, or must exist first |

Two readings are worth keeping in view. A construct being present does not mean a chart is unflattenable: most are values-gated, and a verdict records which ones the audited base actually reaches. And a construct being absent from the packaged chart is a real finding, because it is exactly what makes a chart cheap to certify.

This lane also answers the keep-policy axis that `data/quirk-coverage/coverage.csv` records as unscanned. It is scanned here, from chart source, for every entry with a witness.

Per-chart rows are in `evidence.csv`. Scan status per catalog entry, including charts whose upstream bytes moved under a fixed version, is in `witness-coverage.md`. Regenerate with `npm run flattening-evidence`; verify with `npm run flattening-evidence:verify`.
