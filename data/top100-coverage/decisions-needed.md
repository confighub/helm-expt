# Top-100 Decisions Needed

These rows need a human support decision before catalog promotion. The generator
does not decide the outcome. It records the evidence and the options to review.

~~~text
decision rows: 8
~~~

## prometheus-community/prometheus-adapter@5.3.0

Current evidence: in-confighub-proof.

Named limitation: -.

Known variants: default;cluster-metrics-readonly.

Source features: tpl;capabilities;cluster-rbac.

Options:

1. Support the path by adding the required base variant, lifecycle route, target fact, or live evidence.
2. Disclose the limitation and promote only the safe supported base.
3. Defer promotion until the chart has a better user-shaped path.
4. Block the path for public catalog use if it cannot be represented safely.

Next action: decide whether to support, disclose, defer, or block: -.

Evidence:

```text
recipes/prometheus-community/prometheus-adapter/5.3.0/revisions/cluster-metrics-readonly/r001/variant-revision.yaml;recipes/prometheus-community/prometheus-adapter/5.3.0/helm-pain-report.yaml;recipes/prometheus-community/prometheus-adapter/5.3.0/control-points.yaml;data/outcome-coverage/feature-outcomes.csv;recipes/prometheus-community/prometheus-adapter/5.3.0/control-points.yaml;recipes/prometheus-community/prometheus-adapter/5.3.0/value-model.yaml;recipes/prometheus-community/prometheus-adapter/5.3.0/helm-plan.yaml;recipes/prometheus-community/prometheus-adapter/5.3.0/CATALOG.md;recipes/prometheus-community/prometheus-adapter/5.3.0/helm-pain-report.yaml
```

## bitnami/contour@21.1.4

Current evidence: render-parity.

Named limitation: existing-secret (chart ships no Secret toggle).

Known variants: default;no-crds.

Source features: lookup;generated-facts;tpl;capabilities;crds;cluster-rbac.

Options:

1. Support the path by adding the required base variant, lifecycle route, target fact, or live evidence.
2. Disclose the limitation and promote only the safe supported base.
3. Defer promotion until the chart has a better user-shaped path.
4. Block the path for public catalog use if it cannot be represented safely.

Next action: decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle).

Evidence:

```text
recipes/bitnami/contour/21.1.4/revisions/default/r001/variant-revision.yaml;recipes/bitnami/contour/21.1.4/helm-pain-report.yaml;recipes/bitnami/contour/21.1.4/control-points.yaml;data/outcome-coverage/feature-outcomes.csv;recipes/bitnami/contour/21.1.4/control-points.yaml;recipes/bitnami/contour/21.1.4/value-model.yaml;recipes/bitnami/contour/21.1.4/helm-plan.yaml;recipes/bitnami/contour/21.1.4/CATALOG.md;recipes/bitnami/contour/21.1.4/helm-pain-report.yaml
```

## bitnami/elasticsearch@22.1.6

Current evidence: render-parity.

Named limitation: existing-secret (chart ships no Secret toggle).

Known variants: default;ha.

Source features: lookup;generated-facts;tpl;capabilities;stateful-storage.

Options:

1. Support the path by adding the required base variant, lifecycle route, target fact, or live evidence.
2. Disclose the limitation and promote only the safe supported base.
3. Defer promotion until the chart has a better user-shaped path.
4. Block the path for public catalog use if it cannot be represented safely.

Next action: decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle).

Evidence:

```text
recipes/bitnami/elasticsearch/22.1.6/revisions/default/r001/variant-revision.yaml;recipes/bitnami/elasticsearch/22.1.6/helm-pain-report.yaml;recipes/bitnami/elasticsearch/22.1.6/control-points.yaml;data/outcome-coverage/feature-outcomes.csv;recipes/bitnami/elasticsearch/22.1.6/control-points.yaml;recipes/bitnami/elasticsearch/22.1.6/value-model.yaml;recipes/bitnami/elasticsearch/22.1.6/helm-plan.yaml;recipes/bitnami/elasticsearch/22.1.6/CATALOG.md;recipes/bitnami/elasticsearch/22.1.6/helm-pain-report.yaml
```

## bitnami/spark@10.0.3

Current evidence: render-parity.

Named limitation: existing-secret (chart ships no Secret toggle).

Known variants: default;ha.

Source features: lookup;generated-facts;tpl;capabilities;stateful-storage.

Options:

1. Support the path by adding the required base variant, lifecycle route, target fact, or live evidence.
2. Disclose the limitation and promote only the safe supported base.
3. Defer promotion until the chart has a better user-shaped path.
4. Block the path for public catalog use if it cannot be represented safely.

Next action: decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle).

Evidence:

```text
recipes/bitnami/spark/10.0.3/revisions/default/r001/variant-revision.yaml;recipes/bitnami/spark/10.0.3/helm-pain-report.yaml;recipes/bitnami/spark/10.0.3/control-points.yaml;data/outcome-coverage/feature-outcomes.csv;recipes/bitnami/spark/10.0.3/control-points.yaml;recipes/bitnami/spark/10.0.3/value-model.yaml;recipes/bitnami/spark/10.0.3/helm-plan.yaml;recipes/bitnami/spark/10.0.3/CATALOG.md;recipes/bitnami/spark/10.0.3/helm-pain-report.yaml
```

