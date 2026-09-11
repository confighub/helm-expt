# M5-A result

The unsupported ExternalSecret API version was refused before sandbox output: `external-secrets.io/v1beta1` for `ExternalSecret/shop/shop-web-db` is declared but not served by the bundled `externalsecrets.external-secrets.io` CRD, which serves `v1`. Exit code was 1 and the refusal JSON is retained at attempt/refusal-result.json (`./attempt/refusal-result.json` in workspace archive); the changed input and exact diff are at `attempt/components/06-shop-web.yaml` and `attempt/api-version.diff`.

Recovery used a separate copy retaining the supplied `external-secrets.io/v1`. Certification exited 0 and sandbox exited 0, producing 184 objects at recovery/recovery-rendered.yaml (`./recovery/recovery-rendered.yaml` in workspace archive). The recovery result is recovery/recovery-result.json (`./recovery/recovery-result.json` in workspace archive).

This helped decide that the composition gate catches an API-version mismatch early and preserves a reviewable refusal; restoring the served version is a valid local next step. Proven: bundled CRD/API resolution, refusal, recovery certification, and static render. Unknown: target API availability, namespaces, issuer/secret-store existence, webhook readiness, delivery, and application health. Not run: login, cluster, ConfigHub, registry, publishing, credentials, or live delivery.

Friction/help: the Guide page and plugin README clearly explain that certification must precede sandbox and that a declared but unserved version is refused. No additional help was required.
