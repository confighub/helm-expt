# Local Kubara shop platform trial

## Guide followed

Started at `http://127.0.0.1:8766/site/index.html` and followed **Build an internal developer platform** at `/site/kubara.html`. The retained selection was `kubara-shop-platform`: cert-manager, traefik, metrics-server, external-secrets, and the authored `shop-web` app.

## Produced artifacts

- Baseline workspace: `./platform/`
- Baseline files retained: `stack.yaml`, `components/`, `rendered.yaml`, `result.json`
- Changed files: `platform/components/05-shop-web.yaml`, `platform/changed-result.json`, `platform/changed.yaml`
- Refusal copy: `./incompatible/`; refusal at `incompatible/refusal.json`

## Commands and results

Every `cub` invocation used `CUB_CONFIG=./cli/config.yaml`.

1. `cub stack sandbox kubara-shop-platform --workspace ./platform` exited 0; certified 135 objects.
2. Changed only `shop-web` Deployment `spec.replicas`, 3 to 2. `cub stack certify .../platform/stack.yaml --json` exited 0; `cub stack sandbox .../stack.yaml --out .../platform/changed.yaml` exited 0.
3. The rendered diff contains exactly one semantic change: `shop-web` Deployment replicas 3 to 2.
4. Copied the complete platform directory to `incompatible`, changed only the shop-web `ExternalSecret` API from `external-secrets.io/v1` to `external-secrets.io/v1beta1`. Certification exited 1 and wrote `certified: false`; refusal: `version-not-served` because the bundled CRD serves `v1`.

Hashes: baseline `rendered.yaml` SHA-256 `a438918e4c9fd5a3c6ffbdc80ff0917aad2ed985dc552c9ee6a7bad5c75fd838` (3,634,725 bytes); changed `changed.yaml` SHA-256 `e2e358c30bda62b29e567dbcab132966a3918ad5eba19bcd2b029506c9aca16c` (3,634,725 bytes).

## Limits and next steps

Proven: local materialization, static composition certification, deterministic render, exact replica edit, and refusal of an unserved custom-resource API. Unknown/not run: target namespaces, ClusterIssuer `letsencrypt`, ClusterSecretStore `platform-store`, webhook CA readiness, cluster API availability, ingress/DNS/TLS, secrets, GitOps controller delivery, and application health or response. No cluster, login, registry write, publication, or source edit was performed. This does not prove the shop app runs. A real target would require those prerequisites plus GitOps wiring (for example Argo CD), target-specific checks, and a live application acceptance check.

The exercise helped decide that the saved workspace is a useful review and handoff boundary: a single replica change is visible in the render, while an incompatible API is refused before delivery.
