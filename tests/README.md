# helm-expt Catalog Tests

This directory contains the portable test material for the catalog.

There are two related surfaces:

```text
npm scripts
  Repository verification, artifact generation, stale-file checks, and
  user-side Redis install checks.

tests/* executables
  Cluster/runtime tests that run with cub, cub-lk, ConfigHub, OCI, Argo, and
  Kubernetes.
```

Start with [npm-scripts.md](npm-scripts.md) when you want to know what each
`npm run ...` command checks, why it exists, and whether it writes files.

## Scripts (resolve the repo from their own location)

- `chart-install-test` — install one chart/base via `cub installer` →
  ConfigHub → OCI → Argo on a cub-lk rig; verify runtime and three-way
  agreement; emit a receipt.
- `chart-install-sweep` — shardable top-20 driver:
  `--rig <cub-lk> [--shard i/n] [--slugs a,b]`.
- `existing-secret-proof` — the F3 fix path: pre-provision the Secret
  out-of-band, install the existing-secret base, and confirm Ready.

## Strategy & findings

- `strategy.md` — long-term catalog test strategy (coverage matrix, lanes).
- `top100-runtime-gitops.md` — top-100 runtime/GitOps sweep plan, pass bars,
  and required receipt outputs.
- `../data/attack-plan-workdown/summary.md` — generated workdown that ties the
  test lanes to import, gap, variant, production, latest-candidate, and image
  digest next actions.
- `../data/runtime-gitops/summary.md` — first Argo/Flux OCI live-proof wave and
  the required receipt index.
- `../data/image-digest-workdown/summary.md` — rendered image digest review
  queue for production OCI support.
- `../data/next-ten-waves/summary.md` — compact next rows for the current
  execution queue.
- `runbook.md` — exact reproducible per-chart procedure.
- `findings.md` — F1–F4 (namespace, `:latest`, secret delivery, proof-SHA).
- `adversarial-strategy.md` — the adversarial multi-persona, tier-aware usage
  probe. Pilot can implement this as a multi-agent workflow; the method lives
  here.

## Run (standalone)

```sh
cub auth login                      # verify: cub organization list (NOT cub info)
cub plugin install jesperfj/cub-lk  # verify: cub lk version
cub lk up --name myrig
tests/chart-install-test --package packages/bitnami/nginx/24.0.2 --slug nginx \
  --namespace nginx --rig myrig --json     # add --helm-expt . if run from elsewhere
cub lk down --name myrig
```
