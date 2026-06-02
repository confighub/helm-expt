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

---

## Final status (end of overnight session)

**variant-rich 30 → 54/100. supported (Level 2) 100/100 throughout. 5 PRs merged, 1 issue filed, 1 updated.**

| PR | Wave / change | Result |
|----|---------------|--------|
| #115, #116 | Hook policy -> `handled-by-lifecycle-policy` | residue 239->201 |
| #117 | HA wave | +9 (alertmanager, zookeeper, spark, elasticsearch, opensearch, logstash, eck-operator, pyroscope, nats) |
| #119 | no-crds wave 2 (`--no-include-crds`) | +9 (trivy-operator, vpa, external-dns, gatekeeper, pyroscope, nack, sealed-secrets, traefik, velero) |
| #121 | no-crds wave 3 (chart CRD toggles) | +8 (argo-events, argo-rollouts, contour, cloudnative-pg, eck-operator, trust-manager, kyverno, otel-operator) |
| #120 | top-500 refresh + learnings | multi-variant 20->43 |
| #118 (issue) | Systemic curated-lane installer.yaml SHA drift | filed, NOT fixed (needs human call) |
| #114 (updated) | template-CRD class expanded 5->17 | commented |

**Tooling:** `scripts/run-variant-wave.mjs` (resumable wave driver); `generate-variant-proof.mjs` hardened (`--base`, `ref` fallback, no-crds 0-CRD invariant for any build method).

### Generic enhancement waves are substantially exhausted
The cleanly-buildable generic variants are done. The remaining **70 backlog variants across 60
charts** are gated by documented constraints, NOT more generic waves:
- existing-secret (~47): secret-delivery product gap (#113); charts ship no toggle.
- curated proof lanes (6 ha + 3 ingress-tls): need bespoke `<chart>-proof.mjs` teaching AND are blocked by #118.
- template-baked CRDs with no toggle: rook-ceph (partial), argocd-image-updater, minio-operator, linkerd-crds.

### Gated next steps (need a human decision — did NOT do autonomously)
1. Fix #118 — re-sync 20 curated package receipts to current (target-facts) installer.yaml. Un-reds `npm run verify`. Confirm installer.yaml is canonical first.
2. Teach the 6 curated lanes their HA variant (after #118).
3. Secret-delivery (#113) — product decision.

Stopped here rather than manufacture waves (Reality Rule). Resume from this file.
