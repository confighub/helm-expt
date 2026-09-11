# Trial log

- Discovered `/site/kubara.html` from the homepage platform path.
- Executed the local sandbox and retained baseline workspace and receipts.
- Applied one authorized edit: shop-web replicas 3 -> 2.
- Certified and rendered the changed workspace; diff verified only that replica field changed.
- Copied the full workspace, changed only ExternalSecret API to v1beta1, and preserved the exit-1 JSON refusal.
- No errors requiring help. The refusal is expected and documents that the bundled CRD serves only `external-secrets.io/v1`.
- Help needed for real deployment: target namespaces and prerequisite resources, cluster access, secrets/issuer configuration, GitOps controller wiring, and live health/response verification.
- Proven: local static artifacts and checks above. Unknown/not run: all target and runtime behavior; no cluster or publication actions.
