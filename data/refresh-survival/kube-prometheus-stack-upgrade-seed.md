# kube-prometheus-stack Upgrade Seed

This is the narrow seed for the upgrade-story lane. It uses
`prometheus-community/kube-prometheus-stack` because this chart exercises the
hard parts of Helm support: CRDs, admission webhooks, generated credentials,
dependencies, cluster RBAC, and many rendered monitoring resources.

## Scope

| Item | Value |
| --- | --- |
| Chart | `prometheus-community/kube-prometheus-stack` |
| Current supported proof | `85.3.3` |
| Latest candidate | `86.1.0` |
| Variants | `default;no-crds` |
| Kubernetes profile | kind Kubernetes 1.30 for current live receipts; candidate live upgrade not run yet |

## Render Seed

| Variant | Current object count | Candidate object count | Current evidence | Candidate evidence |
| --- | ---: | ---: | --- | --- |
| `default` | 124 | 124 | `recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/object-inventory.yaml` | `data/latest-top20-refresh/candidates/kube-prometheus-stack-86.1.0/recipes/prometheus-community/kube-prometheus-stack/86.1.0/revisions/default/r001/rendered/object-inventory.yaml` |
| `no-crds` | 114 | 114 | `recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/no-crds/r001/rendered/object-inventory.yaml` | `data/latest-top20-refresh/candidates/kube-prometheus-stack-86.1.0/recipes/prometheus-community/kube-prometheus-stack/86.1.0/revisions/no-crds/r001/rendered/object-inventory.yaml` |

The candidate has render proof only. It is not a supported catalog replacement.

## Required Upgrade Proof

Before replacing the supported catalog version, the upgrade lane must produce:

1. old rendered object set versus new rendered object set;
2. field-level diff with provenance where available;
3. CRD lifecycle review for install and upgrade ordering;
4. webhook and generated-credential route review;
5. scan and gate receipts for the new rendered revision;
6. ConfigHub upload, function scan, safe-ops, and server-side variant receipts;
7. live kind observation before and after upgrade;
8. live Helm-vs-ConfigHub parity for the upgraded target profile;
9. updated catalog, production disposition, top100, and top500 outputs.

## Current Decision

Keep `85.3.3` as the supported catalog version. Treat
`86.1.0` as a candidate until the lanes above pass or are
explicitly routed.

## Verify

```sh
npm run refresh:survival:verify
```
