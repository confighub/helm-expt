# Top-100 Promotion Wave Work Orders

These generated work orders turn the first promotion wave into assignable
review tasks. They do not promote any chart by themselves.

Each chart is already proof-grade and has strict parity evidence: either
two-cluster kind parity or live Helm-vs-ConfigHub parity.
Promotion still requires selecting the user-facing base, closing scan/gate and
lifecycle questions, choosing the support scope, and linking live evidence or a
routed deferral.

## Summary

~~~text
charts: 30
work orders: 168
~~~

## Work Orders By Chart

### aqua/trivy-operator@0.32.1

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### argo-cd/argo-events@2.4.21

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### argo-cd/argo-rollouts@2.40.9

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### argo-cd/argo-workflows@1.0.14

Variants: `default;controller-default-reviewed;minimal-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;controller-default-reviewed;minimal-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### autoscaler/cluster-autoscaler@9.57.0

Variants: `default;controller-default-reviewed`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;controller-default-reviewed and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### autoscaler/vertical-pod-autoscaler@0.9.0

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### cloudnative-pg/cloudnative-pg@0.28.2

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `generated-facts;tpl;crds;cluster-rbac;webhooks`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | crd-lifecycle | platform reviewer | CRD install, upgrade, ownership, and no-CRDs behavior are recorded or explicitly deferred for the selected base. |
| 4 | webhook-readiness | platform reviewer | Webhook readiness, CA/material injection, failure policy, and observation path are recorded or explicitly deferred. |
| 5 | generated-fact-policy | catalog reviewer | Generated facts are persisted, replaced by target facts, or explicitly scoped out of the promoted base. |
| 6 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 7 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 8 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 9 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### elastic/eck-operator@3.4.0

Variants: `default;ha;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl;capabilities;cluster-rbac;webhooks;stateful-storage`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;ha;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | webhook-readiness | platform reviewer | Webhook readiness, CA/material injection, failure policy, and observation path are recorded or explicitly deferred. |
| 4 | storage-and-rollback-policy | operator reviewer | Storage class assumptions, PVC behavior, backup/rollback boundary, and destructive-change policy are written for the selected base. |
| 5 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 6 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 7 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 8 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### elastic/logstash@8.5.1

Variants: `default;ha`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl;capabilities;stateful-storage`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;ha and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | storage-and-rollback-policy | operator reviewer | Storage class assumptions, PVC behavior, backup/rollback boundary, and destructive-change policy are written for the selected base. |
| 4 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 5 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 6 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### external-dns/external-dns@1.21.1

Variants: `default;no-crds;dry-run-txt-registry`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl;crds;cluster-rbac`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds;dry-run-txt-registry and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | crd-lifecycle | platform reviewer | CRD install, upgrade, ownership, and no-CRDs behavior are recorded or explicitly deferred for the selected base. |
| 4 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 5 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 6 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 7 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### fairwinds-stable/vpa@4.11.0

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `lookup;tpl;capabilities;crds;cluster-rbac;webhooks`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | crd-lifecycle | platform reviewer | CRD install, upgrade, ownership, and no-CRDs behavior are recorded or explicitly deferred for the selected base. |
| 4 | webhook-readiness | platform reviewer | Webhook readiness, CA/material injection, failure policy, and observation path are recorded or explicitly deferred. |
| 5 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 6 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 7 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 8 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### gatekeeper/gatekeeper@3.22.2

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `capabilities;hooks;crds;cluster-rbac;webhooks`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | crd-lifecycle | platform reviewer | CRD install, upgrade, ownership, and no-CRDs behavior are recorded or explicitly deferred for the selected base. |
| 4 | webhook-readiness | platform reviewer | Webhook readiness, CA/material injection, failure policy, and observation path are recorded or explicitly deferred. |
| 5 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 6 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 7 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 8 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### grafana/alloy@1.8.2

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl;capabilities;crds;cluster-rbac;stateful-storage`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | crd-lifecycle | platform reviewer | CRD install, upgrade, ownership, and no-CRDs behavior are recorded or explicitly deferred for the selected base. |
| 4 | storage-and-rollback-policy | operator reviewer | Storage class assumptions, PVC behavior, backup/rollback boundary, and destructive-change policy are written for the selected base. |
| 5 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 6 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 7 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 8 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### grafana/rollout-operator@0.49.0

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### jetstack/trust-manager@v0.22.1

