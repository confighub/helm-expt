# Environment-Determinism Matrix

This generated report answers the environment-skew question with a recorded
matrix: the same chart, rendered under varied timezone and locale settings,
either produces byte-identical output or it does not — and either way the
matrix says so. Alternate flag profiles are rendered on the baseline
environment so their digests are recorded next to the standard profile's
(differences across flag profiles are expected; the recorded digest is what
ties a receipt to its exact profile).

## Current Status

| Metric | Value |
| --- | --- |
| Charts in corpus | 4 |
| Recorded cells | 28 |
| Env cells matching baseline (standard profile) | 16 of 16 |
| Non-deterministic cells | 0 |
| Platform recorded | darwin/arm64, helm v4.1.4 |

Every recorded environment cell rendered byte-identically across the timezone and locale variations, and every cell rendered deterministically (twice, same bytes) within its environment.

The corpus is the proof-grade chart set with pinned effective values. This
matrix does not claim environment invariance for charts outside it, for other
helm versions, or for other operating systems and architectures — those are
open columns, intended to ride on CI runners rather than bespoke local
infrastructure.

Colored rendering: [matrix.html](matrix.html) (open in a browser).

## Matrix

| Chart | Flag profile | Environment | TZ | Locale | Deterministic | Digest | Matches baseline env |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bitnami/redis/25.5.3` | `standard` | `baseline-utc-c` | UTC | C | yes | `17d5c0c39366` | — |
| `bitnami/redis/25.5.3` | `standard` | `tz-new-york` | America/New_York | C | yes | `17d5c0c39366` | yes |
| `bitnami/redis/25.5.3` | `standard` | `tz-tokyo` | Asia/Tokyo | C | yes | `17d5c0c39366` | yes |
| `bitnami/redis/25.5.3` | `standard` | `locale-en-us-utf8` | UTC | en_US.UTF-8 | yes | `17d5c0c39366` | yes |
| `bitnami/redis/25.5.3` | `standard` | `locale-turkish-utf8` | UTC | tr_TR.UTF-8 | yes | `17d5c0c39366` | yes |
| `bitnami/redis/25.5.3` | `no-include-crds` | `baseline-utc-c` | UTC | C | yes | `17d5c0c39366` | — |
| `bitnami/redis/25.5.3` | `with-hooks` | `baseline-utc-c` | UTC | C | yes | `17d5c0c39366` | — |
| `bitnami/redis/27.0.0` | `standard` | `baseline-utc-c` | UTC | C | yes | `758467319ec1` | — |
| `bitnami/redis/27.0.0` | `standard` | `tz-new-york` | America/New_York | C | yes | `758467319ec1` | yes |
| `bitnami/redis/27.0.0` | `standard` | `tz-tokyo` | Asia/Tokyo | C | yes | `758467319ec1` | yes |
| `bitnami/redis/27.0.0` | `standard` | `locale-en-us-utf8` | UTC | en_US.UTF-8 | yes | `758467319ec1` | yes |
| `bitnami/redis/27.0.0` | `standard` | `locale-turkish-utf8` | UTC | tr_TR.UTF-8 | yes | `758467319ec1` | yes |
| `bitnami/redis/27.0.0` | `no-include-crds` | `baseline-utc-c` | UTC | C | yes | `758467319ec1` | — |
| `bitnami/redis/27.0.0` | `with-hooks` | `baseline-utc-c` | UTC | C | yes | `758467319ec1` | — |
| `bitnami/nginx/24.0.2` | `standard` | `baseline-utc-c` | UTC | C | yes | `7fb28597f2ee` | — |
| `bitnami/nginx/24.0.2` | `standard` | `tz-new-york` | America/New_York | C | yes | `7fb28597f2ee` | yes |
| `bitnami/nginx/24.0.2` | `standard` | `tz-tokyo` | Asia/Tokyo | C | yes | `7fb28597f2ee` | yes |
| `bitnami/nginx/24.0.2` | `standard` | `locale-en-us-utf8` | UTC | en_US.UTF-8 | yes | `7fb28597f2ee` | yes |
| `bitnami/nginx/24.0.2` | `standard` | `locale-turkish-utf8` | UTC | tr_TR.UTF-8 | yes | `7fb28597f2ee` | yes |
| `bitnami/nginx/24.0.2` | `no-include-crds` | `baseline-utc-c` | UTC | C | yes | `7fb28597f2ee` | — |
| `bitnami/nginx/24.0.2` | `with-hooks` | `baseline-utc-c` | UTC | C | yes | `7fb28597f2ee` | — |
| `prometheus-community/kube-prometheus-stack/85.3.3` | `standard` | `baseline-utc-c` | UTC | C | yes | `9fac2a0e4140` | — |
| `prometheus-community/kube-prometheus-stack/85.3.3` | `standard` | `tz-new-york` | America/New_York | C | yes | `9fac2a0e4140` | yes |
| `prometheus-community/kube-prometheus-stack/85.3.3` | `standard` | `tz-tokyo` | Asia/Tokyo | C | yes | `9fac2a0e4140` | yes |
| `prometheus-community/kube-prometheus-stack/85.3.3` | `standard` | `locale-en-us-utf8` | UTC | en_US.UTF-8 | yes | `9fac2a0e4140` | yes |
| `prometheus-community/kube-prometheus-stack/85.3.3` | `standard` | `locale-turkish-utf8` | UTC | tr_TR.UTF-8 | yes | `9fac2a0e4140` | yes |
| `prometheus-community/kube-prometheus-stack/85.3.3` | `no-include-crds` | `baseline-utc-c` | UTC | C | yes | `3f6049fc2b7a` | — |
| `prometheus-community/kube-prometheus-stack/85.3.3` | `with-hooks` | `baseline-utc-c` | UTC | C | yes | `c3d25cc59ac1` | — |

## Regenerate

~~~sh
npm run environment-matrix:record   # online: re-renders the corpus
npm run environment-matrix          # offline: summary from committed matrix
npm run environment-matrix:verify
~~~
