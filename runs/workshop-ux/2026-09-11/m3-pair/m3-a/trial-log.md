
## requested replica change
$ env CUB_CONFIG=./cli/config.yaml node bin/cub-config diff ./trial/prometheus-before.yaml ./trial/prometheus-after.yaml --json --out ./trial/replica-change.json --exit-code
{
  "schemaVersion": 1,
  "scope": "local-configuration-diff",
  "before": {
    "sha256": "sha256:556cbf4cc1e0412d5bc0b10591b7db522e994287063cb79cd45fd375a9944ea8",
    "objectCount": 1
  },
  "after": {
    "sha256": "sha256:d6a536a143d74657625854851a427b6f3042c08fcc040ff1b3f9506665cf3d03",
    "objectCount": 1
  },
  "equal": false,
  "summary": {
    "added": 0,
    "removed": 0,
    "changed": 1,
    "unchanged": 0
  },
  "changes": [
    {
      "object": {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "namespace": "monitoring",
        "name": "prometheus-server"
      },
      "change": "changed",
      "fields": [
        {
          "path": "/spec/replicas",
          "operation": "replace",
          "before": 1,
          "after": 2
        }
      ]
    }
  ],
  "comparison": "Object identity includes API version and explicit namespace; mapping and document order ignored, arrays compared as whole values, missing and null distinct. No Kubernetes defaulting or schema interpretation.",
  "notChecked": [
    "Kubernetes schema or admission validity",
    "upstream merge and protected-field preservation",
    "target readiness or live drift",
    "application availability"
  ]
}
exit: 1

## simulated unrequested extra change
$ env CUB_CONFIG=./cli/config.yaml perl -0pi -e s/terminationGracePeriodSeconds: 300/terminationGracePeriodSeconds: 301/ ./trial/prometheus-extra.yaml
exit: 0

## diff detects extra change
$ env CUB_CONFIG=./cli/config.yaml node bin/cub-config diff ./trial/prometheus-before.yaml ./trial/prometheus-extra.yaml --json --out ./trial/extra-change.json --exit-code
{
  "schemaVersion": 1,
  "scope": "local-configuration-diff",
  "before": {
    "sha256": "sha256:556cbf4cc1e0412d5bc0b10591b7db522e994287063cb79cd45fd375a9944ea8",
    "objectCount": 1
  },
  "after": {
    "sha256": "sha256:5bca09cc31835a7492a50b15baf23d541b65ad3a824dd460254c161426013e5a",
    "objectCount": 1
  },
  "equal": false,
  "summary": {
    "added": 0,
    "removed": 0,
    "changed": 1,
    "unchanged": 0
  },
  "changes": [
    {
      "object": {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "namespace": "monitoring",
        "name": "prometheus-server"
      },
      "change": "changed",
      "fields": [
        {
          "path": "/spec/replicas",
          "operation": "replace",
          "before": 1,
          "after": 2
        },
        {
          "path": "/spec/template/spec/terminationGracePeriodSeconds",
          "operation": "replace",
          "before": 300,
          "after": 301
        }
      ]
    }
  ],
  "comparison": "Object identity includes API version and explicit namespace; mapping and document order ignored, arrays compared as whole values, missing and null distinct. No Kubernetes defaulting or schema interpretation.",
  "notChecked": [
    "Kubernetes schema or admission validity",
    "upstream merge and protected-field preservation",
    "target readiness or live drift",
    "application availability"
  ]
}
exit: 1
556cbf4cc1e0412d5bc0b10591b7db522e994287063cb79cd45fd375a9944ea8  ./trial/prometheus-before.yaml
d6a536a143d74657625854851a427b6f3042c08fcc040ff1b3f9506665cf3d03  ./trial/prometheus-after.yaml
fde050873548d3e3a0744d179501b5512701be2e343abf25f853852430dd43bc  ./trial/replica-change.json
3f55d6829367f007da745e7389bc73e082a74fa5d6b4bc6d2a1082016743be45  ./trial/extra-change.json
diff --git a./trial/prometheus-before.yaml b./trial/prometheus-after.yaml
index a509f5b..e7c8732 100644
--- a./trial/prometheus-before.yaml
+++ b./trial/prometheus-after.yaml
@@ -20,7 +20,7 @@ spec:
       app.kubernetes.io/component: server
       app.kubernetes.io/name: prometheus
       app.kubernetes.io/instance: prometheus
-  replicas: 1
+  replicas: 2
   revisionHistoryLimit: 10
   template:
     metadata:

## textual review diff
exit: 1
