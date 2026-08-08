# Deciding a flattening lane

A witness is a static scan of a packaged chart. A lane is a decision about whether that chart may ship as flattened YAML. This is how the second is produced from the first.

The decision table lives in `scripts/generate-flattening-safety-verdicts.mjs`. Nothing here is automatic, and the reason is written into the first rule below.

## The four lanes

- **safe-to-flatten.** Nothing the audited base renders is discharged at render time.
- **flatten-with-routes.** Flattening is safe once named companion artifacts travel with the bundle.
- **do-not-flatten.** Something the base renders cannot be recovered by any companion the catalog can emit. The installer package is that chart's certified route.
- **born-flattened.** The source never rendered in the first place.

A lane is decided per base, not per chart. The same chart with `auth.existingSecret` set is a different question from the same chart without it, and `variantScope` records which values move the answer.

## Rule one: the scan says what a chart contains, not what it calls

This is the rule that produces the most wrong drafts, so it comes first.

A packaged chart carries its whole dependency tree, including library charts it may never invoke. All six bitnami charts in the catalog package `charts/common/templates/_secrets.tpl`, whose lookup-or-generate credential helper is the classic do-not-flatten finding. Five of them call it. nginx does not — it has no credential to manage at all, and its real hazard is `genCA` in `templates/tls-secret.yaml`. A first pass gave all six the same rationale, and five of them were right for the wrong reason.

Before citing a finding, check whether it is in the chart's own `templates/` or only in a vendored subchart, and if only vendored, find the call site or drop the claim.

## Rule two: read the defaults before calling anything gated

`present-gated` is the most attractive finding to write and the easiest to get backwards. It means the construct exists and the audited base does not render it.

The prometheus chart's four subcharts look optional and are `enabled: true`. A first pass recorded a variant note saying enabling them would widen the scan, when the scan had already covered them. Loki's minio and rollout-operator subcharts genuinely are off, and its enterprise provisioner is gated behind two values at once.

Open the chart's `values.yaml` and confirm the gate's default before writing `present-gated`.

## Rule three: an empty shell is not a frozen secret

Two constructs look alarming and are often resolutions rather than debts.

An **empty `caBundle`** usually means a flattened bundle ships admission that nothing can satisfy, which is what decides ingress-nginx and kube-prometheus-stack. It means the opposite when the controller that fills it travels inside the same bundle. Vault's injector is named in `AGENT_INJECT_TLS_AUTO` and holds `patch` on `mutatingwebhookconfigurations`; cert-manager's cainjector, external-secrets' cert-controller and gatekeeper's controller are the same pattern. Establish which by reading the RBAC, not by seeing the empty string.

A **Secret with no data** is a placeholder a controller writes into, not a credential frozen into a public artifact. Gatekeeper ships exactly that and a live run recorded it being populated.

## Rule four: decide the version the catalog supports

The supported version is usually older than the newest one available, and its findings can differ. The top-20 batch decided redis 25.5.3, not the 27.0.0 audited earlier, and cert-manager v1.20.2 rather than v1.21.0. Deciding the wrong version produces a verdict no chart page can cite.

## Rule five: adversarially verify before landing

Every batch so far has produced errors that survived drafting and died on contact with the chart source. Draft the lane from the witness, then open the packaged chart and try to refute each finding. Rules one through three exist because that pass caught them.

`scripts/scan-flattening-witnesses-all.mjs` keeps its downloads in a cache, so the tarball is usually already on disk.

## Rule six: a lane that needs a companion must be able to get one

`flatten-with-routes` names artifacts that have to exist. Before choosing it, check that the class has a route kind that can discharge it: hooks take `lifecycle-job`, keep policy takes `prune-protection`, CRDs take `apply-ordering`, credentials take `external-secret-reference`.

A chart whose hooks cannot be expressed as an ordered set of actions is `do-not-flatten`, not `flatten-with-routes` with an aspiration. Consul's forty-four hook objects across nine phase combinations are the current example.

## What the verdict must say

Every entry carries a `rationale` in plain sentences saying what decided it, and a `variantScope` naming the values that would move it. Findings that the render cannot settle stay `not-evaluated` with the reason, never absent by omission.

Then regenerate in this order, because the site reads the catalog and the catalog reads the verdicts:

```bash
npm run flattening-safety -- --generate && npm run flattening-evidence -- --generate && npm run certified-bundles -- --generate && npm run npm-scripts:catalog -- --generate && npm run data:index -- --generate && npm run site:generate
```

Then `npm run chart-claim-integrity:verify`, which refuses any page asserting a flattening claim its verdict does not back.

## What a decided lane does not mean

It does not mean a bundle exists, and it does not mean one will. Publication is a separate step gated on the lane permitting it. A `do-not-flatten` entry must never carry a certified-bundle receipt, and `scripts/publish-certified-bundles.mjs` refuses to produce one.

It also says nothing about runtime health. The verdict weighs what flattening loses at render time, not whether the result converges on a cluster.
