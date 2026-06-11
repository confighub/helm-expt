# external-secrets/external-secrets@2.5.0 Production Packet

This generated packet summarizes the current support story for a hard chart. It
is a navigation surface over existing evidence, not a new support decision.

## Current Answer

| Field | Value |
| --- | --- |
| Supported base | `default` |
| Support decision | `draft` |
| Production disposition | `production-review-ready` |
| Target scope | cub-lk-kind-vanilla; namespace=external-secrets; delivery=confighub-oci; controller=argo |
| Delivery path | `confighub-oci` |
| Evidence count | 18 |
| Strongest user-facing evidence | live-helm-vs-confighub-parity |
| Live summary | local:1/2 gitops:1/2 live-parity:1/2 two-cluster:2/2 |

## Why This Chart Is Hard

CRD-owning secrets controller where install readiness, webhook Secret delivery, and provider SecretStore/ExternalSecret reconciliation are separate lifecycle facts.

## What A User Can Safely Do Today

Use default for the controller install with the recorded separated-Secret prerequisite. The disposable fake-provider round trip is proven; production providers and credentials still need separate bases, overlays, or derived variants with provider-specific evidence.

## What Remains Before Broader Production Use

Run a Kubernetes 1.31+ capability-profile witness, or create a profile-specific base, before final production support.

## Bases

| Base | User readiness | Lane summary | Target facts | Command |
| --- | --- | --- | --- | --- |
| `default` | start-here | render=pass; confighub=pass; local=pass; gitops=pass; live-parity=pass; two-cluster=pass; lifecycle=pass | required Secret external-secrets/external-secrets-webhook | `cub installer setup --pull packages/external-secrets/external-secrets/2.5.0 --base default --work-dir <tmp> --non-interactive --namespace external-secrets` |
| `no-crds` | try-with-proof | render=pass; confighub=missing; local=missing; gitops=blocked; live-parity=missing; two-cluster=pass; lifecycle=pass | required Secret external-secrets/external-secrets-webhook; required CRD acraccesstokens.generators.external-secrets.io; required CRD cloudsmithaccesstokens.generators.external-secrets.io; required CRD clusterexternalsecrets.external-secrets.io; required CRD clustergenerators.generators.external-secrets.io; required CRD clusterpushsecrets.external-secrets.io; required CRD clustersecretstores.external-secrets.io; required CRD ecrauthorizationtokens.generators.external-secrets.io; required CRD externalsecrets.external-secrets.io; required CRD fakes.generators.external-secrets.io; required CRD gcraccesstokens.generators.external-secrets.io; required CRD generatorstates.generators.external-secrets.io; required CRD githubaccesstokens.generators.external-secrets.io; required CRD grafanas.generators.external-secrets.io; required CRD mfas.generators.external-secrets.io; required CRD passwords.generators.external-secrets.io; required CRD pushsecrets.external-secrets.io; required CRD quayaccesstokens.generators.external-secrets.io; required CRD secretstores.external-secrets.io; required CRD sshkeys.generators.external-secrets.io; required CRD stssessiontokens.generators.external-secrets.io; required CRD uuids.generators.external-secrets.io; required CRD vaultdynamicsecrets.generators.external-secrets.io; required CRD webhooks.generators.external-secrets.io | `cub installer setup --pull packages/external-secrets/external-secrets/2.5.0 --base no-crds --work-dir <tmp> --non-interactive --namespace external-secrets` |

## Quirks And Inputs

| Field | Value |
| --- | --- |
| Quirks surfaced | crds;existing-secret;extension-slots |
| User must provide | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) |
| ConfigHub / installer absorbs | exact rendered objects with render parity and receipts; CRD handling split into explicit bases; extension slots routed to reviewed bases |
| Extension slot route | none recorded |

## Decision Details

| Decision | State |
| --- | --- |
| Image policy | `mutable-image-exception-accepted-for-target-scope` |
| Scan policy | `resource-policy-accepted-for-target-scope` |
| Lifecycle policy | `lifecycle-observed-for-proof-scope` |
| Target facts | `explicit-separated-secret-prerequisite-rehearsed-for-target-scope` |
| Live evidence | `fresh-target-evidence-passed-with-prestaged-secret-prerequisite` |

## Evidence Links

- [Production support decision](../../production-support-decisions/external-secrets-external-secrets/support-decision.yaml)
- [Production disposition table](../../production-disposition/top20.csv)
- [Per-chart catalog](../../../recipes/external-secrets/external-secrets/2.5.0/CATALOG.md)
- [Installer package](../../../packages/external-secrets/external-secrets/2.5.0)
- [Helm pain report](../../../recipes/external-secrets/external-secrets/2.5.0/helm-pain-report.yaml)
- [Public chart page](../../../site/charts/external-secrets-external-secrets-2-5-0.html)

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
