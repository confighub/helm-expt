# Catalog Promotion Wave 2

This is the next human/product promotion slice after the top-20 local-test
support pass.

The point is not to declare these charts supported yet. The point is to choose
five proof-grade/default charts where adding real user-shaped variants will
test whether the catalog is actually simpler and safer than plain Helm.
Some already have basic machine-generated variants such as default/no-crds.
Wave 2 is about promoting useful user-shaped variants, not merely counting
rendered bases.

## Selected Charts

| Rank | Chart | Version | Proposed real variants | Why |
| ---: | --- | --- | --- | --- |
| 8 | `traefik/traefik` | 40.2.0 | default, external-crds, internal-clusterip-dashboard-off, cloud-loadbalancer | Very high-rank ingress controller with CRDs, RBAC, webhooks, generated/source signals, and exposure choices. |
| 18 | `external-dns/external-dns` | 1.21.1 | route53-irsa, cloudflare-existing-secret, dry-run-txt-registry | Small, familiar controller where the useful variants are provider and credential choices, not YAML ceremony. |
| 30 | `vmware-tanzu/velero` | 12.0.1 | aws-s3-existing-secret, azure-blob-existing-secret, filesystem-backup-node-agent | Backup/restore is a strong production story: provider credentials, object storage, CRDs, and restore safety are visible. |
| 35 | `istio-official/istiod` | 1.30.0 | revisioned-control-plane, external-ca, minimal-profile | Service mesh control plane proves ConfigHub can explain hard platform charts without pretending they are simple. |
| 38 | `kyverno/kyverno` | 3.8.1 | default-admission, external-crds, ha-admission-reports | Policy engine exercises hooks, lookup, generated facts, CRDs, admission webhooks, and controller sizing. |

## Acceptance

For each chart, promotion requires:

- actual `variants/<name>/variant.yaml` files;
- matching `packages/.../bases/<name>` package bases;
- rendered object inventory and immutable revision per variant;
- Helm-equivalence, render, scan, install-gate, and package receipts;
- explicit production dispositions for scan/gate warnings;
- live/e2e observation requirements before production support is claimed.

Until then these remain proof-grade candidates, not catalog-supported recipes.