## bitnami/zookeeper@13.8.7

Current evidence: render-parity.

Named limitation: existing-secret (chart ships no Secret toggle).

Known variants: default;ha.

Source features: lookup;generated-facts;tpl;capabilities;stateful-storage.

Options:

1. Support the path by adding the required base variant, lifecycle route, target fact, or live evidence.
2. Disclose the limitation and promote only the safe supported base.
3. Defer promotion until the chart has a better user-shaped path.
4. Block the path for public catalog use if it cannot be represented safely.

Next action: decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle).

Evidence:

```text
recipes/bitnami/zookeeper/13.8.7/revisions/default/r001/variant-revision.yaml;recipes/bitnami/zookeeper/13.8.7/helm-pain-report.yaml;recipes/bitnami/zookeeper/13.8.7/control-points.yaml;data/outcome-coverage/feature-outcomes.csv;recipes/bitnami/zookeeper/13.8.7/control-points.yaml;recipes/bitnami/zookeeper/13.8.7/value-model.yaml;recipes/bitnami/zookeeper/13.8.7/helm-plan.yaml;recipes/bitnami/zookeeper/13.8.7/CATALOG.md;recipes/bitnami/zookeeper/13.8.7/helm-pain-report.yaml
```

## grafana/pyroscope@2.0.2

Current evidence: local-kubernetes-live.

Named limitation: existing-secret (chart ships no Secret toggle).

Known variants: default;ha;no-crds.

Source features: lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage.

Options:

1. Support the path by adding the required base variant, lifecycle route, target fact, or live evidence.
2. Disclose the limitation and promote only the safe supported base.
3. Defer promotion until the chart has a better user-shaped path.
4. Block the path for public catalog use if it cannot be represented safely.

Next action: decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle).

Evidence:

```text
recipes/grafana/pyroscope/2.0.2/revisions/default/r001/variant-revision.yaml;recipes/grafana/pyroscope/2.0.2/helm-pain-report.yaml;recipes/grafana/pyroscope/2.0.2/control-points.yaml;data/outcome-coverage/feature-outcomes.csv;recipes/grafana/pyroscope/2.0.2/control-points.yaml;recipes/grafana/pyroscope/2.0.2/value-model.yaml;recipes/grafana/pyroscope/2.0.2/helm-plan.yaml;recipes/grafana/pyroscope/2.0.2/CATALOG.md;recipes/grafana/pyroscope/2.0.2/helm-pain-report.yaml
```

## kyverno/kyverno@3.8.1

Current evidence: local-kubernetes-live.

Named limitation: existing-secret (chart ships no Secret toggle).

Known variants: default;no-crds.

Source features: lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage.

Options:

1. Support the path by adding the required base variant, lifecycle route, target fact, or live evidence.
2. Disclose the limitation and promote only the safe supported base.
3. Defer promotion until the chart has a better user-shaped path.
4. Block the path for public catalog use if it cannot be represented safely.

Next action: decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle).

Evidence:

```text
recipes/kyverno/kyverno/3.8.1/revisions/default/r001/variant-revision.yaml;recipes/kyverno/kyverno/3.8.1/helm-pain-report.yaml;recipes/kyverno/kyverno/3.8.1/control-points.yaml;data/outcome-coverage/feature-outcomes.csv;recipes/kyverno/kyverno/3.8.1/control-points.yaml;recipes/kyverno/kyverno/3.8.1/value-model.yaml;recipes/kyverno/kyverno/3.8.1/helm-plan.yaml;recipes/kyverno/kyverno/3.8.1/CATALOG.md;recipes/kyverno/kyverno/3.8.1/helm-pain-report.yaml
```

## traefik/traefik@40.2.0

Current evidence: local-kubernetes-live.

Named limitation: existing-secret (chart ships no Secret toggle).

Known variants: default;no-crds.

Source features: lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage.

Options:

1. Support the path by adding the required base variant, lifecycle route, target fact, or live evidence.
2. Disclose the limitation and promote only the safe supported base.
3. Defer promotion until the chart has a better user-shaped path.
4. Block the path for public catalog use if it cannot be represented safely.

Next action: decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle).

Evidence:

```text
recipes/traefik/traefik/40.2.0/revisions/default/r001/variant-revision.yaml;recipes/traefik/traefik/40.2.0/helm-pain-report.yaml;recipes/traefik/traefik/40.2.0/control-points.yaml;data/outcome-coverage/feature-outcomes.csv;recipes/traefik/traefik/40.2.0/control-points.yaml;recipes/traefik/traefik/40.2.0/value-model.yaml;recipes/traefik/traefik/40.2.0/helm-plan.yaml;recipes/traefik/traefik/40.2.0/CATALOG.md;recipes/traefik/traefik/40.2.0/helm-pain-report.yaml
```

