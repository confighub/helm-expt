# Variant Revision Digest Records

Generated. Do not edit by hand.

A variant revision names the digests of the files it was rendered from. This
lane reads every revision in the catalog and reports whether that record still
describes the files it points at.

## Summary

~~~text
revisions: 245
attached: 175
stale: 0
frozen by the release baseline: 26
absent: 44
frozen ceiling: 26
absent ceiling: 44
~~~

## What each state means

Attached means both recorded digests match the files they name, so the record
still describes real bytes.

Stale means the revision records a variant digest that the variant file no
longer has, and this lane is allowed to correct it. The lane refuses on any
stale record.

Frozen means the record is wrong and must stay that way for now, because the
file sits inside the pinned Kubara release baseline. Two rules meet there and
only one can win. A record must describe the file it points at, and a published
release must stay byte for byte what it published. The release wins, because
correcting a record inside it would rewrite evidence someone already pulled.
These records get re-recorded when a release re-pins the baseline, and the lane
refuses if their number grows.

Every wrong record found so far came from an edit that declared target
prerequisites or renamed a variant, neither of which changes a rendered object
set, and no rendered digest has ever gone stale.

Absent means the revision records no variant digest at all. These revisions
were written before the render pipeline recorded digest inputs. Closing one
needs a real re-render rather than a recomputation, so they are carried as an
actionable gap with the next action written next to each row. The count may
fall and the lane refuses if it rises, so a new revision cannot join them.

## Charts holding frozen records

- argo-cd/argo-workflows/1.0.14
- autoscaler/vertical-pod-autoscaler/0.9.0
- bitnami/contour/21.1.4
- bitnami/mongodb/19.0.7
- bitnami/mongodb/19.0.9
- bitnami/mongodb/19.1.0
- bitnami/mysql/14.0.3
- bitnami/postgresql/18.6.10
- bitnami/postgresql/18.6.7
- bitnami/postgresql/18.7.0
- bitnami/rabbitmq/16.0.14
- elastic/metricbeat/8.5.1
- fairwinds-stable/vpa/4.11.0
- grafana/grafana/10.5.15
- hashicorp/consul/2.0.0
- hashicorp/terraform/1.1.2
- istio/istiod/1.30.0
- jaegertracing/jaeger-operator/2.57.0
- jetstack/cert-manager/v1.20.2
- jetstack/trust-manager/v0.22.1
- kyverno/kyverno-policies/3.8.0
- minio-operator/tenant/7.1.1
- open-telemetry/opentelemetry-operator/0.114.0
- projectcalico/tigera-operator/v3.32.0
- rook-release/rook-ceph-cluster/v1.19.5

## Charts holding absent records

- aqua/trivy-operator/0.32.1
- argo-cd/argo-events/2.4.21
- argo-cd/argo-rollouts/2.40.9
- argo-cd/argo-workflows/1.0.14
- autoscaler/vertical-pod-autoscaler/0.9.0
- bitnami/apache/11.4.29
- bitnami/contour/21.1.4
- bitnami/elasticsearch/22.1.6
- bitnami/opensearch/2.0.10
- bitnami/phpmyadmin/20.0.0
- bitnami/spark/10.0.3
- bitnami/zookeeper/13.8.7
- cloudnative-pg/cloudnative-pg/0.28.2
- elastic/eck-operator/3.4.0
- elastic/logstash/8.5.1
- external-dns/external-dns/1.21.1
- fairwinds-stable/vpa/4.11.0
- gatekeeper/gatekeeper/3.22.2
- grafana/alloy/1.8.2
- grafana/pyroscope/2.0.2
- grafana/rollout-operator/0.49.0
- hashicorp/terraform/1.1.2
- jaegertracing/jaeger-operator/2.57.0
- jetstack/trust-manager/v0.22.1
- kedacore/keda/2.19.0
- kyverno/kyverno/3.8.1
- nats/nack/0.34.0
- nats/nats/2.14.0
- open-telemetry/opentelemetry-operator/0.114.0
- percona/pg-operator/3.0.0
- percona/psmdb-operator/1.22.0
- percona/pxc-operator/1.19.1
- prometheus-community/alertmanager/1.37.0
- sealed-secrets/sealed-secrets/2.18.6
- strimzi/strimzi-kafka-operator/1.0.0
- traefik/traefik/40.2.0
- velero/velero/12.0.1

Machine-readable form:

- [digests.csv](./digests.csv)

Regenerate:

~~~sh
npm run variant-revision-digests
npm run variant-revision-digests:verify
~~~
