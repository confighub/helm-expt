# APIService Capability Profile Candidates

Generated. Do not edit by hand.

These rows record live-tested render-profile routes from a refused current base
to a possible future maintained base. They are not current catalog support
claims, and they do not silently patch upstream Helm output.

## Current Candidates

| Chart | Candidate base | Added API versions | Baseline API version | Candidate API version | Render result | Live result | APIService Available | Aggregated query | Receipt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `prometheus-community/prometheus-adapter@5.3.0` | `apiservice-v1-capability` | apiregistration.k8s.io/v1 | `apiregistration.k8s.io/v1beta1` | `apiregistration.k8s.io/v1` | pass | pass | yes | pass | [receipt](./capability-profile-candidates/prometheus-community-prometheus-adapter-5.3.0-apiservice-v1.yaml) |

## Rule

A capability-profile candidate means a render-time target fact was tested and
observed live. It does not become part of the catalog until a maintained base is
created and the normal ConfigHub proof, local live, live Helm-vs-ConfigHub
parity, and APIService runtime contract all pass for that base.

## Next Actions

| Chart | Next action |
| --- | --- |
| `prometheus-community/prometheus-adapter@5.3.0` | Promote this candidate into a maintained base, then run ConfigHub proof, local live, live Helm-vs-ConfigHub parity, and the APIService runtime contract before catalog promotion. |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
