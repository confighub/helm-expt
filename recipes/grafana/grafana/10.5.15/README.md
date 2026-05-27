# grafana/grafana 10.5.15 Proof

This is the promoted proof slice for the Grafana public Helm chart.

Variants:

- `generated-passwords`: Grafana admin password bound as a generated fact; 9 Helm objects, 10 cub install objects including Namespace.
- `existing-secret-ingress`: target Secret supplies Grafana admin credentials and UI ingress is explicit; 9 Helm objects, 10 cub install objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub install setup`, plus the explained Namespace support object;
- this chart version is marked deprecated upstream, and the proof records that risk explicitly;
- default chart rendering is nondeterministic until the admin password is bound;
- the generated-passwords variant persists adminPassword before render;
- the existing-secret-ingress variant uses a declared target Secret, does not render a Secret, and adds explicit UI ingress exposure;
- generated fact, target fact, RBAC, UI ingress, deployment, sidecar, provisioning, and Secret/env extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run grafana:generate-proof
npm run grafana:generate-package
npm run grafana:verify-proof
npm run grafana:verify-package
npm run grafana:compare
```
