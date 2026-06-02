# Overnight enhancement-wave run — 2026-06-02 (resume anchor)

Autonomous overnight run: keep firing variant **enhancement waves** through the deterministic
generator to nudge `variant-rich` up, and update the top-500 analysis with recent learnings.
State lives in git + `data/variant-backlog/wave-{plans,results}/`. Honest declines are expected
(~40% of any wave). `supported (Level 2): 100/100` is the thesis bar and must hold.

## Done this session

- **Hook policy** (#115, #116): hooks → `handled-by-lifecycle-policy` (ConfigHub applies hook
  resources; controller runs them — Flux helm-controller, or Argo's equivalent). Residue 239→201.
- **HA wave** (#117): 9 charts promoted, `variant-rich` 30→39. Tooling: `--base`/`ref` fallback in
  `generate-variant-proof.mjs`; new resumable `scripts/run-variant-wave.mjs`.
  - Promoted: alertmanager, zookeeper, spark, elasticsearch, opensearch, logstash, eck-operator,
    pyroscope, nats.
  - Deferred (6 curated lanes): argo-cd, prometheus, mysql, postgresql, rabbitmq, consul.
  - N/A (5 single-node/data-plane): tempo, longhorn, pgadmin4, victoria-{logs,metrics}-single.
- **Finding #118**: ALL 20 curated proof lanes (`<chart>:verify-package`) are red on `main` —
  pre-existing `installer.yaml` source-SHA drift (target-facts / namespace-transformer changes
  never re-synced the goldens). `npm run verify` is broken on main independent of these waves.

## Doctrine learned

- **Generic generator owns:** next80 + non-curated charts. It writes recipe/package/catalog-status/
  receipts and is idempotent. Aggregates it does NOT own: `artifact-index.yaml` (run
  `catalog:maps`), `variant-backlog`, `completeness`, `CATALOG.md`, `quirk-queue`, `root-catalog`.
- **Do NOT run `generate-catalog-status.mjs --generate` after a wave** — it writes a leaner schema
  and clobbers the variant generator's rich per-chart catalog-status (incl. other charts'). The
  variant generator already owns catalog-status. (Recovered from this once this session.)
- **Curated proof lanes (20 charts)** have bespoke per-variant scripts asserting exact
  variants/bases/topology — they must be TAUGHT a new variant via their own `--generate-package`,
  never via the generic generator. Curated: redis, metrics-server, ingress-nginx, cert-manager,
  external-secrets, argo-cd, postgresql, rabbitmq, kube-prometheus-stack, loki, longhorn, mysql,
  grafana, vault, secrets-store-csi-driver, prometheus, mongodb, nginx, tempo, consul.
- **Secret-delivery gap (#113):** existing-secret variants not buildable (no toggle).
- **Template-CRD gap (#114):** some charts bake CRDs in templates; `--no-include-crds` can't strip
  them (0-CRD guard refuses to fabricate).

## How to resume / run a wave

```bash
# 1. edit/create data/variant-backlog/wave-plans/<wave>.json  (entries: chart, set[]/values/base/noIncludeCrds, or decline)
git checkout -b feat/<wave>-wave
node scripts/run-variant-wave.mjs <wave>           # resumable: skips built, reverts failures, no-op guard
# 2. regenerate (NOT catalog-status — generator owns it):
node scripts/generate-chart-catalogs.mjs --generate    # artifact-index (reads catalog-status, run LAST-ish)
node scripts/generate-variant-backlog.mjs --generate
node scripts/generate-model-completeness.mjs --generate
node scripts/generate-quirk-review-queue.mjs --generate
node scripts/generate-root-catalog.mjs --generate
# 3. verify: next80:verify catalog:status:verify catalog:maps:verify catalog:index:verify
#            completeness:verify variant-backlog:verify quirk-queue:verify
# 4. confirm scope = only intended charts (git status | grep recipes), commit, PR, merge.
```

## Remaining plan

- [ ] **no-crds wave 2** — ~21 non-curated charts with unbuilt no-crds (uniform `--no-include-crds`).
      Expect template-CRD declines (#114-class) + no-op declines (charts shipping no CRDs).
- [ ] **top-500 analysis update (#30)** — `scripts/generate-top500-catalog-analysis.mjs`; refresh
      multi-variant count (20→ now higher), fold in hook policy / Level-2 / placeholder-vs-extension
      / variant generator / #113 / #114 / waves narrative; `top500:catalog` + verify.
- [x] ~~ingress-tls / tls waves~~ — all 3 candidates (vault, tempo, consul) are curated → defer.
