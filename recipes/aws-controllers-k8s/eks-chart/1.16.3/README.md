# aws-controllers-k8s/eks-chart 1.16.3 Proof

This is the promoted proof slice for the ACK service controller for Amazon EKS, pulled from oci://public.ecr.aws/aws-controllers-k8s/eks-chart at version tag 1.16.3 and pinned by packageSHA256. Both bases render 20 objects: ten CRDs (eight eks.services.k8s.aws kinds plus two shared services.k8s.aws kinds) and ten controller objects, of which six are namespaced in ack-system and four are cluster-scoped RBAC objects.

Variants:

- `default`: chart defaults with no overrides; audits the chart exactly as shipped, including deletionPolicy delete and an empty AWS_REGION; 20 Helm objects, 21 cub installer objects including Namespace.
- `eks-inference`: deletionPolicy retain, aws-creds credentials Secret mounted read-only, aws.region held as the confighubplaceholder sentinel; 20 Helm objects, 21 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- both bases render the same 20-object identity set deterministically under the pinned 1.31.0 capability profile;
- the chart ships no hooks, no lookups, and no generated secrets, so the flattened bundle equals the Helm render, and the ten CRDs carry the one required route, an ordering declaration shipped downstream as the crds/controller split;
- the eks-inference base pins deletionPolicy retain so a pruned Cluster resource cannot tear down a live control plane, mounts the aws-creds credentials Secret as an explicit target prerequisite, and holds aws.region as the confighubplaceholder sentinel until the awsRegion installer input fills AWS_REGION by name.

Useful commands:

```sh
npm run ack-eks:generate-proof
npm run ack-eks:generate-package
npm run ack-eks:verify-proof
npm run ack-eks:verify-package
npm run ack-eks:compare
```
