# Top-100 Promotion Wave

This generated wave is the first strict promotion-review slice from the
top-100 coverage queue.

It selects proof-grade charts that already have:

- multiple named variants;
- two-cluster kind parity evidence;
- no named limitation blocking review.

Catalog support still requires a human promotion decision, production
disposition, and a current support boundary for each row.

## Summary

~~~text
wave rows: 21
two-cluster parity rows: 21
missing item: scan and production disposition
~~~

## Selected Rows

| Chart | Variants | Scan/gate | Feature focus | First step |
| --- | --- | --- | --- | --- |
| `aqua/trivy-operator@0.32.1` | default;no-crds | high=0, medium=19, gates=allow;warn | - | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `argo-cd/argo-events@2.4.21` | default;no-crds | high=0, medium=5, gates=allow;warn | - | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `argo-cd/argo-rollouts@2.40.9` | default;no-crds | high=0, medium=10, gates=allow;warn | - | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | default;no-crds | high=0, medium=25, gates=allow;warn | - | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `cloudnative-pg/cloudnative-pg@0.28.2` | default;no-crds | high=0, medium=16, gates=allow;warn | generated-facts;tpl;crds;cluster-rbac;webhooks | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `elastic/eck-operator@3.4.0` | default;ha;no-crds | high=0, medium=18, gates=allow;warn | tpl;capabilities;cluster-rbac;webhooks;stateful-storage | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `elastic/logstash@8.5.1` | default;ha | high=0, medium=0, gates=allow | tpl;capabilities;stateful-storage | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `external-dns/external-dns@1.21.1` | default;no-crds;dry-run-txt-registry | high=0, medium=3, gates=allow;warn | tpl;crds;cluster-rbac | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `gatekeeper/gatekeeper@3.22.2` | default;no-crds | high=0, medium=22, gates=allow;warn | capabilities;hooks;crds;cluster-rbac;webhooks | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `grafana/alloy@1.8.2` | default;no-crds | high=0, medium=3, gates=allow;warn | tpl;capabilities;crds;cluster-rbac;stateful-storage | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `nats/nats@2.14.0` | default;ha | high=0, medium=1, gates=allow;warn | tpl | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `open-telemetry/opentelemetry-operator@0.114.0` | default;no-crds | high=0, medium=9, gates=allow;warn | - | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `percona/pg-operator@3.0.0` | default;no-crds | high=0, medium=8, gates=allow;warn | - | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `percona/psmdb-operator@1.22.0` | default;no-crds | high=0, medium=3, gates=allow;warn | - | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `percona/pxc-operator@1.19.1` | default;no-crds | high=0, medium=3, gates=allow;warn | lookup;crds;cluster-rbac | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `prometheus-community/alertmanager@1.37.0` | default;ha | high=0, medium=0, gates=allow | tpl;stateful-storage | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `prometheus-community/kube-state-metrics@7.4.0` | default;cluster-metrics-readonly | high=0, medium=2, gates=warn | generated-facts;tpl;capabilities;cluster-rbac;stateful-storage | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | default;cluster-metrics-readonly | high=0, medium=0, gates=allow | tpl;capabilities | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `prometheus-community/prometheus-node-exporter@4.55.0` | default;cluster-metrics-readonly | high=0, medium=1, gates=warn | generated-facts;tpl;capabilities;cluster-rbac | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `sealed-secrets/sealed-secrets@2.18.6` | default;no-crds | high=0, medium=3, gates=allow;warn | - | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `strimzi/strimzi-kafka-operator@1.0.0` | default;no-crds | high=0, medium=20, gates=allow;warn | tpl;capabilities;crds;cluster-rbac | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |

## Review Details

This table is the first promotion-review work packet. It shows what is known,
what is missing, and what must be true before the chart can become a catalog
offer.

| Chart | Current state | Gaps to review | Done when |
| --- | --- | --- | --- |
| `aqua/trivy-operator@0.32.1` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `argo-cd/argo-events@2.4.21` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `argo-cd/argo-rollouts@2.40.9` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable<br>webhook readiness/observation policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `cloudnative-pg/cloudnative-pg@0.28.2` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable<br>webhook readiness/observation policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `elastic/eck-operator@3.4.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable<br>webhook readiness/observation policy must be catalog-readable<br>stateful storage and rollback policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `elastic/logstash@8.5.1` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>stateful storage and rollback policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `external-dns/external-dns@1.21.1` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `gatekeeper/gatekeeper@3.22.2` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable<br>webhook readiness/observation policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `grafana/alloy@1.8.2` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `nats/nats@2.14.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>stateful storage and rollback policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `open-telemetry/opentelemetry-operator@0.114.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable<br>webhook readiness/observation policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `percona/pg-operator@3.0.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `percona/psmdb-operator@1.22.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `percona/pxc-operator@1.19.1` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `prometheus-community/alertmanager@1.37.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>stateful storage and rollback policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `prometheus-community/kube-state-metrics@7.4.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | default-only<br>add or explicitly defer obvious user variants<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | default-only<br>add or explicitly defer obvious user variants | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `prometheus-community/prometheus-node-exporter@4.55.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | default-only<br>add or explicitly defer obvious user variants<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `sealed-secrets/sealed-secrets@2.18.6` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |
| `strimzi/strimzi-kafka-operator@1.0.0` | support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade | human review needed: confirm variants are the obvious Helm-user paths<br>medium scan findings require review or waiver before production support<br>install gate warns<br>production support requires documented disposition or acceptance<br>CRD lifecycle policy must be catalog-readable | a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral |

## Feature Mix

| Feature | Rows |
| --- | ---: |
| `tpl` | 11 |
| `cluster-rbac` | 9 |
| `capabilities` | 8 |
| `crds` | 6 |
| `stateful-storage` | 5 |
| `generated-facts` | 3 |
| `webhooks` | 3 |
| `hooks` | 1 |
| `lookup` | 1 |

## Promotion Review Checklist

For each row:

1. Pick the variant that is a real user path, not merely a rendered baseline.
2. Review the scan and install-gate warnings for that variant.
3. Record accepted, patched, deferred, or blocked dispositions.
4. Name the support scope and delivery path.
5. Link live evidence or write a routed deferral if live proof is not applicable yet.
6. Only then update catalog support status.

## Files

| File | Use |
| --- | --- |
| [wave.csv](./wave.csv) | Spreadsheet queue for the selected promotion-review rows. |
| [wave.yaml](./wave.yaml) | Machine-readable wave input for future tooling. |
| [fast-track.md](./fast-track.md) | Low-residue promotion-review subset with clean scan/gate state. |
| [fast-track.csv](./fast-track.csv) | Spreadsheet form of the fast-track subset. |
| [review-packets/README.md](./review-packets/README.md) | One review packet per selected promotion-wave chart. |
| [work-orders.md](./work-orders.md) | Assignable chart-by-chart review tasks for the first promotion wave. |
| [work-orders.csv](./work-orders.csv) | Spreadsheet form of the promotion review work orders. |
| [../top100-coverage/work-queue.md](../top100-coverage/work-queue.md) | Full strict top-100 work queue. |
| [../catalog-promotion-review/summary.md](../catalog-promotion-review/summary.md) | Machine proof and product gaps for all 100 recipes. |

Regenerate:

~~~sh
npm run top100:promotion-wave
npm run top100:promotion-wave:verify
~~~
