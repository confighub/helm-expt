# UX recovery trial result

The supplied composed workspace was retained at `platform-moved/`. I copied it to `failed-api-version/`, changed only the `ExternalSecret` in `failed-api-version/components/06-shop-web.yaml` from `external-secrets.io/v1` to `external-secrets.io/v1beta1`, and ran static certification.

The refusal is preserved at `failed-api-version/refusal.json`. The command exited 1 and reported `certified: false` for 184 objects. Its evidence says: `external-secrets.io/v1beta1|ExternalSecret|shop|shop-web-db: version-not-served; externalsecrets.external-secrets.io serves v1`. The failed component differs from the baseline only at that apiVersion line.

I recovered in the separate `recovered-workspace/` copy without changing the failed attempt. `recovered-workspace/recovery-result.json` records exit 0 and `certified: true` for 184 objects. The recovered component hash matches the baseline (`b8cecd4d1cc59e5cef4f611b96af9a5b2a8dcac3bd790ba77befacedb6582011`); the failed component hash is `86da17695b22f2cf4e543626ccb777ca5010734ef0e67180e6354cba905f2aeb`. The retained rendered hash is `e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6`.

This is static composition evidence only. Certification reports target availability and application health as `not-checked`; namespaces, `ClusterIssuer/letsencrypt`, and `ClusterSecretStore/platform-store` remain target prerequisites with unknown status. No cluster, credentials, ConfigHub, registry, or live-health observation was used, so this trial does not prove that the app runs. The public site was treated as potentially showing the prior `ae083116d` deployment while release `15d0774b388d3e436971005649d98b4010a20304` was queued; no claim about newly merged pages being live is made.
