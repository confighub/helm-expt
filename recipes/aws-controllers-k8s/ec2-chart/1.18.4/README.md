# aws-controllers-k8s/ec2-chart 1.18.4 Proof

This recipe proves the ACK EC2 controller chart 1.18.4 renders deterministically and flattens safely. Two bases render 32 objects each, and the difference between them is operational posture rather than shape. The default base audits the chart exactly as shipped, where deletionPolicy delete means a pruned manifest deletes the AWS resource behind it. The eks-inference base sets retain, mounts credentials from a pre-existing aws-creds Secret, and renders the region as a ConfigHub placeholder so an unbound environment fails validation instead of reaching a cluster.

Variants:

- `default`: chart defaults with no overrides; audit base with empty AWS_REGION, no credential wiring, and deletionPolicy delete; 32 Helm objects, 33 cub installer objects including Namespace.
- `eks-inference`: eks-inference producer values: deletionPolicy retain, aws-creds Secret mount, region rendered as the ConfigHub sentinel; 32 Helm objects, 33 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- both bases render the same 32-object shape deterministically from the artifact-addressed OCI package under the pinned Kubernetes capability profile;
- the chart carries no hooks, lookups, or generated secrets; its 22 CRDs are the one construct that needs a companion, and the ordering declaration ships with the bundle;
- the deletionPolicy-vs-prune hazard, the aws-creds target Secret, and the region placeholder are visible as recorded control points and gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run ack-ec2:generate-proof
npm run ack-ec2:generate-package
npm run ack-ec2:verify-proof
npm run ack-ec2:verify-package
npm run ack-ec2:compare
```
