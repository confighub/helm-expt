# helm-expt catalog tests

Standard, **portable** tests for the catalog — run them with `cub` + a cluster.
**No Pilot / confighub-ai-demo required.** Pilot orchestrates these same tests at
scale via its agentic workflow, but the tests live here so any helm-expt user can run them.

## Scripts (resolve the repo from their own location)
- `chart-install-test` — install ONE (chart, base) via `cub installer` → ConfigHub → OCI → Argo on a cub-lk rig; verify runtime + three-way; emit a receipt.
- `chart-install-sweep` — shardable TOP20 driver (`--rig <cub-lk> [--shard i/n] [--slugs a,b]`).
- `existing-secret-proof` — the F3 fix-path: pre-provision the Secret out-of-band, install the existing-secret base, confirm Ready.

## Strategy & findings
- `strategy.md` — long-term catalog test strategy (coverage matrix, lanes).
- `runbook.md` — exact reproducible per-chart procedure.
- `findings.md` — F1–F4 (namespace, `:latest`, secret delivery, proof-SHA).
- `adversarial-strategy.md` — the adversarial multi-persona, tier-aware **usage** probe (methodology; Pilot implements it as a multi-agent workflow).

## Run (standalone)
```
cub auth login                      # verify: cub organization list (NOT cub info)
cub plugin install jesperfj/cub-lk  # verify: cub lk version
cub lk up --name myrig
tests/chart-install-test --package packages/bitnami/nginx/24.0.2 --slug nginx \
  --namespace nginx --rig myrig --json     # add --helm-expt . if run from elsewhere
cub lk down --name myrig
```
