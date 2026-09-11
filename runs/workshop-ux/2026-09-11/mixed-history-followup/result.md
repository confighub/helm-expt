# Mixed-history incompatible API recovery

## Outcome

The retained `platform-moved/` stack was copied into two fresh working copies. A static certification of the unchanged copy passed. In `incompatible-api-recovery/`, the `ExternalSecret` API was changed from `external-secrets.io/v1` to `external-secrets.io/v1beta1`. Static certification refused it with exit code 1 because the bundled CRD serves only `v1`. The API was repaired back to `v1`; certification then passed and sandbox rendering completed.

## Evidence

- Baseline JSON: `baseline-run/certify.stdout.json` (exit `baseline-run/certify.exit`, `0`). It reports `certified: true`, 184 objects, and static scope with target availability and application health `not-checked`.
- Refusal JSON: `incompatible-api-recovery/refused.stdout.json` (exit `refused.exit`, `1`). Its failing check says `external-secrets.io/v1beta1|ExternalSecret|shop|shop-web-db: version-not-served; externalsecrets.external-secrets.io serves v1`.
- Recovered JSON: `incompatible-api-recovery/recovered-result.json` (exit `recovered-certify.exit`, `0`). It reports `certified: true`, 184 objects, with the same static-only scope.
- Recovered sandbox output: `incompatible-api-recovery/recovered-rendered.yaml` (exit `recovered-sandbox.exit`, `0`). The human output is retained in `recovered-sandbox.stdout.txt`; it reports 184 objects in plane order.
- `incompatible-api-recovery/hashes.txt` records SHA-256 values. The recovered render hash is `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`, matching the certified baseline result's `renderedFile.sha256`.

## Limits

These results prove local static composition, bundled CRD/API compatibility, and local sandbox rendering only. They do not prove target namespaces, issuer or secret-store existence, admission webhook readiness, cluster availability, application health, delivery, publication, or any live behavior. The original `platform-moved/` directory was left intact. Its pre-existing `rendered.yaml` has a different hash from the newly certified render; that difference is retained and not treated as a deployment or correctness claim.
