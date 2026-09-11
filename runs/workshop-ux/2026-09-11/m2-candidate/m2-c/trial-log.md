# Trial log

- Guide discovered at local site: `site/index.html` → `Build an internal developer platform` → `Save, change and resume a local platform` → `workshop-compose-guide.html`.
- Command: `CUB_CONFIG=./cli/config.yaml cub stack sandbox ./plugin/stacks/kubara-gitops-shop.yaml --workspace ./compose-demo/platform` — exit 0; 184 objects; certified with warnings for namespaces, ClusterIssuer, ClusterSecretStore, and webhook caBundles.
- Command: `mv ./compose-demo/platform ./compose-demo/platform-moved` then `cub stack certify .../platform-moved/stack.yaml --json` — exit 0.
- Edited absolute file `./compose-demo/platform-moved/components/06-shop-web.yaml`: replicas 3 → 2 only.
- Candidate certify — exit 0. Candidate sandbox — exit 0. `git diff --no-index rendered.yaml changed.yaml` — exit 1, intended replica-only difference.
- Copied to `incompatible`; edited ExternalSecret API to v1beta1. Certification — exit 1, `version-not-served; externalsecrets.external-secrets.io serves v1`; refusal JSON retained.
- Copied to `recovered`; restored API v1. Certification — exit 0.
- Initial shell attempt failed because compose-demo workdir did not yet exist; created it and reran successfully. One recovery `sed` command was malformed; no source was lost, and recovery was completed with an absolute-path patch.
- Help needed for a real run: target cluster access and verification, namespaces, issuer/secret store, secrets, ingress/DNS/TLS, GitOps controller wiring, and health observation.
- No timings invented; no cluster/login/registry/publication/source edits performed.
