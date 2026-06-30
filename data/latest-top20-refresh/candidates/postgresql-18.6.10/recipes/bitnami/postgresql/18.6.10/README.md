# bitnami/postgresql 18.6.10 Proof

This is the promoted proof slice for the PostgreSQL public Helm chart.

Variants:

- `static-passwords`: postgres admin password bound as a generated fact; 7 Helm objects, 8 cub installer objects including Namespace.
- `existing-secret`: target Secret supplies PostgreSQL credentials; 6 Helm objects, 7 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart rendering is nondeterministic until generated credentials are bound;
- the static-passwords variant persists auth.postgresPassword before render;
- the existing-secret variant uses a declared target Secret and does not render a Secret;
- both supported bases pin the PostgreSQL image digest instead of rendering a mutable latest tag;
- generated fact, target fact, lifecycle boundary, dependency lock, StatefulSet/PVC, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run postgresql:generate-proof
npm run postgresql:generate-package
npm run postgresql:verify-proof
npm run postgresql:verify-package
npm run postgresql:compare
```
