# Who operates this configuration?

When a configuration reaches ConfigHub, the team must decide who owns it and how widely a mistake could spread. An application, a shared monitoring service, and cluster-wide platform configuration should not use identical approval and rollout rules, even when they started from the same package format.

These three examples are checked by the catalog generator and attached to their base-variant records:

| What it controls | Example | Owner | Target | Normal checks | Production checks |
| --- | --- | --- | --- | --- | --- |
| User workload | [NGINX application](../base-variant-records/records/bitnami-nginx-24-0-2-http-clusterip.yaml) | `application-team` | `application-namespace` | common checks | common checks plus approval |
| Shared system service | [Kube Prometheus Stack monitoring service](../base-variant-records/records/prometheus-community-kube-prometheus-stack-85-3-3-no-crds.yaml) | `platform-service-team` | `shared-service-namespace` | common checks | common checks plus approval |
| Cluster-wide system configuration | [Kubara platform configuration](../base-variant-records/records/kubara-local-platform-v0-12-0-base.yaml) | `platform-team` | `cluster` | common checks plus approval | common checks plus approval |

## User workload: NGINX application

One application team owns this release and can change it often without changing shared cluster services.

- **Owner:** `application-team`
- **Target:** `application-namespace`. Start in a development namespace, promote to staging, then release to the selected production clusters.
- **Checks outside production:** common checks.
- **Checks in production:** common checks plus approval.
- **Rollout:** development -> staging -> production targets.
- **Recorded result:** `observed`. The receipt covers two staging clusters; it is not a large production rollout.
- **Live demo Space:** `bitnami-nginx-24-0-2-http-clusterip`

Why these checks apply: Application teams can revise workloads frequently; production still needs an explicit approval.

Evidence:

- [data/oci-deploy-stage-rollout-proof/summary.md](../../data/oci-deploy-stage-rollout-proof/summary.md)
- [runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml)

## Shared system service: Kube Prometheus Stack monitoring service

Monitoring is shared by many workloads, so a platform service team owns it and introduces changes more deliberately.

- **Owner:** `platform-service-team`
- **Target:** `shared-service-namespace`. Install on one non-production cluster first, then move the reviewed service release to the remaining clusters.
- **Checks outside production:** common checks.
- **Checks in production:** common checks plus approval.
- **Rollout:** non-production pilot -> production service wave.
- **Recorded result:** `fresh-install-observed`. Fresh install passed on one kind cluster; the chart upgrade and multi-cluster wave have not run.
- **Live demo Space:** `prometheus-community-kube-prometheus-stack-85-3-3-no-crds`

Why these checks apply: Shared services such as DNS or monitoring use the common checks and add approval in production.

Evidence:

- [data/kps-lifecycle-route-proof/summary.md](../../data/kps-lifecycle-route-proof/summary.md)
- [runs/kps-lifecycle-route-proof/receipt.yaml](../../runs/kps-lifecycle-route-proof/receipt.yaml)

## Cluster-wide system configuration: Kubara platform configuration

This configuration changes cluster-wide platform behavior, so every environment requires approval and rollout starts with one test cluster.

- **Owner:** `platform-team`
- **Target:** `cluster`. Select one test cluster first; expand only after the platform configuration and its dependent service are healthy.
- **Checks outside production:** common checks plus approval.
- **Checks in production:** common checks plus approval.
- **Rollout:** test cluster -> selected fleet wave.
- **Recorded result:** `single-cluster-observed`. One kind cluster and one downstream service passed; a multi-cluster wave has not run.
- **Live demo Space:** `kubara-local-platform-v0-12-0`

Why these checks apply: Cluster-wide platform choices have broad impact, so approval is required in every environment.

Evidence:

- [docs/demo/kubara/local-platform.md](../../docs/demo/kubara/local-platform.md)
- [data/kubara-oci-delivery-proof/summary.md](../../data/kubara-oci-delivery-proof/summary.md)
- [runs/kubara-oci-delivery-proof/receipt.yaml](../../runs/kubara-oci-delivery-proof/receipt.yaml)

## Current boundary

These are the three canonical examples, not an automatic classification of all 255 base records. Unclassified records continue to say `not-yet-classified`; the generator does not guess from a chart name. Add a classification only when ownership, target scope, policy, rollout choice, and evidence are known.

Source: [config-catalog/operational-class-examples.yaml](../../config-catalog/operational-class-examples.yaml). Schema: [schemas/operational-class-examples.schema.json](../../schemas/operational-class-examples.schema.json).
