# M1-C trial log

- UTC start: 2026-09-11T15:01:16Z
- UTC end: 2026-09-11T15:01:39Z
- Setup time: 0 minutes (curl and normal shell tools were available)
- First useful saved-result time: 2026-09-11T15:01:28Z (`redis.html` and the exact package/page details)
- Help needed: none

Commands/navigation:

1. `curl -fsS -D index.headers http://127.0.0.1:8765/site/index.html -o index.html`
2. `curl -fsS http://127.0.0.1:8765/site/charts/index.html -o charts-index.html`; searched the catalog HTML for `bitnami/redis` and `25.5.3`.
3. `curl -fsS http://127.0.0.1:8765/site/charts/bitnami-redis-25-5-3.html -o redis.html`; searched page sections for default, objects, settings, evidence, and next-edit guidance.
4. HTTP-read linked resources into this directory: `effective-values.yaml`, `default.yaml` (full rendered YAML), and `default-record.yaml` (complete base-variant record).
5. Counted/listed rendered Kubernetes kinds and names with `rg`.

Failed attempts: none.
