# Public Helm Adversarial 10 Harness

This is the first scale-out harness after the Redis proof slice. It uses
real public Helm charts and records either a rendered default-values object
set or an explicit blocker receipt.

It is not a certification table. It is the first generated evidence map for
where Helm pain appears and which ConfigHub control point absorbs it.

## Render Context

- Helm: `v4.1.4+g05fa379`
- Kubernetes capability version: `1.30.0`
- Flags: `--include-crds --skip-tests --no-hooks`
- Values profile: chart defaults

## Readiness Counts

- `blocked-needs-values-or-policy`: 1
- `needs-generated-fact-binding`: 4
- `rendered-needs-control-points`: 5

## Charts

| Rank | Chart | Version | Status | Deterministic | Objects | CRDs | Primary Control Point |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| 1 | `bitnami/redis` | `25.5.3` | needs-generated-fact-binding | false | 14 | 0 | generated-facts |
| 2 | `jetstack/cert-manager` | `v1.20.2` | rendered-needs-control-points | true | 42 | 0 | crd-policy |
| 3 | `ingress-nginx/ingress-nginx` | `4.15.1` | rendered-needs-control-points | true | 11 | 0 | capability-profile |
| 4 | `external-secrets/external-secrets` | `2.5.0` | rendered-needs-control-points | true | 42 | 23 | capability-profile |
| 5 | `prometheus-community/kube-prometheus-stack` | `85.3.3` | needs-generated-fact-binding | false | 124 | 10 | generated-facts |
| 6 | `argo-cd/argo-cd` | `9.5.15` | rendered-needs-control-points | true | 49 | 3 | capability-profile |
| 7 | `grafana/loki` | `7.0.0` | blocked-needs-values-or-policy |  | 0 | 0 | recipe-import |
| 8 | `metrics-server/metrics-server` | `3.13.0` | rendered-needs-control-points | true | 9 | 0 | generated-facts |
| 9 | `bitnami/postgresql` | `18.6.7` | needs-generated-fact-binding | false | 7 | 0 | generated-facts |
| 10 | `bitnami/rabbitmq` | `16.0.14` | needs-generated-fact-binding | false | 10 | 0 | generated-facts |

## Doctrine

Rows marked as blocked or not deterministic are not failures of the mission.
They are the point of the harness: the chart's Helm pain must become visible
before ConfigHub turns it into a recipe control point, variant input, scan,
gate, or receipt.

The next proof step is to turn selected rows into full recipe/variant/revision
artifacts, starting from the hazards this harness identified.
