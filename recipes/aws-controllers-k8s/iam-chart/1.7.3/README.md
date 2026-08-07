# aws-controllers-k8s/iam-chart 1.7.3 Proof

This is the promoted proof slice for the ACK IAM controller chart 1.7.3, pulled as the exact artifact oci://public.ecr.aws/aws-controllers-k8s/iam-chart and pinned by digest in source-lock.yaml.

Variants:

- `default`: chart defaults with no overrides; audits the chart exactly as shipped; 19 Helm objects, 20 cub installer objects including Namespace.
- `eks-inference`: retained inference values: region sentinel, deletionPolicy retain, aws-creds credentials Secret reference; 19 Helm objects, 20 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- both bases render the same 19 objects deterministically under the pinned 1.31.0 capability profile, and the only rendered difference sits in the controller environment (region, deletion policy, credentials mount);
- the aws.region value stays confighubplaceholder on purpose because the region belongs to the environment, and vet-placeholders blocks any render that still carries the sentinel;
- the chart has no hooks, no lookups and no generated secrets, so the flattening verdict is flatten-with-routes with the CRD ordering declaration for the nine crds/-shipped CRDs as the one companion;
- deletionPolicy (delete vs retain under a pruning reconciler) and cluster-scoped RBAC are visible as gate reasons and scan findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run ack-iam:generate-proof
npm run ack-iam:generate-package
npm run ack-iam:verify-proof
npm run ack-iam:verify-package
npm run ack-iam:compare
```
