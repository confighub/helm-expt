# bitnami/mysql 14.0.3 Proof

This is the promoted proof slice for the MySQL public Helm chart.

Variants:

- `generated-passwords`: MySQL root, user, and replication passwords bound as generated facts; image repository pinned to the still-pullable Bitnami legacy mirror with explicit image-substitution policy; 8 Helm objects, 9 cub installer objects including Namespace.
- `existing-secret`: target Secret supplies MySQL credentials; image repository pinned to the still-pullable Bitnami legacy mirror with explicit image-substitution policy; 7 Helm objects, 8 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart rendering is nondeterministic until generated credentials are bound;
- the generated-passwords variant persists auth.rootPassword, auth.password, and auth.replicationPassword before render;
- the existing-secret variant uses a declared target Secret and does not render a Secret;
- generated fact, target fact, lifecycle boundary, dependency lock, StatefulSet/PVC, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run mysql:generate-proof
npm run mysql:generate-package
npm run mysql:verify-proof
npm run mysql:verify-package
npm run mysql:compare
```