Variants: `default;no-crds`<br>
Evidence: `two-cluster-kind-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### kedacore/keda@2.19.0

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl;capabilities;crds;cluster-rbac;webhooks`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | crd-lifecycle | platform reviewer | CRD install, upgrade, ownership, and no-CRDs behavior are recorded or explicitly deferred for the selected base. |
| 4 | webhook-readiness | platform reviewer | Webhook readiness, CA/material injection, failure policy, and observation path are recorded or explicitly deferred. |
| 5 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 6 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 7 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 8 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### nats/nack@0.34.0

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### nats/nats@2.14.0

Variants: `default;ha`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;ha and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 4 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 5 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### open-telemetry/opentelemetry-operator@0.114.0

Variants: `default;no-crds`<br>
Evidence: `two-cluster-kind-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### percona/pg-operator@3.0.0

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### percona/psmdb-operator@1.22.0

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### percona/pxc-operator@1.19.1

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `lookup;crds;cluster-rbac`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | crd-lifecycle | platform reviewer | CRD install, upgrade, ownership, and no-CRDs behavior are recorded or explicitly deferred for the selected base. |
| 4 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 5 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 6 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### prometheus-community/alertmanager@1.37.0

Variants: `default;ha`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl;stateful-storage`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;ha and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | storage-and-rollback-policy | operator reviewer | Storage class assumptions, PVC behavior, backup/rollback boundary, and destructive-change policy are written for the selected base. |
| 4 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 5 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 6 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### prometheus-community/kube-state-metrics@7.4.0

Variants: `default;cluster-metrics-readonly`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;cluster-metrics-readonly and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | storage-and-rollback-policy | operator reviewer | Storage class assumptions, PVC behavior, backup/rollback boundary, and destructive-change policy are written for the selected base. |
| 4 | generated-fact-policy | catalog reviewer | Generated facts are persisted, replaced by target facts, or explicitly scoped out of the promoted base. |
| 5 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 6 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 7 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 8 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### prometheus-community/prometheus-blackbox-exporter@11.10.0

Variants: `default;cluster-metrics-readonly`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl;capabilities`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;cluster-metrics-readonly and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 4 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 5 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### prometheus-community/prometheus-node-exporter@4.55.0

Variants: `default;cluster-metrics-readonly`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `generated-facts;tpl;capabilities;cluster-rbac`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;cluster-metrics-readonly and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | generated-fact-policy | catalog reviewer | Generated facts are persisted, replaced by target facts, or explicitly scoped out of the promoted base. |
| 4 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 5 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 6 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 7 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### sealed-secrets/sealed-secrets@2.18.6

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### stakater/reloader@2.2.12

Variants: `default;controller-default-reviewed`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl;capabilities;cluster-rbac`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;controller-default-reviewed and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 4 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 5 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 6 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### strimzi/strimzi-kafka-operator@1.0.0

Variants: `default;no-crds`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `tpl;capabilities;crds;cluster-rbac`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;no-crds and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | crd-lifecycle | platform reviewer | CRD install, upgrade, ownership, and no-CRDs behavior are recorded or explicitly deferred for the selected base. |
| 4 | rbac-scope | security reviewer | Cluster permissions are accepted for the support scope or a narrower base is selected. |
| 5 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 6 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 7 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### vm/victoria-metrics-single@0.39.0

Variants: `default;default-reviewed`<br>
Evidence: `live-helm-vs-confighub-parity`<br>
Feature focus: `-`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;default-reviewed and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 4 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

## Spreadsheet

Use [work-orders.csv](./work-orders.csv) for assignment, filtering, and status
tracking.
