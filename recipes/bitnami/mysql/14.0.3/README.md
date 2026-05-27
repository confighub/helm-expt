# bitnami/mysql 14.0.3 Proof

This is the promoted proof slice for the MySQL public Helm chart.

Variants:

- `generated-passwords`: MySQL root, user, and replication passwords bound as generated facts; 8 Helm objects, 9 cub install objects including Namespace.
- `existing-secret`: target Secret supplies MySQL credentials; 7 Helm objects, 8 cub install objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub install setup`, plus the explained Namespace support object;
- default chart rendering is nondeterministic until generated credentials are bound;
- the generated-passwords variant persists auth.rootPassword, auth.password, and auth.replicationPassword before render;
- the existing-secret variant uses a declared target Secret and does not render a Secret;
- generated fact, target fact, Helm hook lifecycle, dependency lock, StatefulSet/PVC, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run mysql:generate-proof
npm run mysql:generate-package
npm run mysql:verify-proof
npm run mysql:verify-package
npm run mysql:compare
```
