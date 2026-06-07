# Helm Import Contract

This repo treats Helm import as the path from a Helm render into a maintained
`cub installer` recipe/package.

`cub helm template` is the fast local render path:

```text
chart + values + flags -> rendered Kubernetes objects on disk/stdout
```

It is useful for inspection, debugging, CRD/resource split checks, and as the
regular Helm baseline for equivalence receipts.

`cub helm install` is the fast ConfigHub action path:

```text
chart + values + flags -> rendered Kubernetes objects -> ConfigHub Units
```

That is useful for a one-off ConfigHub load.

The maintained recipe path is different:

```text
chart or wrapper chart
plus values, overlays, dependency closure, and render context
-> cub installer recipe/package
-> supported base variants
-> rendered object revisions
-> Helm-equivalence receipts
-> scans, gates, upload/publish receipts, and live evidence
```

Import is the bridge between those paths. It should let a user graduate
from "render/load this chart now" to "maintain this chart as a reusable,
variant-aware, proof-bound catalog entry."

The intended product command is:

```text
cub installer import helm
```

Until that exists, this repo uses generators and proof scripts to create the
same import artifacts explicitly.

## What Import Must Capture

Every maintained import must record:

| Area | Required Artifact |
| --- | --- |
| chart identity | source lock with repository, chart, version, and digest |
| dependencies | dependency lock |
| render inputs | effective values, selected overlays, capability profile, target facts, generated facts policy |
| chart behavior | Helm pain report and control points |
| install shapes | supported base variants and package bases |
| rendered output | rendered objects, object inventory, and immutable revision |
| correctness | Helm-equivalence receipt comparing regular Helm output with `cub installer setup` output |
| safety | scan receipt and install gate |
| operation | ConfigHub upload/publish receipt, target facts, derived variant mapping, live or planned observation receipt |

## Where Choices Go

| User Choice | Route |
| --- | --- |
| Helm values file or `--set` changes rendered objects | importer creates or updates a `cub installer` base variant |
| Kustomize overlay changes rendered objects | importer treats it as a recipe/base overlay with a digest and rendered diff |
| wrapper chart plus platform/customer overlay values | managed overlay import; classify platform-owned, customer-owned, and target facts before render |
| existing Secret, StorageClass, IngressClass, CRD, API, or namespace requirement | recipe requirement plus variant target-fact binding |
| generated password/cert/random/time value | generated fact before render, then bind immutably |
| environment, region, target, labels, gates, observation policy | derived ConfigHub variant after upload; no Helm rerender |

The boundary is simple:

```text
If the Kubernetes objects change, go through import / recipe / base variant.
If only the operating context changes, use a derived ConfigHub variant.
```

## Golden Examples

| Example | What It Shows |
| --- | --- |
| Redis | public chart import with `default` and `reuse-existing-secret` bases |
| ExternalDNS managed overlay | wrapper chart plus platform values plus customer overlay values |
| Redis prod-us-east Creator golden | post-render ConfigHub variant from a reviewed base |

The generated workdown checks these examples in:

```text
data/attack-plan-workdown/helm-import-contract.csv
```

Regenerate and verify:

```sh
npm run attack-plan:generate
npm run attack-plan:verify
```
