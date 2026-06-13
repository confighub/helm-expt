# APIService Target Compatibility Decisions

This generated note lists APIService rows where the maintained recipe renders
APIService objects, but the tested target profile does not support the rendered
API version or equivalent prerequisite.

These are target-scoped support decisions. They do not claim that the upstream
chart is unusable everywhere, and they do not silently patch Helm output.

## Current Decisions

| Chart | Version | Status | Decision | Target block | Receipt | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `prometheus-community/prometheus-adapter` | 5.3.0 | `target-api-version-refused` | `do-not-promote-for-this-target-profile` | `api-version-unsupported` | `data/apiservice-coverage/target-compatibility-decisions/prometheus-community-prometheus-adapter-5.3.0.yaml` | Promote this candidate into a maintained base, then run ConfigHub proof, local live, live Helm-vs-ConfigHub parity, and the APIService runtime contract before catalog promotion. |

## Claim Boundary

| Chart | Not claimed |
| --- | --- |
| `prometheus-community/prometheus-adapter@5.3.0` | not a global chart refusal; not an APIService runtime success claim; not a silent upstream patch |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
