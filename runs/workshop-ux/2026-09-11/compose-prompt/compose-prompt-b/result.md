# Result

Completed the local static Workshop task in `./plugin/compose-ai`.

The editable workspace was created as `platform`, retained its baseline receipt and render, then moved as a complete directory to `platform-moved`. The candidate changed only the `shop-web` Deployment `spec.replicas` field from `3` to `2`. Candidate certification exited `0`; rendering `changed.yaml` exited `0`; the inspected no-index diff exited `1` and showed that single replica change.

The incompatible copy changed only `ExternalSecret shop-web-db` from `external-secrets.io/v1` to `external-secrets.io/v1beta1`. Certification exited `1` as expected because that version is not served by the bundled `externalsecrets.external-secrets.io` CRD, which serves `v1`. The unchanged incompatible directory was copied to `recovered`; restoring only the API version to `external-secrets.io/v1` and certifying `recovered/stack.yaml` to `recovered/recovery.json` exited `0`.

Receipt hashes and rendered hashes are recorded in trial-log.md (`./trial-log.md` in workspace archive). The recovery receipt hash equals the changed receipt hash because the recovered content matches the certified candidate; it came from the new recovery command recorded above.

Unverified target prerequisites are six namespaces (`argocd`, `cert-manager`, `external-secrets`, `kube-system`, `shop`, `traefik`), `ClusterIssuer/letsencrypt`, and `ClusterSecretStore/platform-store`. `IngressClass/traefik` is bundled. Target availability and application health were not checked. No cluster, ConfigHub, registry, or credentials were contacted, and no delivery, readiness, or application health is claimed.
