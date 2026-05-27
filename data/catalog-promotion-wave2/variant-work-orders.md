# Wave-2 Real Variant Work Orders

These are the concrete variant jobs that turn proof-grade/default charts into
catalog-promotion candidates. They are not catalog support claims yet.

| Chart | Variants | Current state |
| --- | --- | --- |
| `traefik/traefik@40.2.0` | default, external-crds, internal-clusterip-dashboard-off, cloud-loadbalancer | not-yet-rendered |
| `external-dns/external-dns@1.21.1` | route53-irsa, cloudflare-existing-secret, dry-run-txt-registry | not-yet-rendered |
| `vmware-tanzu/velero@12.0.1` | aws-s3-existing-secret, azure-blob-existing-secret, filesystem-backup-node-agent | not-yet-rendered |
| `istio-official/istiod@1.30.0` | revisioned-control-plane, external-ca, minimal-profile | not-yet-rendered |
| `kyverno/kyverno@3.8.1` | default-admission, external-crds, ha-admission-reports | not-yet-rendered |

## Rule

A row becomes promotable only after every listed variant is represented as a
real recipe variant, package base, rendered revision, scan/gate receipt, and
Helm-equivalence receipt.
