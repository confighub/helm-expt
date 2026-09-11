# M5-E result

The unsupported ExternalSecret API was refused and the failed attempt is preserved. A separate recovery copy restored `external-secrets.io/v1`, certified successfully, and rendered successfully.

| Attempt | Exit | Evidence | What it proves |
|---|---:|---|---|
| Trial: `ExternalSecret/shop-web-db` set to `external-secrets.io/v1beta1` | 1 | `trial/refusal.stdout.json` (`./trial/refusal.stdout.json` in workspace archive), `trial/refusal.exit` (`./trial/refusal.exit` in workspace archive) | `certified:false`; bundled `externalsecrets.external-secrets.io` serves only `v1`, so `v1beta1` is refused. |
| Recovery: original `v1` in separate copy | 0 | `recovery/certify.stdout.json` (`./recovery/certify.stdout.json` in workspace archive), `recovery/certify.exit` (`./recovery/certify.exit` in workspace archive) | Static composition certified; 2 custom resources match bundled CRDs. |
| Recovery sandbox render | 0 | `recovery/rendered-recovery.yaml` (`./recovery/rendered-recovery.yaml` in workspace archive), `recovery/sandbox.exit` (`./recovery/sandbox.exit` in workspace archive) | 184 objects rendered in plane order. |

Guide: `http://127.0.0.1:8768/site/index.html`; the plugin README/DEMO directed the CLI flow and stated the served API version. The complete command history, retained stderr/stdout, hashes, friction, and unknowns are in `trial-log.md` (`./trial-log.md` in workspace archive).

Proven: refusal is explicit and reviewable; recovery certifies and renders. Unknown/not run: target APIs, namespaces, ClusterIssuer, ClusterSecretStore readiness, live delivery, controller health, and app response. No login, cluster, ConfigHub, registry, credentials, or additional trial was used. Supplied setup was excluded; no timing is claimed.
