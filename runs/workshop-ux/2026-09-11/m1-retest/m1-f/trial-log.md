# Trial log

- Started at `https://confighub.github.io/helm-expt/site/index.html` with HTTP `curl`; saved the landing page as `index.html`.
- Used the landing page Catalog link and search form with `q=redis`; saved the result as `redis-index.html`.
- Followed the `bitnami/redis` `25.5.3` link to `charts/bitnami-redis-25-5-3.html`; saved it as `redis.html`.
- Read the page's catalog record links, exact package reference, preset table, evidence sections, and “where settings come from” guidance.
- Used the supplied pinned checkout at `./source` only for the linked record contents and hashes; checkout HEAD was detached at the supplied commit.
- Read `recipes/bitnami/redis/25.5.3/CATALOG.md`, the default base record, the default render intent, and the default variant revision.
- Computed SHA-256 hashes with `shasum -a 256` and preserved them in `record.json`.
- No cub CLI, cluster, credentials, plugin installation, external writes, or publication was attempted.
- No failures or help/setup requests occurred.
- Verified required outputs exist under `.`: `record.json`, `result.md`, and `trial-log.md`.
