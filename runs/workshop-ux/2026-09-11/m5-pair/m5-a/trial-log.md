# M5-A trial log

Guide discovery: `curl -fsS http://127.0.0.1:8767/site/index.html`; page title was `ConfigHub Workshop · Understand and test your configuration`. The supplied plugin documentation was retained as input and describes exact served API checking.

All `cub` commands below used the required configuration prefix and ran with shell workdir `./plugin`.

1. `mkdir -p ./attempt ./recovery` — exit 0. Copied the complete supplied handoff into both copies.
2. Changed only `./attempt/components/06-shop-web.yaml`, `external-secrets.io/v1` to `external-secrets.io/v1beta1`. The original handoff and recovery copy remained unchanged.
3. `CUB_CONFIG=./cli/config.yaml $HOME/.confighub/bin/cub stack certify ./attempt/stack.yaml --json > ./attempt/refusal-result.json 2> ./attempt/refusal.stderr` — exit 1. Stderr was empty; JSON was retained. It reports `certified: false` and `version-not-served`: `external-secrets.io/v1beta1|ExternalSecret|shop|shop-web-db`; `externalsecrets.external-secrets.io serves v1`.
4. `git diff --no-index ./recovery/components/06-shop-web.yaml ./attempt/components/06-shop-web.yaml` — exit 1 because the intentional API-version change was found; diff retained at `attempt/api-version.diff`.
5. `CUB_CONFIG=./cli/config.yaml $HOME/.confighub/bin/cub stack certify ./recovery/stack.yaml --json > ./recovery/recovery-result.json 2> ./recovery/certify.stderr` — exit 0. `certified: true`, 184 objects, 2 custom resources match bundled CRDs.
6. `CUB_CONFIG=./cli/config.yaml $HOME/.confighub/bin/cub stack sandbox ./recovery/stack.yaml --out ./recovery/recovery-rendered.yaml > ./recovery/sandbox.stdout 2> ./recovery/sandbox.stderr` — exit 0; 184 objects rendered in plane order. Outputs and exit files are retained.

The handoff ExternalSecret component hash and recovery hash are identical (`b8cecd4d1cc59e5cef4f611b96af9a5b2a8dcac3bd790ba77befacedb6582011`); attempt hash is `86da17695b22f2cf4e543626ccb777ca5010734ef0e67180e6354cba905f2aeb`.
