# Browser discovery: Redis 25.5.3 default

## Path used

Started at `http://127.0.0.1:8767/site/index.html` in a newly created tab in the existing in-app browser profile. Used the home page's “Browse the Catalog” link, then the catalog search box with `Redis`, and opened the `bitnami/redis` result's `25.5.3` detail link. The detail page was `http://127.0.0.1:8767/site/charts/bitnami-redis-25-5-3.html`.

## Finding and keeping the exact default record

The catalog row identifies `bitnami/redis`, retained version `25.5.3`, with two packaged configurations: `default` and `reuse-existing-secret`. The page recommends `reuse-existing-secret`, while `default` remains the chart's own defaults.

On the detail page, the `Available Configurations` section has an `F2a · Chart default` card. Its “Download exact inspection record (JSON)” link points to `../records/bitnami-redis-25-5-3-default.json` and says to save it as `record.json`; it contains the full record, `catalog.sha256`, and `selectedRecordSha256`, with the catalog hash identifying the record index. The card explicitly says this inspection snapshot does not install Redis. The card also exposes “Keep this exact record”, linking to the workshop catalog inspection README. I did not download or claim to retain a handoff file because this browser pass was limited to visible discovery and the browser tool did not provide a retained download artifact.

## What the default installs / produces

The page gives the exact package reference:

`oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3@sha256:a216ce212424e05b341ef5000f1798e6014b72b8bc3dce9f315285871037af2a`

The default setup command is `cub installer setup` with `--base default`, work directory `./bitnami-redis-25-5-3-default`, and namespace `redis`. The chart page reports 14 rendered objects for default, one pinned Redis image, and no separate hook/setup route. The image is `registry-1.docker.io/bitnami/redis@sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25`.

The normal default renders password material into a Secret. The page therefore recommends `reuse-existing-secret`, which expects `redis/redis-existing-secret` with key `redis-password` and records 13 objects while keeping the password out of rendered files and OCI. Both variants are marked `unsafe-to-flatten` because the packaged chart has cluster lookups, capability branching, and generated credentials.

## Evidence supporting it

The default card reports passed checks for Helm output, ConfigHub save, local cluster, GitOps/OCI, live Helm comparison, and promotion. Its two-cluster check is `Not run`. The page links the live Helm-vs-ConfigHub parity result, the render intent, full rendered YAML, base-variant record, variant, package base, and promotion receipt.

The `What To Use` summary says the recommended configuration has 5/5 checks passing. The exact publication receipt and publisher signature are recorded and verified. The local `cub check v0.7.3` result for default reports 4 advisory findings (2 critical, 2 warning), including a sensitive environment value and possible PVC orphaning on Helm lifecycle operations.

## What remains untested or bounded

The page's four-question table says rendering passed, but the exact destination check and post-deployment result are `Not run` for the selected configuration. The two-cluster check is also not run. The local check does not cover hook execution, CRD readiness, target Secrets/cloud services, admission behavior, workload health, or rollback. The chart page also records an upstream source download HTTP 403 measured 2026-08-08; retained catalog packages remain pullable, and successors are recommendations to evaluate.

## What helped decide / valid next step / evidence boundary

The catalog search row, the default card's record link, exact digest-pinned package reference, object/image counts, evidence cards, and explicit caveat text were sufficient to identify the default and its record-preservation route. A valid next step is for a human to save the linked JSON record and inspect its YAML/receipt, then perform a target-specific review before applying. This browser discovery establishes only what the visible catalog records; it does not establish a successful deployment on a user's cluster.
