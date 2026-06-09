# Edge Recovery

This generated report records graph fragments recovered from Helm-derived recipe
artifacts. The goal is to show that helm-expt can preserve more than flat YAML:
base variants, overrides, generated facts, target facts, and field reachability
can become desired-state graph input.

## Current Scope

~~~text
charts with inheritance graphs: 2
edge rows:                      8
target-fact edges:              3
generated-fact edges:           1
~~~

## Main Proof Charts

| Chart | Graph | Why it matters |
| --- | --- | --- |
| bitnami/redis@25.5.3 | [../../recipes/bitnami/redis/25.5.3/inheritance-graph.yaml](../../recipes/bitnami/redis/25.5.3/inheritance-graph.yaml) | Fast teaching chart for generated facts, target facts, and secret variants. |
| prometheus-community/kube-prometheus-stack@85.3.3 | [../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml) | Main hard/demo chart for CRDs, webhooks, dependencies, and high object count. |

## Regenerate

~~~sh
npm run edges:generate
npm run edges:verify
~~~
