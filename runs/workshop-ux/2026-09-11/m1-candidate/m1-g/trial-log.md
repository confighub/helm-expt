# Trial log

- Started at `http://127.0.0.1:8766/site/index.html` using HTTP/CLI (`curl`), as instructed.
- Read the home page route to “Browse the Catalog”, then fetched `/site/charts/index.html`.
- Searched the catalog HTML for `bitnami/redis`; found version `25.5.3` and opened `/site/charts/bitnami-redis-25-5-3.html`.
- Followed the page instruction “Download exact inspection record (JSON)” and fetched `/site/records/bitnami-redis-25-5-3-default.json` to `record.json`.
- Parsed `record.json` with `python3 -m json.tool`; confirmed identity, status, Catalog hash, selected-record hash, package reference, object count, assessment stages, inputs, evidence, and delivery fields.
- Followed the page’s object inventory link over HTTP and inspected the listed 14 object identities. The source file links under `/site/recipes/...` returned HTTP 404 because they are repository-root links; retrying at `/recipes/...` succeeded.
- No `cub`, Helm, cluster, credentials, installer, setup, apply, upload, or publishing commands were run. This was an inspection-only trial, so there were no setup changes or command failures beyond the two expected `/site/recipes/...` 404 fetches.
- Wrote `result.md`, `trial-log.md`, and retained the downloaded `record.json` only under this trial directory.
