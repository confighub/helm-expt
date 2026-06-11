# APIService Render-Path Notes

This generated note covers maintained charts where the source scan finds
APIService-capable templates, but the maintained recipe bases render zero
APIService objects. These rows should not be treated as runtime API aggregation
failures. They are render-path decisions.

## Current Rows

| Chart | Version | Source APIService count | Rendered APIService count | Maintained bases | Conditional dependencies | Conclusion |
| --- | --- | ---: | ---: | --- | --- | --- |
| `fairwinds-stable/goldilocks` | 10.3.0 | 2 | 0 | default | metrics-server.enabled;vpa.enabled | source APIService signal is conditional or vendored and is not active in maintained bases |
| `fairwinds-stable/vpa` | 4.11.0 | 1 | 0 | default;no-crds | metrics-server.enabled | source APIService signal is conditional or vendored and is not active in maintained bases |

## How To Use This

When a row appears here, the chart still contains APIService-related source
paths, usually inside optional vendored dependencies. The maintained bases do
not render those objects, so live API aggregation evidence is not required for
the current support claim.

If a future base enables one of the listed dependency conditions, that base
must move out of this note and into the runtime APIService contract:

~~~text
rendered APIService object observed
backing workload observed
APIService Available=True observed
aggregated API query observed
freshness timestamp recorded
~~~

## Evidence

| Chart | Dependency sources | Evidence |
| --- | --- | --- |
| `fairwinds-stable/goldilocks@10.3.0` | metrics-server@3.*.* when metrics-server.enabled;vpa@4.8.* when vpa.enabled | data/top500-catalog-analysis/source/source-feature-scan.raw.json;recipes/fairwinds-stable/goldilocks/10.3.0/dependency-lock.yaml;recipes/fairwinds-stable/goldilocks/10.3.0/revisions |
| `fairwinds-stable/vpa@4.11.0` | metrics-server as metrics-server@3.11.0 when metrics-server.enabled | data/top500-catalog-analysis/source/source-feature-scan.raw.json;recipes/fairwinds-stable/vpa/4.11.0/dependency-lock.yaml;recipes/fairwinds-stable/vpa/4.11.0/revisions |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
