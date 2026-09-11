# UX trial result

Guide followed: local site `kubara.html`, starting at `http://127.0.0.1:8766/site/index.html`.

The retained Kubara selection was materialized locally with:

`CUB_CONFIG=./cli/config.yaml cub stack sandbox kubara-shop-platform --workspace ./platform`

Baseline artifacts are in `platform/`: `stack.yaml`, component files, `rendered.yaml`, and `result.json`. Certification passed for 135 objects. Baseline rendered SHA-256: `a438918e4c9fd5a3c6ffbdc80ff0917aad2ed985dc552c9ee6a7bad5c75fd838`.

Changed only `platform/components/05-shop-web.yaml`, Deployment `shop-web.spec.replicas`, from 3 to 2. Certification output is `platform/changed-result.json` (`certified: true`); render is `platform/changed.yaml`, SHA-256 `e2e358c30bda62b29e567dbcab132966a3918ad5eba19bcd2b029506c9aca16c`. `git diff --no-index` showed exactly that one replica line changing.

Refusal demonstration is retained in `incompatible/`. Only the shop-web ExternalSecret apiVersion was changed to `external-secrets.io/v1beta1`. `incompatible/refusal.json` has `certified: false`, exit code 1, and reports `version-not-served`; the bundled CRD serves `v1`.

This proves static composition, CRD ordering, app needs, and deterministic local rendering. It does not prove target availability, namespaces, ClusterIssuer/letsencrypt, ClusterSecretStore/platform-store, webhook readiness, application health or HTTP response. A real target still needs those prerequisites, GitOps repository/controller wiring, secrets and DNS/certificate setup. No cluster, login, registry write, publication, or delivery was run.
