# Helm questions drawn from user reports

This note records why ConfigHub Workshop asks its current configuration questions.
It combines the project's Helm pain-point work with public reports from Helm
users. It is not a survey and does not claim that every Helm user has the same
problems.

## Project sources

- [Helm pain points](../user/helm-pain-points.md) describes the project's
  fifteen operational problem areas.
- [Configuration question workflow](../user/configuration-question-workflow.md)
  turns those areas into decisions a user can ask about one exact
  configuration.
- The internal planning material under `~/Desktop/HELM` adds sceptical-user,
  serverless, Catalog-maintainer, GitOps, and fleet-operator perspectives.

## Repeated public reports

| User problem | Representative reports |
| --- | --- |
| A chart upgrade combines old and new values in an unexpected way. | [Helm #3957](https://github.com/helm/helm/issues/3957), [cert-manager #7352](https://github.com/cert-manager/cert-manager/issues/7352) |
| An interrupted or failed upgrade leaves the release stuck. | [Helm #8987](https://github.com/helm/helm/issues/8987), [Helm #10599](https://github.com/helm/helm/issues/10599) |
| An existing Secret is configured, but an upgrade still asks for a password or fails authentication. | [Bitnami PostgreSQL #24290](https://github.com/bitnami/charts/issues/24290), [Grafana charts #3790](https://github.com/grafana/helm-charts/issues/3790) |
| A small chart change reaches immutable fields or persistent storage. | [Grafana charts #1256](https://github.com/grafana/helm-charts/issues/1256), [Grafana charts #1184](https://github.com/grafana/helm-charts/issues/1184) |
| CRD versions, ownership, and install order do not follow the ordinary workload path. | [Prometheus Community charts #2921](https://github.com/prometheus-community/helm-charts/issues/2921), [Argo CD #20124](https://github.com/argoproj/argo-cd/issues/20124) |
| GitOps changes Helm's hook, ordering, values, drift, or OCI behavior. | [Argo CD #11074](https://github.com/argoproj/argo-cd/issues/11074), [Flux helm-controller #300](https://github.com/fluxcd/helm-controller/issues/300), [Flux discussion #1085](https://github.com/fluxcd/flux2/discussions/1085) |
| Values and templates become hard to read, test, or customize without a fork or another overlay system. | [Reddit: Helm or Kustomize](https://www.reddit.com/r/kubernetes/comments/1ayt7hl/to_kustomize_or_to_helm_which_manifest_tooling_do/), [Reddit: tools people do not trust](https://www.reddit.com/r/devops/comments/1kui6os/whats_one_devops_tool_you_still_dont_fully_trust/) |
| Rollback does not reverse database migrations or other state outside Kubernetes objects. | [Reddit: Helm rollback strategy](https://www.reddit.com/r/kubernetes/comments/1dpkvsy/rollback_strategy_for_helm_releases/) |

## What the reports change in the product

The first question should not be "which feature do you want?" It should be the
decision the user is trying to make:

- What did these values change?
- What could break in this upgrade?
- What must exist before installation?
- Can I avoid a chart fork?
- Who runs the hooks and installs the CRDs?
- Can I return to the exact prior objects?
- How does this differ from what runs now?
- Which environments or clusters are affected?

Each answer must name the source and inputs, show exact objects, separate
desired configuration from live state, state what was not checked, and end in
one action. That action may remain local, produce OCI, become a public Catalog
candidate, or save the reviewed result in ConfigHub.
