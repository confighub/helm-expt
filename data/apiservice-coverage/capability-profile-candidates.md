# APIService Capability Profile Candidates

Generated. Do not edit by hand.

These rows record live-tested render-profile routes from a refused current base
to a compatible capability profile. Some may already be maintained proof bases.
They are not catalog support claims, and they do not silently patch upstream
Helm output.

## Current Candidates

| Chart | Candidate base | Maintained proof base | Added API versions | Baseline API version | Candidate API version | Render result | Live result | APIService Available | Aggregated query | Receipt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `prometheus-community/prometheus-adapter@5.3.0` | `apiservice-v1-capability` | `apiservice-v1-capability` (maintained-base-created) | apiregistration.k8s.io/v1 | `apiregistration.k8s.io/v1beta1` | `apiregistration.k8s.io/v1` | pass | pass | yes | pass | [receipt](./capability-profile-candidates/prometheus-community-prometheus-adapter-5.3.0-apiservice-v1.yaml) |

## Rule

A capability-profile candidate means a render-time target fact was tested and
observed live. It does not become part of the supported catalog until a
maintained base exists and the normal ConfigHub proof, local live, live
Helm-vs-ConfigHub parity, and APIService runtime contract all pass for that
base.

| Chart | Next action |
| --- | --- |
| `prometheus-community/prometheus-adapter@5.3.0` | Run ConfigHub proof, local live, live Helm-vs-ConfigHub parity, and the APIService runtime contract for the maintained apiservice-v1-capability base before catalog promotion. |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
