# Trial log

- Started from `https://confighub.github.io/helm-expt/site/index.html` over HTTP with `curl`; followed Catalog to the Redis 25.5.3 page.
- Read the page's catalog navigation, exact package reference, default variant table, settings-source section, evidence coverage, setup guidance, and “where next” links.
- Inspected the pinned checkout at `./source` (commit `2d6eace52cd846582a445276f5fba42de60cf730`) for the complete `CATALOG.md`, selected default record, render intent, revision, and rendered object set; computed SHA-256 hashes.
- CLI check: `cub installer inspect <immutable-package-ref> --json` exited 0 and produced `inspect.json` (2261 bytes); stderr was empty. No cluster contact, install, credentials, or publication was used.
- No failures or help requests. No setup was run because this was an inspection mission and the page says the default base has no separate install work.
