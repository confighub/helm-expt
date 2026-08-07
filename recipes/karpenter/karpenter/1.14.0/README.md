# karpenter/karpenter 1.14.0 Proof

This recipe covers karpenter/karpenter 1.14.0, the AWS node provisioner, rendered against kubeVersion 1.31.0 from the digest-pinned artifact oci://public.ecr.aws/karpenter/karpenter:1.14.0. Three bases exist. The default base renders chart defaults plus the one required value, settings.clusterName, as the confighubplaceholder sentinel, and produces 18 objects including the 5 Karpenter CRDs. The eks-inference base carries the platform values for the inference-demo cluster and also produces 18 objects, while crds-managed renders the same values without CRDs for platforms where the karpenter-crd chart owns them, producing 13. The chart has no hooks, no lookups, and no generated secrets; its hazards are the required cluster name, the AWS_REGION env the chart never supplies, and CRD ordering.

Variants:

- `default`: chart defaults plus the required settings.clusterName rendered as the confighubplaceholder sentinel; carries the 5 Karpenter CRDs in-bundle; 18 Helm objects, 19 cub installer objects including Namespace.
- `eks-inference`: inference-demo platform values: replicas 1, pinned serviceAccount name, AWS_REGION placeholder env, bounded resources; carries the 5 Karpenter CRDs in-bundle; 18 Helm objects, 19 cub installer objects including Namespace.
- `crds-managed`: same platform values as eks-inference rendered without CRDs for platforms where the karpenter-crd chart owns them; 13 Helm objects, 14 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- renders are deterministic and keyed to the digest-pinned oci artifact under the pinned 1.31.0 capability profile;
- the CRD story splits by variant: default and eks-inference carry the 5 CRDs in-bundle while crds-managed renders without them for platforms where the karpenter-crd chart owns them;
- the environment-owned values (settings.clusterName and AWS_REGION) stay visible as confighubplaceholder sentinels and the install gate refuses while they remain.

Useful commands:

```sh
npm run karpenter:generate-proof
npm run karpenter:generate-package
npm run karpenter:verify-proof
npm run karpenter:verify-package
npm run karpenter:compare
```
