# Trial log

All commands ran from `$TRIAL`. Every `cub` command set `CUB_CONFIG=$TRIAL/cli/config.yaml`.

1. `cp -R platform-moved baseline-run` — exit `0`.
2. `cp -R platform-moved incompatible-api-recovery` — exit `0`.
3. `CUB_CONFIG=$TRIAL/cli/config.yaml $HOME/.confighub/bin/cub stack certify ./baseline-run/stack.yaml --json > ./baseline-run/certify.stdout.json 2> ./baseline-run/certify.stderr.txt` — exit `0`, recorded in `baseline-run/certify.exit`.
4. Same certify command against `./incompatible-api-recovery/stack.yaml` before mutation — exit `0`, retained as `prechange.stdout.json`, `prechange.stderr.txt`, and `prechange.exit`.
5. Changed only `incompatible-api-recovery/components/06-shop-web.yaml`, setting the `ExternalSecret` API to `external-secrets.io/v1beta1`. This was the deliberate incompatible candidate.
6. `CUB_CONFIG=$TRIAL/cli/config.yaml $HOME/.confighub/bin/cub stack certify ./incompatible-api-recovery/stack.yaml --json > ./incompatible-api-recovery/refused.stdout.json 2> ./incompatible-api-recovery/refused.stderr.txt` — exit `1`, recorded in `refused.exit`; the JSON was also copied to `refused-result.json`.
7. Repaired the same field to `external-secrets.io/v1`, preserving the refusal artifacts.
8. `CUB_CONFIG=$TRIAL/cli/config.yaml $HOME/.confighub/bin/cub stack certify ./incompatible-api-recovery/stack.yaml --json > ./incompatible-api-recovery/recovered-result.json 2> ./incompatible-api-recovery/recovered-certify.stderr.txt` — exit `0`, recorded in `recovered-certify.exit`.
9. `CUB_CONFIG=$TRIAL/cli/config.yaml $HOME/.confighub/bin/cub stack sandbox ./incompatible-api-recovery/stack.yaml --out ./incompatible-api-recovery/recovered-rendered.yaml > ./incompatible-api-recovery/recovered-sandbox.stdout.txt 2> ./incompatible-api-recovery/recovered-sandbox.stderr.txt` — exit `0`, recorded in `recovered-sandbox.exit`.
10. `cmp -s platform-moved/rendered.yaml incompatible-api-recovery/recovered-rendered.yaml` — exit `1`, recorded in `recovered-vs-original.cmp.exit`. The mismatch is retained; hashes are in `hashes.txt` and sizes in `artifact-sizes.txt`.

The public Workshop guide used for the workflow was `https://confighub.github.io/helm-expt/site/` (local static certify, refusal before sandbox output, repair then certify and sandbox, and explicit not-checked scope). No cluster, credentials, ConfigHub service, publication, or live application path was used.
