# Trial log (UTC)

- Start: 2026-09-11T15:01:24Z
- End: 2026-09-11T15:02:20Z
- Setup time: 0 min (curl, rg available; no credentials or cluster used)
- First useful saved result: 2026-09-11T15:01:47Z (chart page and exact record assets saved)
- Help needed: none
- Navigation/commands: `curl http://127.0.0.1:8765/site/index.html`; followed chart catalog link by HTTP to `/site/charts/index.html`; followed Redis 25.5.3 link to `/site/charts/bitnami-redis-25-5-3.html`; downloaded `/data/base-variant-records/records/bitnami-redis-25-5-3-default.yaml`, `/recipes/bitnami/redis/25.5.3/effective-values.yaml`, `/recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml`, and the render intent.
- Failed attempt: tried `/site/data/...` and `/site/recipes/...` paths from the page's relative links; those returned 404. Retried at server root (`/data/...`, `/recipes/...`), which returned 200.

