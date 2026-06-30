# bitnami/mongodb 19.0.7 Proof

This is the promoted proof slice for the MongoDB public Helm chart.

Variants:

- `static-passwords`: MongoDB root password bound as a generated fact; 8 Helm objects, 9 cub installer objects including Namespace.
- `existing-secret-replicaset`: target Secret supplies MongoDB credentials and replica-set key; 10 Helm objects, 11 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart rendering is nondeterministic until the generated root password is bound;
- the static-passwords variant persists auth.rootPassword before render;
- the existing-secret-replicaset variant uses a declared target Secret, does not render a Secret, and changes topology to replica set;
- the replica-set target fact must satisfy MongoDB keyfile requirements, not merely exist;
- both supported bases pin the MongoDB image digest instead of rendering a mutable latest tag;
- generated fact, target fact, no-hooks lifecycle boundary, dependency lock, Deployment/PVC and StatefulSet storage, NetworkPolicy/PDB, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run mongodb:generate-proof
npm run mongodb:generate-package
npm run mongodb:verify-proof
npm run mongodb:verify-package
npm run mongodb:compare
```
