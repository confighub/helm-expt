# bitnami/mongodb 19.0.9 Proof

This is the promoted proof slice for the MongoDB public Helm chart.

Variants:

- `generated-passwords`: MongoDB root password bound as a generated fact; 8 Helm objects, 9 cub installer objects including Namespace.
- `existing-secret-replicaset`: target Secret supplies MongoDB credentials and replica-set key; 10 Helm objects, 11 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart rendering is nondeterministic until the generated root password is bound;
- the generated-passwords variant persists auth.rootPassword before render;
- the existing-secret-replicaset variant uses a declared target Secret, does not render a Secret, and changes topology to replica set;
- generated fact, target fact, Helm hook lifecycle, dependency lock, Deployment/StatefulSet storage, NetworkPolicy/PDB, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run mongodb:generate-proof
npm run mongodb:generate-package
npm run mongodb:verify-proof
npm run mongodb:verify-package
npm run mongodb:compare
```
