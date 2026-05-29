# argo-cd/argo-cd 9.5.15 Proof

This is the promoted proof slice for the Argo CD public Helm chart.

Variants:

- `default`: chart defaults; 49 Helm objects, 50 cub installer objects including Namespace.
- `no-crds`: Argo CD CRDs disabled; 46 Helm objects, 47 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the no-crds variant deliberately removes the three Argo CD CRDs;
- CRD lifecycle, Helm hook lifecycle, generated Secret ownership, disabled dependency, StatefulSet, GitOps handoff, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run argo-cd:generate-proof
npm run argo-cd:generate-package
npm run argo-cd:verify-proof
npm run argo-cd:verify-package
npm run argo-cd:compare
```
