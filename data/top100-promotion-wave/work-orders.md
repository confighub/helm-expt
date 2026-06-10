# Top-100 Promotion Wave Work Orders

These generated work orders turn the first promotion wave into assignable
review tasks. They do not promote any chart by themselves.

Each chart is already proof-grade and has two-cluster kind parity evidence.
Promotion still requires selecting the user-facing base, closing scan/gate and
lifecycle questions, choosing the support scope, and linking live evidence or a
routed deferral.

## Summary

~~~text
charts: 8
work orders: 57
~~~

## Work Orders By Chart

### cloudnative-pg/cloudnative-pg@0.28.2

Variants: `default;no-crds`<br>
Evidence: `two-cluster-kind-parity`<br>
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
Evidence: `two-cluster-kind-parity`<br>
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
Evidence: `two-cluster-kind-parity`<br>
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
Evidence: `two-cluster-kind-parity`<br>
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

### grafana/alloy@1.8.2

Variants: `default;no-crds`<br>
Evidence: `two-cluster-kind-parity`<br>
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

### kedacore/keda@2.19.0

Variants: `default;no-crds`<br>
Evidence: `two-cluster-kind-parity`<br>
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

### nats/nats@2.14.0

Variants: `default;ha`<br>
Evidence: `two-cluster-kind-parity`<br>
Feature focus: `tpl`<br>
Current state: support=machine-proof-only; production=not-reviewed-for-production; catalog=proof-grade

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | variant-selection | catalog reviewer | A selected variant is named from default;ha and the non-selected variants have a written promote/defer reason. |
| 2 | scan-and-gate-disposition | security reviewer | Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support. |
| 3 | template-and-capability-boundary | catalog reviewer | The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base. |
| 4 | selected-live-evidence | operator reviewer | The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale. |
| 5 | target-scoped-support-decision | catalog owner | A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome. |

### prometheus-community/alertmanager@1.37.0

Variants: `default;ha`<br>
Evidence: `two-cluster-kind-parity`<br>
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

## Spreadsheet

Use [work-orders.csv](./work-orders.csv) for assignment, filtering, and status
tracking.
