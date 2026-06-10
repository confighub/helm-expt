# Next80 Action Queues

This generated file is the compact operating view for the 80 proof-grade charts
that are not yet public catalog-supported entries.

Read it as a work queue, not as a support claim:

~~~text
next80 charts: 80
promotion-review: 27
limitation-review: 7
user-shaped-variant: 46
~~~

## Queues

| Queue | What it means | First step |
| --- | --- | --- |
| `promotion-review` | The chart already has more than one base variant and no named hard gap blocking review. | Run catalog promotion review, choose one supported base, then add selected live evidence. |
| `limitation-review` | A named gap affects the next promotion path. | Decide whether the named gap is supported, disclosed, deferred, or blocked before promotion. |
| `user-shaped-variant` | The chart has proof-grade render/package evidence, but the current base is not yet a compelling catalog offer. | Add one realistic base variant a Helm user would actually choose, then rerun proof and review. |

## First Rows By Queue

| Queue | First charts |
| --- | --- |
| `promotion-review` | `external-dns/external-dns@1.21.1`<br>`cloudnative-pg/cloudnative-pg@0.28.2`<br>`kedacore/keda@2.19.0`<br>`elastic/eck-operator@3.4.0`<br>`grafana/alloy@1.8.2`<br>`nats/nats@2.14.0`<br>`prometheus-community/alertmanager@1.37.0`<br>`elastic/logstash@8.5.1` |
| `limitation-review` | `traefik/traefik@40.2.0`<br>`kyverno/kyverno@3.8.1`<br>`bitnami/elasticsearch@22.1.6`<br>`bitnami/spark@10.0.3`<br>`bitnami/zookeeper@13.8.7`<br>`bitnami/contour@21.1.4`<br>`grafana/pyroscope@2.0.2` |
| `user-shaped-variant` | `gitlab/gitlab-runner@0.89.0`<br>`fluent/fluent-bit@0.57.6`<br>`runix/pgadmin4@1.62.0`<br>`nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18`<br>`prometheus-community/kube-state-metrics@7.4.0`<br>`elastic/kibana@8.5.1`<br>`descheduler/descheduler@0.36.0`<br>`prometheus-community/prometheus-blackbox-exporter@11.10.0` |

## How This Relates To Top100

- Every row here already has a maintained recipe/package proof path.
- Most rows still have render parity as their strongest evidence. 8 row(s)
  now have two-cluster kind parity, meaning regular Helm and `cub installer`
  reached equivalent live outcomes in separate vanilla kind clusters.
- Promotion needs useful variants, selected live evidence, and any target facts,
  lifecycle routes, or named limitations made explicit.
- The top-20 catalog remains the public try-now path. This queue is the next
  expansion path.

## Files

| File | Use |
| --- | --- |
| `data/top100-readiness/next80-queues.csv` | Spreadsheet-ready next80 action queue, including source features, package path, and per-chart pain report. |
| `data/top100-readiness/readiness.csv` | Full top100 row data. |
| `data/top100-readiness/summary.md` | Aggregate top100 readiness view. |
| `data/outcome-coverage/base-outcomes.csv` | Per-base proof lane details. |

Regenerate:

~~~sh
npm run top100:readiness
npm run top100:readiness:verify
~~~
