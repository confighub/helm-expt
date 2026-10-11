# Live walk: reading what a plan step asks of each base, 2026-10-11

**UNOFFICIAL/EXPERIMENTAL**

This log records one walk. Twelve Catalog entries had a plan step that named
work and did not say how to do it. Nine were a webhook certificate step and
four were a hooks step, and one entry had both. Each step came from one line of
the entry's flattening verdict file, and that line comes from a sweep of the
whole chart. So the test script of each entry stopped before it applied
anything, and told the reader the step was theirs without saying what to do.

The walk read each entry's retained objects to find out what that base needs
for the step, and who does it. It then ran each entry's `try-objects.sh` on a
throwaway local cluster and watched for the thing the reading predicts. The
readings are in
[data/plan-step-readings/readings.yaml](../../data/plan-step-readings/readings.yaml),
and each one cites the object that shows it.

This is a dated record of one walk. It is not a Guide. Every line that starts
with `$` is a command that was run, and the text under it is the output it
printed. Times are UTC. A line longer than 220 characters is cut and ends with
`...`.

## Versions and setting

- kind v0.31.0 with a node at Kubernetes v1.35.0, kubectl client v1.36.0, Docker 29.4.0, on macOS.
- Every script ran under `/bin/bash`, which is GNU bash 3.2.57 on this machine.
- The home directory held no ConfigHub credentials. No `cub` command ran and no account was used.
- Each cluster had one node. The clusters had their own kubeconfig file, so the machine's default kubeconfig was not touched. One cluster existed at a time.
- The scratch directory is written `<work>`. `$SITE` is the `site/` directory of a checkout of this repository.
- Runs 1 to 12 used the scripts as they stood before the readings were recorded, so each script stopped for the step. The walk then set `REQUIREMENTS_READY=1`, which is what a reader does once a step is settled. Run 13 used three scripts as they stand after the readings were recorded.
- Each script fetched its retained file from this repository's `main` branch on GitHub, as a reader's copy would.
- Every image was pulled from its public registry. No pull failed.

```
$ kind version; kubectl version --client 2>&1 | head -1; docker version --format "{{.Server.Version}}"; /bin/bash --version | head -1
kind v0.31.0 go1.25.5 darwin/arm64
Client Version: v1.36.0
29.4.0
GNU bash, version 3.2.57(1)-release (arm64-apple-darwin25)
[exit 0 at 10:07:44Z]
```

## The answer in brief

| Entry | Step | Reading | What the run saw |
| --- | --- | --- | --- |
| `cloudnative-pg/cloudnative-pg` 0.28.2, base `default` | webhook certificate | The operator supplies it. | All 9 webhooks had a caBundle 13 seconds after the apply. The operator rolled out. |
| `elastic/eck-operator` 3.4.0, base `default` | webhook certificate | The operator supplies it. | All 16 webhooks had a caBundle 13 seconds after the apply. The operator rolled out. |
| `elastic/eck-operator` 3.4.0, base `ha` | webhook certificate | The operator supplies it. | All 16 webhooks had a caBundle 2 seconds after the apply, with the image already on the node. Both Pods became ready. |
| `elastic/eck-operator` 3.4.0, base `no-crds` | webhook certificate | The operator supplies it. | All 16 webhooks had a caBundle 2 seconds after the apply. The Pod became ready. The cluster already held the CRDs this base leaves out. |
| `grafana/rollout-operator` 0.49.0, base `default` | webhook certificate | The operator supplies it. | All 4 webhooks had a caBundle 21 seconds after the apply. The operator rolled out. |
| `hashicorp/vault` 0.32.0, base `dev-mode` | webhook certificate | The agent injector supplies it. | The webhook had a caBundle 8 seconds after the apply. The injector and the server became ready, and the webhook changed a test Pod. |
| `jetstack/cert-manager` v1.20.2, base `crds-enabled` | webhook certificate | The webhook and the cainjector supply it. | Both webhooks had a caBundle 29 seconds after the apply. All three Deployments rolled out. |
| `jetstack/cert-manager` v1.20.2, base `crds-enabled` | hooks | A hook Job does it. The Job only checks the API after an install. | No Job existed. Nothing was missing without it. A test Certificate was issued 45 seconds after the apply. |
| `kedacore/keda` 2.19.0, base `default` | webhook certificate | The operator supplies it. | All 6 webhooks and the APIService had a caBundle 47 seconds after the apply. The operator restarted once on purpose. All three Deployments rolled out. |
| `metallb/metallb` 0.16.1, base `default` | webhook certificate | The controller and frr-k8s supply it. | All 7 webhooks had a caBundle 40 seconds after the apply. All four workloads were ready after 89 seconds. |
| `ingress-nginx/ingress-nginx` 4.15.1, base `admission-disabled` | hooks | Nothing in this base needs it. | The controller was ready after 47 seconds with no webhook configuration, no Job and no Secret. It picked up a test Ingress. |
| `ingress-nginx/ingress-nginx` 4.15.1, base `internal-clusterip` | hooks | Nothing in this base needs it. | The controller was ready after 15 seconds with no webhook configuration, no Job and no Secret. It picked up a test Ingress. |
| `secrets-store-csi-driver/secrets-store-csi-driver` 1.6.0, base `sync-secret-rotation` | hooks | Unknown. The repository does not hold what the hooks run. | The driver was ready after 18 seconds without the hooks. Both CRDs were established and a test object was accepted. |

No run contradicted the reading made before it. No run failed because of a
fault in a generated script.

## How the walk measured a webhook certificate

Two small scripts did the measuring. `ca.sh` prints the length of every
webhook's `caBundle`. `ca-wait.sh` asks every 2 seconds until none is empty,
and then calls `ca.sh`.

```
$ cat ca.sh
#!/bin/bash
# For every webhook configuration, print the length of each webhook's caBundle.
kubectl get validatingwebhookconfiguration,mutatingwebhookconfiguration -o json \
  | jq -r '.items[] | "\(.kind) \(.metadata.name): caBundle lengths \([.webhooks[] | (.clientConfig.caBundle // "" | length)] | map(tostring) | join(" "))"'
[exit 0 at 10:44:45Z]
```

`ca-wait.sh` starts after the test script returns, so its count starts a
moment after the apply. The times in the table come from the cluster's own
record instead. Each webhook configuration records when `kubectl` created it
and when another program last changed it, and the walk printed both.

## Run 1. CloudNativePG 0.28.2, base `default`

The reading says the operator makes its own certificate. The Deployment mounts
the Secret `cnpg-webhook-cert` as optional, the file holds no such Secret, and
the operator's ClusterRole may patch both webhook configurations.

The cluster was new. The script stopped for the step and exited 1.

```
$ kind create cluster --name cwtest-1011-read-1 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Thanks for using kind! 😊
NAME                               STATUS   ROLES           AGE   VERSION
cwtest-1011-read-1-control-plane   Ready    control-plane   33s   v1.35.0
[exit 0 at 10:08:38Z]

$ /bin/bash "$SITE/sh/cloudnative-pg-cloudnative-pg-0-28-2/default/try-objects.sh" 2>&1 | tail -12
doc-0017.yaml
doc-0018.yaml
doc-0019.yaml
doc-0020.yaml
doc-0021.yaml

>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
[exit 0 at 10:08:39Z]

$ /bin/bash "$SITE/sh/cloudnative-pg-cloudnative-pg-0-28-2/default/try-objects.sh" >/dev/null 2>&1; echo "without REQUIREMENTS_READY the script exits $?"
without REQUIREMENTS_READY the script exits 1
[exit 0 at 10:09:10Z]
```

With `REQUIREMENTS_READY=1` it applied the 10 CRDs and the other 11 objects.
Every `caBundle` was empty at that moment.

```
$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/cloudnative-pg-cloudnative-pg-0-28-2/default/try-objects.sh" 2>&1 | tail -14
clusterrole.rbac.authorization.k8s.io/cloudnative-pg-edit created
clusterrolebinding.rbac.authorization.k8s.io/cloudnative-pg created
service/cnpg-webhook-service created
deployment.apps/cloudnative-pg created
mutatingwebhookconfiguration.admissionregistration.k8s.io/cnpg-mutating-webhook-configuration created
validatingwebhookconfiguration.admissionregistration.k8s.io/cnpg-validating-webhook-configuration created

>> Done. The 10 CRDs were applied first. kubectl applied the other 11 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 2 steps of this entry's plan. The entry page says who runs each one.
   - Route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders.
   - Prune protection for the 10 keep-annotated object(s) this base renders.
[exit 0 at 10:08:45Z]

$ bash ./ca.sh
ValidatingWebhookConfiguration cnpg-validating-webhook-configuration: caBundle lengths 0 0 0 0 0
MutatingWebhookConfiguration cnpg-mutating-webhook-configuration: caBundle lengths 0 0 0 0
[exit 0 at 10:08:45Z]

$ bash ./ca-wait.sh
Every caBundle was filled 14 seconds after this check started (9 webhooks).
ValidatingWebhookConfiguration cnpg-validating-webhook-configuration: caBundle lengths 940 940 940 940 940
MutatingWebhookConfiguration cnpg-mutating-webhook-configuration: caBundle lengths 940 940 940 940
[exit 0 at 10:08:59Z]
```

The operator rolled out. It had created two Secrets 12 and 13 seconds after
the Deployment was created. The webhook configuration was last written by the
operator, whose program calls itself `manager`, 13 seconds after `kubectl`
created it.

```
$ kubectl -n default rollout status deployment/cloudnative-pg --timeout=180s; kubectl -n default get pods
deployment "cloudnative-pg" successfully rolled out
NAME                             READY   STATUS    RESTARTS   AGE
cloudnative-pg-d8f4779dd-jt5jb   1/1     Running   0          25s
[exit 0 at 10:09:10Z]

$ kubectl -n default get secret cnpg-webhook-cert cnpg-ca-secret -o custom-columns=NAME:.metadata.name,TYPE:.type,CREATED:.metadata.creationTimestamp; kubectl -n default get deployment cloudnative-pg -o jsonpath="{.me...
NAME                TYPE                CREATED
cnpg-webhook-cert   kubernetes.io/tls   2026-10-11T10:08:58Z
cnpg-ca-secret      Opaque              2026-10-11T10:08:57Z
2026-10-11T10:08:45Z
[exit 0 at 10:09:10Z]

$ kubectl get validatingwebhookconfiguration cnpg-validating-webhook-configuration --show-managed-fields -o json | jq -r ".metadata.managedFields[] | \"\(.manager) \(.operation) \(.time)\""
kubectl-client-side-apply Update 2026-10-11T10:08:45Z
manager Update 2026-10-11T10:08:58Z
[exit 0 at 10:09:15Z]
```

Both webhooks reject a request when they cannot be reached. A server dry-run
of a Cluster passed them, so the API server trusted the certificate.

```
$ printf "apiVersion: postgresql.cnpg.io/v1\nkind: Cluster\nmetadata:\n  name: probe\n  namespace: default\nspec:\n  instances: 1\n  storage:\n    size: 1Gi\n" | kubectl apply --dry-run=server -f -
cluster.postgresql.cnpg.io/probe created (server dry run)
[exit 0 at 10:09:10Z]

$ kind delete cluster --name cwtest-1011-read-1 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-1" ...
Deleted nodes: ["cwtest-1011-read-1-control-plane"]
[exit 0 at 10:09:19Z]
```

## Run 2. ECK operator 3.4.0, base `default`

The reading says the operator fills the Secret `elastic-operator-webhook-cert`
itself. The file holds that Secret with no data, the StatefulSet names it in
`WEBHOOK_SECRET`, and the operator's ClusterRole may update Secrets and
webhook configurations.

```
$ kind create cluster --name cwtest-1011-read-2 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Have a nice day! 👋
NAME                               STATUS   ROLES           AGE   VERSION
cwtest-1011-read-2-control-plane   Ready    control-plane   35s   v1.35.0
[exit 0 at 10:10:34Z]

$ /bin/bash "$SITE/sh/elastic-eck-operator-3-4-0/default/try-objects.sh" 2>&1 | tail -6; echo "script exit: ${PIPESTATUS[0]}"
>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:10:35Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/elastic-eck-operator-3-4-0/default/try-objects.sh" 2>&1 | tail -12; echo "script exit: ${PIPESTATUS[0]}"
clusterrolebinding.rbac.authorization.k8s.io/elastic-operator created
service/elastic-operator-webhook created
statefulset.apps/elastic-operator created
validatingwebhookconfiguration.admissionregistration.k8s.io/elastic-operator.default.k8s.elastic.co created

>> Done. The 12 CRDs were applied first. kubectl applied the other 10 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 2 steps of this entry's plan. The entry page says who runs each one.
   - Route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders.
   - Prune protection for the 12 keep-annotated object(s) this base renders.
script exit: 0
[exit 0 at 10:10:41Z]
```

The Secret had no key and every `caBundle` was empty. Thirteen seconds later
the Secret held a certificate and the operator had written all 16.

```
$ bash ./ca.sh; kubectl -n default get secret elastic-operator-webhook-cert -o json | jq -r "\"Secret elastic-operator-webhook-cert keys: \(.data // {} | keys | join(\" \"))\""
ValidatingWebhookConfiguration elastic-operator.default.k8s.elastic.co: caBundle lengths 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
Secret elastic-operator-webhook-cert keys: 
[exit 0 at 10:10:41Z]

$ bash ./ca-wait.sh
Every caBundle was filled 13 seconds after this check started (16 webhooks).
ValidatingWebhookConfiguration elastic-operator.default.k8s.elastic.co: caBundle lengths 1628 1628 1628 1628 1628 1628 1628 1628 1628 1628 1628 1628 1628 1628 1628 1628
[exit 0 at 10:10:54Z]

$ kubectl -n default rollout status statefulset/elastic-operator --timeout=180s; kubectl -n default get pods
Waiting for 1 pods to be ready...
partitioned roll out complete: 1 new pods have been updated...
NAME                 READY   STATUS    RESTARTS   AGE
elastic-operator-0   1/1     Running   0          14s
[exit 0 at 10:10:55Z]

$ kubectl -n default get secret elastic-operator-webhook-cert -o json | jq -r "\"Secret elastic-operator-webhook-cert keys: \(.data // {} | keys | join(\" \"))\""; kubectl get validatingwebhookconfiguration elastic-op...
Secret elastic-operator-webhook-cert keys: tls.crt tls.key
kubectl-client-side-apply Update 2026-10-11T10:10:41Z
elastic-operator Update 2026-10-11T10:10:54Z
[exit 0 at 10:10:55Z]
```

These webhooks let a request through when they cannot be reached, so a request
that passes proves nothing. The walk sent an Elasticsearch with a version the
operator does not support. The refusal carries the operator's own words, which
are not in any CRD of the file, so the API server reached the webhook.

```
$ printf "apiVersion: elasticsearch.k8s.elastic.co/v1\nkind: Elasticsearch\nmetadata:\n  name: probe\n  namespace: default\nspec:\n  version: 1.0.0\n  nodeSets:\n    - name: default\n      count: 1\n" | kubectl apply ...
The Elasticsearch "probe" is invalid: spec.version: Invalid value: "1.0.0": Unsupported version
[exit 1 at 10:11:04Z]
```

## Run 3. ECK operator 3.4.0, base `ha`

This run used the cluster of run 2. The walk first deleted the 10 objects of
the `default` base that are not CRDs, and left the 12 CRDs. The Secret and the
webhook configuration were gone before the `ha` script ran.

```
$ kubectl delete -f ./elastic-eck-operator-3-4-0-default-objects/rest 2>&1 | tail -4; kubectl -n default wait --for=delete pod/elastic-operator-0 --timeout=120s; kubectl get crd | grep -c k8s.elastic.co; kubectl get v...
clusterrolebinding.rbac.authorization.k8s.io "elastic-operator" deleted
service "elastic-operator-webhook" deleted from default namespace
statefulset.apps "elastic-operator" deleted from default namespace
validatingwebhookconfiguration.admissionregistration.k8s.io "elastic-operator.default.k8s.elastic.co" deleted
pod/elastic-operator-0 condition met
12
No resources found
[exit 0 at 10:11:07Z]
```

The script found the 12 CRDs present and matching and left them alone. It
applied the other 10 objects.

```
$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/elastic-eck-operator-3-4-0/ha/try-objects.sh" 2>&1 | tail -12; echo "script exit: ${PIPESTATUS[0]}"
clusterrolebinding.rbac.authorization.k8s.io/elastic-operator created
service/elastic-operator-webhook created
statefulset.apps/elastic-operator created
validatingwebhookconfiguration.admissionregistration.k8s.io/elastic-operator.default.k8s.elastic.co created

>> Done. The 12 CRDs already existed and matched, so the script left them alone. kubectl applied the other 10 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 2 steps of this entry's plan. The entry page says who runs each one.
   - Route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders.
   - Prune protection for the 12 keep-annotated object(s) this base renders.
script exit: 0
[exit 0 at 10:11:15Z]

$ bash ./ca.sh
ValidatingWebhookConfiguration elastic-operator.default.k8s.elastic.co: caBundle lengths 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
[exit 0 at 10:11:15Z]

$ bash ./ca-wait.sh
Every caBundle was filled 2 seconds after this check started (16 webhooks).
ValidatingWebhookConfiguration elastic-operator.default.k8s.elastic.co: caBundle lengths 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632
[exit 0 at 10:11:17Z]
```

The image was already on the node, so the operator started at once. Both Pods
became ready, and one of them held the leader lease.

```
$ kubectl -n default rollout status statefulset/elastic-operator --timeout=240s; kubectl -n default get pods
Waiting for 1 pods to be ready...
partitioned roll out complete: 2 new pods have been updated...
NAME                 READY   STATUS    RESTARTS   AGE
elastic-operator-0   1/1     Running   0          3s
elastic-operator-1   1/1     Running   0          1s
[exit 0 at 10:11:18Z]

$ kubectl get validatingwebhookconfiguration elastic-operator.default.k8s.elastic.co --show-managed-fields -o json | jq -r ".metadata.managedFields[] | \"\(.manager) \(.operation) \(.time)\""; kubectl -n default get l...
kubectl-client-side-apply Update 2026-10-11T10:11:15Z
elastic-operator Update 2026-10-11T10:11:17Z
NAME                      HOLDER                                                    AGE
elastic-operator-leader   elastic-operator-0_1d7546c3-e3e9-4fae-ada9-259240feafa9   23s
[exit 0 at 10:11:18Z]

$ printf "apiVersion: elasticsearch.k8s.elastic.co/v1\nkind: Elasticsearch\nmetadata:\n  name: probe\n  namespace: default\nspec:\n  version: 1.0.0\n  nodeSets:\n    - name: default\n      count: 1\n" | kubectl apply ...
The Elasticsearch "probe" is invalid: spec.version: Invalid value: "1.0.0": Unsupported version
[exit 1 at 10:11:30Z]
```

## Run 4. ECK operator 3.4.0, base `no-crds`

This run used the same cluster again. The walk deleted the 10 objects of the
`ha` base that are not CRDs and checked that the Secret and the webhook
configuration were gone. The 12 CRDs stayed. This base leaves them out, so a
reader who uses it has them from somewhere else, as this cluster did.

```
$ kubectl delete -f ./elastic-eck-operator-3-4-0-ha-objects/rest 2>&1 | grep -c deleted; kubectl -n default wait --for=delete pod/elastic-operator-0 pod/elastic-operator-1 --timeout=120s; kubectl -n default get secret...
10
pod/elastic-operator-0 condition met
pod/elastic-operator-1 condition met
Error from server (NotFound): secrets "elastic-operator-webhook-cert" not found
No resources found
[exit 0 at 10:11:31Z]

$ /bin/bash "$SITE/sh/elastic-eck-operator-3-4-0/no-crds/try-objects.sh" 2>&1 | tail -6; echo "script exit: ${PIPESTATUS[0]}"
>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:11:31Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/elastic-eck-operator-3-4-0/no-crds/try-objects.sh" 2>&1 | tail -9; echo "script exit: ${PIPESTATUS[0]}"
statefulset.apps/elastic-operator created
validatingwebhookconfiguration.admissionregistration.k8s.io/elastic-operator.default.k8s.elastic.co created

>> Done. kubectl applied the 10 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders.
script exit: 0
[exit 0 at 10:11:32Z]

$ bash ./ca.sh; kubectl -n default get secret elastic-operator-webhook-cert -o json | jq -r "\"Secret elastic-operator-webhook-cert keys: \(.data // {} | keys | join(\" \"))\""
ValidatingWebhookConfiguration elastic-operator.default.k8s.elastic.co: caBundle lengths 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
Secret elastic-operator-webhook-cert keys: 
[exit 0 at 10:11:32Z]

$ bash ./ca-wait.sh
Every caBundle was filled 2 seconds after this check started (16 webhooks).
ValidatingWebhookConfiguration elastic-operator.default.k8s.elastic.co: caBundle lengths 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632 1632
[exit 0 at 10:11:34Z]

$ kubectl -n default rollout status statefulset/elastic-operator --timeout=240s; kubectl -n default get pods; kubectl -n default get secret elastic-operator-webhook-cert -o json | jq -r "\"Secret elastic-operator-webh...
partitioned roll out complete: 1 new pods have been updated...
NAME                 READY   STATUS    RESTARTS   AGE
elastic-operator-0   1/1     Running   0          2s
Secret elastic-operator-webhook-cert keys: tls.crt tls.key
[exit 0 at 10:11:34Z]

$ printf "apiVersion: elasticsearch.k8s.elastic.co/v1\nkind: Elasticsearch\nmetadata:\n  name: probe\n  namespace: default\nspec:\n  version: 1.0.0\n  nodeSets:\n    - name: default\n      count: 1\n" | kubectl apply ...
The Elasticsearch "probe" is invalid: spec.version: Invalid value: "1.0.0": Unsupported version
[exit 1 at 10:11:34Z]

$ kind delete cluster --name cwtest-1011-read-2 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-2" ...
Deleted nodes: ["cwtest-1011-read-2-control-plane"]
[exit 0 at 10:11:36Z]
```

## Run 5. Grafana rollout-operator 0.49.0, base `default`

The reading says the operator signs its own certificate. Its arguments hold
`-server-tls.self-signed-cert.secret-name=certificate`, a Role lets it create
that Secret, and a ClusterRole lets it patch webhook configurations. All four
webhook configurations carry the label `grafana.com/inject-rollout-operator-ca`.

```
$ kind create cluster --name cwtest-1011-read-3 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Have a question, bug, or feature request? Let us know! https://kind.sigs.k8s.io/#community 🙂
NAME                               STATUS   ROLES           AGE   VERSION
cwtest-1011-read-3-control-plane   Ready    control-plane   76s   v1.35.0
[exit 0 at 10:13:25Z]

$ /bin/bash "$SITE/sh/grafana-rollout-operator-0-49-0/default/try-objects.sh" 2>&1 | tail -6; echo "script exit: ${PIPESTATUS[0]}"
>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Route to cert-manager or a certgen lifecycle route for the 4 webhook configuration(s) this base renders.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:13:25Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/grafana-rollout-operator-0-49-0/default/try-objects.sh" 2>&1 | tail -16; echo "script exit: ${PIPESTATUS[0]}"
role.rbac.authorization.k8s.io/rollout-operator-webhook-role created
rolebinding.rbac.authorization.k8s.io/rollout-operator created
rolebinding.rbac.authorization.k8s.io/rollout-operator-webhook-rolebinding created
service/rollout-operator created
deployment.apps/rollout-operator created
mutatingwebhookconfiguration.admissionregistration.k8s.io/prepare-downscale-default created
validatingwebhookconfiguration.admissionregistration.k8s.io/no-downscale-default created
validatingwebhookconfiguration.admissionregistration.k8s.io/pod-eviction-default created
validatingwebhookconfiguration.admissionregistration.k8s.io/zpdb-validation-default created

>> Done. The 2 CRDs were applied first. kubectl applied the other 13 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Route to cert-manager or a certgen lifecycle route for the 4 webhook configuration(s) this base renders.
script exit: 0
[exit 0 at 10:13:27Z]

$ bash ./ca.sh; kubectl -n default get secret certificate 2>&1
ValidatingWebhookConfiguration no-downscale-default: caBundle lengths 0
ValidatingWebhookConfiguration pod-eviction-default: caBundle lengths 0
ValidatingWebhookConfiguration zpdb-validation-default: caBundle lengths 0
MutatingWebhookConfiguration prepare-downscale-default: caBundle lengths 0
Error from server (NotFound): secrets "certificate" not found
[exit 1 at 10:13:27Z]

$ bash ./ca-wait.sh
Every caBundle was filled 20 seconds after this check started (4 webhooks).
ValidatingWebhookConfiguration no-downscale-default: caBundle lengths 2412
ValidatingWebhookConfiguration pod-eviction-default: caBundle lengths 2412
ValidatingWebhookConfiguration zpdb-validation-default: caBundle lengths 2412
MutatingWebhookConfiguration prepare-downscale-default: caBundle lengths 2412
[exit 0 at 10:13:47Z]

$ kubectl -n default rollout status deployment/rollout-operator --timeout=180s; kubectl -n default get pods; kubectl -n default get secret certificate -o json | jq -r "\"Secret certificate created \(.metadata.creation...
Waiting for deployment "rollout-operator" rollout to finish: 0 of 1 updated replicas are available...
Waiting for deployment "rollout-operator" rollout to finish: 0 of 1 updated replicas are available...
deployment "rollout-operator" successfully rolled out
NAME                                READY   STATUS    RESTARTS   AGE
rollout-operator-5f688cdb68-pfm8g   1/1     Running   0          39s
Secret certificate created 2026-10-11T10:13:47Z, keys: ca cert key
[exit 0 at 10:14:07Z]

$ kubectl get mutatingwebhookconfiguration prepare-downscale-default --show-managed-fields -o json | jq -r ".metadata.managedFields[] | \"\(.manager) \(.operation) \(.time)\""
kubectl-client-side-apply Update 2026-10-11T10:13:26Z
rollout-operator Update 2026-10-11T10:13:47Z
[exit 0 at 10:14:07Z]
```

The operator's log says the same. The walk sent no request through these
webhooks. They watch StatefulSets and Pod evictions, and the one probe the
walk tried scaled a Deployment, which none of them watches.

```
$ kubectl -n default logs deployment/rollout-operator 2>&1 | grep -i -E "webhook|downscale|certificate" | tail -6
level=info ts=2026-10-11T10:13:47.315177648Z msg="validating webhook configuration already has same CA bundle set, not patching" name=pod-eviction-default
level=info ts=2026-10-11T10:13:47.315193605Z msg="validating webhook configuration already has same CA bundle set, not patching" name=zpdb-validation-default
level=info ts=2026-10-11T10:13:47.315602204Z msg="validating webhook configuration already has same CA bundle set, not patching" name=no-downscale-default
level=info ts=2026-10-11T10:13:47.377097908Z msg="webhook informer caches sync completed"
level=info ts=2026-10-11T10:13:47.378503066Z msg="waiting for webhook informer caches to sync"
level=info ts=2026-10-11T10:13:47.479891047Z msg="webhook informer caches sync completed"
[exit 0 at 10:14:18Z]

$ kind delete cluster --name cwtest-1011-read-3 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-3" ...
Deleted nodes: ["cwtest-1011-read-3-control-plane"]
[exit 0 at 10:14:21Z]
```

## Run 6. HashiCorp Vault 0.32.0, base `dev-mode`

The reading says the agent injector makes its own certificate. Its Deployment
sets `AGENT_INJECT_TLS_AUTO` to the name of the webhook configuration, and its
ClusterRole may patch that kind.

```
$ kind create cluster --name cwtest-1011-read-4 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Have a nice day! 👋
NAME                               STATUS   ROLES           AGE   VERSION
cwtest-1011-read-4-control-plane   Ready    control-plane   26s   v1.35.0
[exit 0 at 10:15:09Z]

$ /bin/bash "$SITE/sh/hashicorp-vault-0-32-0/dev-mode/try-objects.sh" 2>&1 | tail -6; echo "script exit: ${PIPESTATUS[0]}"
>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:15:09Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/hashicorp-vault-0-32-0/dev-mode/try-objects.sh" 2>&1 | tail -22; echo "script exit: ${PIPESTATUS[0]}"
>> Create the vault namespace if it does not exist
namespace/vault created

>> Apply the 11 objects
serviceaccount/vault-agent-injector created
serviceaccount/vault created
clusterrole.rbac.authorization.k8s.io/vault-agent-injector-clusterrole created
clusterrolebinding.rbac.authorization.k8s.io/vault-agent-injector-binding created
clusterrolebinding.rbac.authorization.k8s.io/vault-server-binding created
service/vault-agent-injector-svc created
service/vault-internal created
service/vault created
deployment.apps/vault-agent-injector created
statefulset.apps/vault created
mutatingwebhookconfiguration.admissionregistration.k8s.io/vault-agent-injector-cfg created

>> Done. kubectl applied the 11 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders.
script exit: 0
[exit 0 at 10:15:10Z]

$ bash ./ca.sh
MutatingWebhookConfiguration vault-agent-injector-cfg: caBundle lengths 0
[exit 0 at 10:15:10Z]

$ bash ./ca-wait.sh
Every caBundle was filled 9 seconds after this check started (1 webhooks).
MutatingWebhookConfiguration vault-agent-injector-cfg: caBundle lengths 1136
[exit 0 at 10:15:19Z]
```

The injector rolled out. `kubectl rollout status` does not work for this
StatefulSet, because its update strategy is `OnDelete`, so the walk waited for
the Pod instead. The injector, whose program calls itself `vault-k8s`, wrote
the `caBundle` 8 seconds after `kubectl` created the object. It keeps the
certificate in memory and made no Secret.

```
$ kubectl -n vault rollout status deployment/vault-agent-injector --timeout=240s; kubectl -n vault rollout status statefulset/vault --timeout=240s; kubectl -n vault get pods
Waiting for deployment "vault-agent-injector" rollout to finish: 0 of 1 updated replicas are available...
deployment "vault-agent-injector" successfully rolled out
error: rollout status is only available for RollingUpdate strategy type
NAME                                   READY   STATUS              RESTARTS   AGE
vault-0                                0/1     ContainerCreating   0          15s
vault-agent-injector-8c76487db-cptn4   1/1     Running             0          15s
[exit 0 at 10:15:25Z]

$ kubectl get mutatingwebhookconfiguration vault-agent-injector-cfg --show-managed-fields -o json | jq -r ".metadata.managedFields[] | \"\(.manager) \(.operation) \(.time)\""; kubectl -n vault get secrets 2>&1
kubectl-client-side-apply Update 2026-10-11T10:15:10Z
vault-k8s Update 2026-10-11T10:15:18Z
No resources found in vault namespace.
[exit 0 at 10:15:26Z]

$ kubectl -n vault wait --for=condition=Ready pod/vault-0 --timeout=240s; kubectl -n vault get pods
pod/vault-0 condition met
NAME                                   READY   STATUS    RESTARTS   AGE
vault-0                                1/1     Running   0          45s
vault-agent-injector-8c76487db-cptn4   1/1     Running   0          45s
[exit 0 at 10:15:55Z]
```

This webhook lets a request through when it cannot be reached. A server
dry-run of a Pod that asks for injection came back with the two agent
containers added, so the API server reached the webhook.

```
$ kubectl -n default run probe --image=registry.k8s.io/pause:3.10 --annotations=vault.hashicorp.com/agent-inject=true --annotations=vault.hashicorp.com/role=probe --dry-run=server -o json | jq -r "\"containers: \([.sp...
containers: probe vault-agent, init containers: vault-agent-init
[exit 0 at 10:15:55Z]

$ kind delete cluster --name cwtest-1011-read-4 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-4" ...
Deleted nodes: ["cwtest-1011-read-4-control-plane"]
[exit 0 at 10:15:56Z]
```

## Run 7. cert-manager v1.20.2, base `crds-enabled`

This entry has both steps.

The reading of the webhook certificate step says cert-manager supplies it. The
webhook's arguments name the Secret `cert-manager-webhook-ca` for a CA it
makes itself, a Role lets it create that Secret, and both webhook
configurations carry the annotation `cert-manager.io/inject-ca-from-secret`.
The cainjector that acts on that annotation is one of the file's own
Deployments.

The reading of the hooks step says the chart's hooks all belong to one Job,
`cert-manager-startupapicheck`. It runs after an install and only checks that
the cert-manager API answers. The retained file holds no Job.

The script stopped for both steps.

```
$ kind create cluster --name cwtest-1011-read-5 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Have a nice day! 👋
NAME                               STATUS   ROLES           AGE   VERSION
cwtest-1011-read-5-control-plane   Ready    control-plane   24s   v1.35.0
[exit 0 at 10:16:42Z]

$ /bin/bash "$SITE/sh/jetstack-cert-manager-v1-20-2/crds-enabled/try-objects.sh" 2>&1 | tail -8; echo "script exit: ${PIPESTATUS[0]}"

>> Stop before applying anything. This entry's plan has 2 steps that an install needs first
This script cannot carry out these steps of the plan. They are yours to do, with your own values:
  - Route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders.
  - Lifecycle route for the packaged chart's 3 non-test hook occurrence(s). The hook phase is post-install.
Nothing was applied. Complete them before you apply the objects.
When they are done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:16:43Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/jetstack-cert-manager-v1-20-2/crds-enabled/try-objects.sh" 2>&1 | tail -12; echo "script exit: ${PIPESTATUS[0]}"
deployment.apps/cert-manager-webhook created
mutatingwebhookconfiguration.admissionregistration.k8s.io/cert-manager-webhook created
validatingwebhookconfiguration.admissionregistration.k8s.io/cert-manager-webhook created

>> Done. The 6 CRDs were applied first. kubectl applied the other 42 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 3 steps of this entry's plan. The entry page says who runs each one.
   - Route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders.
   - Lifecycle route for the packaged chart's 3 non-test hook occurrence(s). The hook phase is post-install.
   - Prune protection for the 6 keep-annotated object(s) this base renders.
script exit: 0
[exit 0 at 10:16:48Z]

$ bash ./ca.sh; kubectl -n cert-manager get secret cert-manager-webhook-ca 2>&1
ValidatingWebhookConfiguration cert-manager-webhook: caBundle lengths 0
MutatingWebhookConfiguration cert-manager-webhook: caBundle lengths 0
Error from server (NotFound): secrets "cert-manager-webhook-ca" not found
[exit 1 at 10:16:48Z]

$ bash ./ca-wait.sh
Every caBundle was filled 30 seconds after this check started (2 webhooks).
ValidatingWebhookConfiguration cert-manager-webhook: caBundle lengths 904
MutatingWebhookConfiguration cert-manager-webhook: caBundle lengths 904
[exit 0 at 10:17:18Z]

$ for d in cert-manager cert-manager-cainjector cert-manager-webhook; do kubectl -n cert-manager rollout status deployment/$d --timeout=240s; done; kubectl -n cert-manager get pods
deployment "cert-manager" successfully rolled out
deployment "cert-manager-cainjector" successfully rolled out
Waiting for deployment "cert-manager-webhook" rollout to finish: 0 of 1 updated replicas are available...
deployment "cert-manager-webhook" successfully rolled out
NAME                                       READY   STATUS    RESTARTS   AGE
cert-manager-5957746d66-7jgln              1/1     Running   0          38s
cert-manager-cainjector-567c6b47ff-tnzgj   1/1     Running   0          38s
cert-manager-webhook-7cc5c588cb-tfccs      1/1     Running   0          38s
[exit 0 at 10:17:26Z]

$ kubectl -n cert-manager get secret cert-manager-webhook-ca -o json | jq -r "\"Secret cert-manager-webhook-ca created \(.metadata.creationTimestamp), keys: \(.data | keys | join(\" \"))\""; kubectl get validatingwebh...
Secret cert-manager-webhook-ca created 2026-10-11T10:17:17Z, keys: ca.crt tls.crt tls.key
kubectl-client-side-apply Update 2026-10-11T10:16:48Z
cert-manager-cainjector Update 2026-10-11T10:17:17Z
[exit 0 at 10:17:26Z]
```

The Secret was created 29 seconds after the apply, and the cainjector wrote
the `caBundle` in the same second.

No Job existed, so nothing had checked the API. The walk did that check by
hand. It applied a self-signed Issuer and a Certificate, which both pass
through the webhooks, and the Certificate was ready at once. The walk did not
run the Job itself, so the record still says the hooks step was not run.

```
$ kubectl get jobs -A 2>&1
No resources found
[exit 0 at 10:17:26Z]

$ printf "apiVersion: cert-manager.io/v1\nkind: Issuer\nmetadata:\n  name: probe\n  namespace: default\nspec:\n  selfSigned: {}\n---\napiVersion: cert-manager.io/v1\nkind: Certificate\nmetadata:\n  name: probe\n  name...
issuer.cert-manager.io/probe created
certificate.cert-manager.io/probe created
certificate.cert-manager.io/probe condition met
NAME    READY   SECRET      AGE
probe   True    probe-tls   0s
NAME        TYPE
probe-tls   kubernetes.io/tls
[exit 0 at 10:17:33Z]

$ kind delete cluster --name cwtest-1011-read-5 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-5" ...
Deleted nodes: ["cwtest-1011-read-5-control-plane"]
[exit 0 at 10:17:35Z]
```

## Run 8. KEDA 2.19.0, base `default`

The reading says the operator makes the Secret `kedaorg-certs` and writes the
`caBundle`. Its arguments hold `--enable-cert-rotation=true` and
`--enable-webhook-patching=true`, a Role lets it create Secrets, and a
ClusterRole lets it patch the webhook configuration and the APIService.

```
$ kind create cluster --name cwtest-1011-read-6 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Not sure what to do next? 😅  Check out https://kind.sigs.k8s.io/docs/user/quick-start/
NAME                               STATUS   ROLES           AGE   VERSION
cwtest-1011-read-6-control-plane   Ready    control-plane   23s   v1.35.0
[exit 0 at 10:18:18Z]

$ /bin/bash "$SITE/sh/kedacore-keda-2-19-0/default/try-objects.sh" 2>&1 | tail -6; echo "script exit: ${PIPESTATUS[0]}"
>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:18:18Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/kedacore-keda-2-19-0/default/try-objects.sh" 2>&1 | tail -10; echo "script exit: ${PIPESTATUS[0]}"
deployment.apps/keda-admission-webhooks created
apiservice.apiregistration.k8s.io/v1beta1.external.metrics.k8s.io created
validatingwebhookconfiguration.admissionregistration.k8s.io/keda-admission created

>> Done. The 6 CRDs were applied first. kubectl applied the other 23 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders.
script exit: 0
[exit 0 at 10:18:21Z]

$ bash ./ca.sh; kubectl -n default get secret kedaorg-certs 2>&1
ValidatingWebhookConfiguration keda-admission: caBundle lengths 0 0 0 0 0 0
Error from server (NotFound): secrets "kedaorg-certs" not found
[exit 1 at 10:18:21Z]

$ bash ./ca-wait.sh
Every caBundle was filled 47 seconds after this check started (6 webhooks).
ValidatingWebhookConfiguration keda-admission: caBundle lengths 1500 1500 1500 1500 1500 1500
[exit 0 at 10:19:09Z]

$ for d in keda-operator keda-operator-metrics-apiserver keda-admission-webhooks; do kubectl -n default rollout status deployment/$d --timeout=300s; done; kubectl -n default get pods
Waiting for deployment "keda-operator" rollout to finish: 0 of 1 updated replicas are available...
deployment "keda-operator" successfully rolled out
deployment "keda-operator-metrics-apiserver" successfully rolled out
deployment "keda-admission-webhooks" successfully rolled out
NAME                                              READY   STATUS    RESTARTS      AGE
keda-admission-webhooks-7b48797dc8-rnhgs          1/1     Running   0             52s
keda-operator-55db59458d-qmb25                    1/1     Running   1 (37s ago)   52s
keda-operator-metrics-apiserver-cb7df9874-dbmhx   1/1     Running   0             52s
[exit 0 at 10:19:13Z]

$ kubectl -n default get secret kedaorg-certs -o json | jq -r "\"Secret kedaorg-certs created \(.metadata.creationTimestamp), keys: \(.data | keys | join(\" \"))\""; kubectl get validatingwebhookconfiguration keda-adm...
Secret kedaorg-certs created 2026-10-11T10:18:36Z, keys: ca.crt ca.key tls.crt tls.key
kubectl-client-side-apply Update 2026-10-11T10:18:21Z
keda Update 2026-10-11T10:19:08Z
[exit 0 at 10:19:13Z]

$ kubectl get apiservice v1beta1.external.metrics.k8s.io -o json | jq -r "\"APIService caBundle length \(.spec.caBundle // \"\" | length), Available=\(.status.conditions[] | select(.type==\"Available\") | .status)\""
APIService caBundle length 1500, Available=True
[exit 0 at 10:19:13Z]
```

This took the longest of the nine. The operator created the Secret 15 seconds
after the apply and then exited, so that it restarted with the new
certificate. That is the one restart in the list of Pods, and the operator's
log says it is meant.

```
$ kubectl -n default logs deployment/keda-operator --previous 2>&1 | tail -4 | cut -c1-220
2026-10-11T10:18:36Z	INFO	cert-rotation	refreshing CA and server certs
2026-10-11T10:18:36Z	INFO	cert-rotation	refreshing CA and server certs
2026-10-11T10:18:36Z	INFO	cert-rotation	server certs refreshed
2026-10-11T10:18:36Z	INFO	cert-rotation	Secrets have been updated; exiting so pod can be restarted (This behaviour can be changed with the option RestartOnSecretRefresh)
[exit 0 at 10:19:19Z]

$ kind delete cluster --name cwtest-1011-read-6 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-6" ...
Deleted nodes: ["cwtest-1011-read-6-control-plane"]
[exit 0 at 10:19:24Z]
```

## Run 9. MetalLB 0.16.1, base `default`

The reading says two workloads each supply their own. The file holds two
Secrets with no data. The MetalLB controller runs with `--webhook-mode=enabled`
and mounts one of them, and its ClusterRole may update the webhook
configuration `metallb-webhook-configuration`. The frr-k8s status cleaner
mounts the other, and the frr-k8s ClusterRole may update
`frr-k8s-validating-webhook-configuration`.

```
$ kind create cluster --name cwtest-1011-read-7 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Thanks for using kind! 😊
NAME                               STATUS   ROLES           AGE   VERSION
cwtest-1011-read-7-control-plane   Ready    control-plane   21s   v1.35.0
[exit 0 at 10:20:13Z]

$ /bin/bash "$SITE/sh/metallb-metallb-0-16-1/default/try-objects.sh" 2>&1 | tail -6; echo "script exit: ${PIPESTATUS[0]}"
>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:20:14Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/metallb-metallb-0-16-1/default/try-objects.sh" 2>&1 | tail -10; echo "script exit: ${PIPESTATUS[0]}"
deployment.apps/metallb-controller created
validatingwebhookconfiguration.admissionregistration.k8s.io/frr-k8s-validating-webhook-configuration created
validatingwebhookconfiguration.admissionregistration.k8s.io/metallb-webhook-configuration created

>> Done. The 13 CRDs were applied first. kubectl applied the other 29 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders.
script exit: 0
[exit 0 at 10:20:19Z]

$ bash ./ca.sh; kubectl -n metallb-system get secrets -o json | jq -r ".items[] | \"Secret \(.metadata.name) keys: \(.data // {} | keys | join(\" \"))\""
ValidatingWebhookConfiguration frr-k8s-validating-webhook-configuration: caBundle lengths 0
ValidatingWebhookConfiguration metallb-webhook-configuration: caBundle lengths 0 0 0 0 0 0
Secret frr-k8s-webhook-server-cert keys: 
Secret metallb-webhook-cert keys: 
[exit 0 at 10:20:19Z]

$ bash ./ca-wait.sh 420
Every caBundle was filled 41 seconds after this check started (7 webhooks).
ValidatingWebhookConfiguration frr-k8s-validating-webhook-configuration: caBundle lengths 1492
ValidatingWebhookConfiguration metallb-webhook-configuration: caBundle lengths 1500 1500 1500 1500 1500 1500
[exit 0 at 10:21:00Z]

$ kubectl -n metallb-system get pods; kubectl -n metallb-system get secrets -o json | jq -r ".items[] | \"Secret \(.metadata.name) keys: \(.data // {} | keys | join(\" \"))\""
NAME                                            READY   STATUS              RESTARTS   AGE
metallb-controller-55846b4849-tsxpl             0/1     Running             0          41s
metallb-frr-k8s-fb95r                           4/5     Running             0          41s
metallb-frr-k8s-statuscleaner-8bf664555-kqh79   1/1     Running             0          41s
metallb-speaker-26whl                           0/1     ContainerCreating   0          41s
Secret frr-k8s-webhook-server-cert keys: ca.crt ca.key tls.crt tls.key
Secret metallb-memberlist keys: secretkey
Secret metallb-webhook-cert keys: ca.crt ca.key tls.crt tls.key
[exit 0 at 10:21:00Z]
```

Both Secrets held a certificate by then. The controller had also made the
Secret `metallb-memberlist`, which the speaker waits for. All four workloads
became ready.

```
$ kubectl -n metallb-system rollout status deployment/metallb-controller --timeout=300s; kubectl -n metallb-system rollout status deployment/metallb-frr-k8s-statuscleaner --timeout=300s; kubectl -n metallb-system roll...
Waiting for deployment "metallb-controller" rollout to finish: 0 of 1 updated replicas are available...
deployment "metallb-controller" successfully rolled out
deployment "metallb-frr-k8s-statuscleaner" successfully rolled out
Waiting for daemon set "metallb-speaker" rollout to finish: 0 of 1 updated pods are available...
daemon set "metallb-speaker" successfully rolled out
daemon set "metallb-frr-k8s" successfully rolled out
NAME                                            READY   STATUS    RESTARTS   AGE
metallb-controller-55846b4849-tsxpl             1/1     Running   0          89s
metallb-frr-k8s-fb95r                           5/5     Running   0          89s
metallb-frr-k8s-statuscleaner-8bf664555-kqh79   1/1     Running   0          89s
metallb-speaker-26whl                           1/1     Running   0          89s
[exit 0 at 10:21:48Z]
```

frr-k8s wrote its `caBundle` 20 seconds after the apply and the MetalLB
controller wrote its six after 40 seconds. The controller also filled the
`caBundle` of the conversion webhook in the CRD `bgppeers.metallb.io`.

```
$ for w in metallb-webhook-configuration frr-k8s-validating-webhook-configuration; do kubectl get validatingwebhookconfiguration $w --show-managed-fields -o json | jq -r ".metadata.managedFields[] | \"\(.manager) \(.o...
kubectl-client-side-apply Update 2026-10-11T10:20:19Z
MetalLB Update 2026-10-11T10:20:59Z
kubectl-client-side-apply Update 2026-10-11T10:20:19Z
frr-k8s Update 2026-10-11T10:20:39Z
CRD bgppeers.metallb.io conversion caBundle length 1500
[exit 0 at 10:21:48Z]
```

These webhooks reject a request when they cannot be reached. A good
IPAddressPool passed, and a bad one was refused by the webhook by name.

```
$ printf "apiVersion: metallb.io/v1beta1\nkind: IPAddressPool\nmetadata:\n  name: probe\n  namespace: metallb-system\nspec:\n  addresses:\n    - 192.0.2.10-192.0.2.20\n" | kubectl apply --dry-run=server -f -
ipaddresspool.metallb.io/probe created (server dry run)
[exit 0 at 10:21:49Z]

$ printf "apiVersion: metallb.io/v1beta1\nkind: IPAddressPool\nmetadata:\n  name: probe\n  namespace: metallb-system\nspec:\n  addresses:\n    - not-an-address\n" | kubectl apply --dry-run=server -f -
Error from server (Forbidden): error when creating "STDIN": admission webhook "ipaddresspoolvalidationwebhook.metallb.io" denied the request: parsing address pool probe: invalid CIDR "not-an-address" in pool "probe": ...
[exit 1 at 10:21:49Z]

$ kind delete cluster --name cwtest-1011-read-7 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-7" ...
Deleted nodes: ["cwtest-1011-read-7-control-plane"]
[exit 0 at 10:21:51Z]
```

## Run 10. ingress-nginx 4.15.1, base `admission-disabled`

The reading says no hook applies to this base. The witness file lists the
chart's 8 hooks, and all 8 are files under
`templates/admission-webhooks/job-patch/`. They make and install the
certificate of the admission webhook. This base sets
`controller.admissionWebhooks.enabled: false`. Its file holds no webhook
configuration, and the controller's arguments hold no `--validating-webhook`
flag.

```
$ kind create cluster --name cwtest-1011-read-8 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Have a question, bug, or feature request? Let us know! https://kind.sigs.k8s.io/#community 🙂
NAME                               STATUS   ROLES           AGE   VERSION
cwtest-1011-read-8-control-plane   Ready    control-plane   46s   v1.35.0
[exit 0 at 10:24:07Z]

$ /bin/bash "$SITE/sh/ingress-nginx-ingress-nginx-4-15-1/admission-disabled/try-objects.sh" 2>&1 | tail -6; echo "script exit: ${PIPESTATUS[0]}"
>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Lifecycle route for the packaged chart's 8 non-test hook occurrence(s). The hook phases are post-install and post-upgrade, and pre-install and pre-upgrade.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:24:07Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/ingress-nginx-ingress-nginx-4-15-1/admission-disabled/try-objects.sh" 2>&1 | tail -22; echo "script exit: ${PIPESTATUS[0]}"
kind-cwtest-1011-read-8

>> Create the ingress-nginx namespace if it does not exist
namespace/ingress-nginx created

>> Apply the 9 objects
serviceaccount/ingress-nginx created
configmap/ingress-nginx-controller created
clusterrole.rbac.authorization.k8s.io/ingress-nginx created
clusterrolebinding.rbac.authorization.k8s.io/ingress-nginx created
role.rbac.authorization.k8s.io/ingress-nginx created
rolebinding.rbac.authorization.k8s.io/ingress-nginx created
service/ingress-nginx-controller created
deployment.apps/ingress-nginx-controller created
ingressclass.networking.k8s.io/nginx created

>> Done. kubectl applied the 9 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Lifecycle route for the packaged chart's 8 non-test hook occurrence(s). The hook phases are post-install and post-upgrade, and pre-install and pre-upgrade.
script exit: 0
[exit 0 at 10:24:11Z]

$ kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=300s; kubectl -n ingress-nginx get pods,svc
Waiting for deployment "ingress-nginx-controller" rollout to finish: 0 of 1 updated replicas are available...
deployment "ingress-nginx-controller" successfully rolled out
NAME                                            READY   STATUS    RESTARTS   AGE
pod/ingress-nginx-controller-5486dbd97f-dphbb   1/1     Running   0          47s

NAME                               TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)                      AGE
service/ingress-nginx-controller   LoadBalancer   10.96.50.109   <pending>     80:32405/TCP,443:31763/TCP   48s
[exit 0 at 10:24:58Z]

$ kubectl get validatingwebhookconfiguration,mutatingwebhookconfiguration 2>&1; kubectl get jobs -A 2>&1; kubectl -n ingress-nginx get secrets 2>&1
No resources found
No resources found
No resources found in ingress-nginx namespace.
[exit 0 at 10:24:59Z]
```

The controller was ready. The cluster held no webhook configuration, no Job
and no Secret in the namespace, so there was nothing for a hook to make or to
patch. The Service is of type LoadBalancer and a local cluster has no load
balancer, so its external address stayed pending. That is the cluster's limit
and not a missing step.

The API server accepted an Ingress with no admission webhook in the way, and
the controller picked it up. Its last line is about the test Ingress, which
points at a Service that does not exist.

```
$ kubectl -n default create ingress probe --class=nginx --rule="probe.example.com/*=probe:80" && sleep 5 && kubectl -n ingress-nginx logs deployment/ingress-nginx-controller | grep -E "probe|admission|error" | tail -5...
ingress.networking.k8s.io/probe created
I1011 10:24:59.288170      11 store.go:443] "Found valid IngressClass" ingress="default/probe" ingressclass="nginx"
I1011 10:24:59.290768      11 event.go:377] Event(v1.ObjectReference{Kind:"Ingress", Namespace:"default", Name:"probe", UID:"550dc52a-c0f0-49f6-a907-88a1d4c049d7", APIVersion:"networking.k8s.io/v1", ResourceVersion:"622"
W1011 10:25:01.407787      11 controller.go:1135] Error obtaining Endpoints for Service "default/probe": no object matching key "default/probe" in local store
[exit 0 at 10:25:04Z]
```

## Run 11. ingress-nginx 4.15.1, base `internal-clusterip`

This run used the cluster of run 10. The walk deleted the test Ingress, the 9
objects of the first base and the namespace. The last part of that command was
written wrongly and printed an error, which is listed under what went wrong.

```
$ kubectl -n default delete ingress probe; kubectl delete -f ./ingress-nginx-ingress-nginx-4-15-1-admission-disabled-objects/objects.yaml 2>&1 | grep -c deleted; kubectl delete namespace ingress-nginx; kubectl get ns ...
ingress.networking.k8s.io "probe" deleted from default namespace
9
namespace "ingress-nginx" deleted
Error from server (NotFound): namespaces "ingress-nginx" not found
error: arguments in resource/name form must have a single resource and name
[exit 0 at 10:28:00Z]

$ /bin/bash "$SITE/sh/ingress-nginx-ingress-nginx-4-15-1/internal-clusterip/try-objects.sh" 2>&1 | tail -6; echo "script exit: ${PIPESTATUS[0]}"
>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Lifecycle route for the packaged chart's 8 non-test hook occurrence(s). The hook phases are post-install and post-upgrade, and pre-install and pre-upgrade.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:28:00Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/ingress-nginx-ingress-nginx-4-15-1/internal-clusterip/try-objects.sh" 2>&1 | tail -9; echo "script exit: ${PIPESTATUS[0]}"
deployment.apps/ingress-nginx-controller created
ingressclass.networking.k8s.io/nginx created

>> Done. kubectl applied the 9 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Lifecycle route for the packaged chart's 8 non-test hook occurrence(s). The hook phases are post-install and post-upgrade, and pre-install and pre-upgrade.
script exit: 0
[exit 0 at 10:28:01Z]

$ kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=300s; kubectl -n ingress-nginx get pods,svc
Waiting for deployment "ingress-nginx-controller" rollout to finish: 0 out of 1 new replicas have been updated...
Waiting for deployment "ingress-nginx-controller" rollout to finish: 0 of 1 updated replicas are available...
deployment "ingress-nginx-controller" successfully rolled out
NAME                                            READY   STATUS    RESTARTS   AGE
pod/ingress-nginx-controller-5486dbd97f-xl4rc   1/1     Running   0          15s

NAME                               TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
service/ingress-nginx-controller   ClusterIP   10.96.248.237   <none>        80/TCP,443/TCP   15s
[exit 0 at 10:28:16Z]

$ kubectl get validatingwebhookconfiguration,mutatingwebhookconfiguration 2>&1; kubectl get jobs -A 2>&1; kubectl -n ingress-nginx get secrets 2>&1
No resources found
No resources found
No resources found in ingress-nginx namespace.
[exit 0 at 10:28:16Z]

$ kubectl -n default create ingress probe --class=nginx --rule="probe.example.com/*=probe:80" && sleep 5 && kubectl -n ingress-nginx logs deployment/ingress-nginx-controller | grep -E "probe|admission|error" | tail -3...
ingress.networking.k8s.io/probe created
I1011 10:28:16.773608      11 store.go:443] "Found valid IngressClass" ingress="default/probe" ingressclass="nginx"
I1011 10:28:16.780412      11 event.go:377] Event(v1.ObjectReference{Kind:"Ingress", Namespace:"default", Name:"probe", UID:"a75e5f38-769d-4fba-9ae1-51938d73f98a", APIVersion:"networking.k8s.io/v1", ResourceVersion:"952"
W1011 10:28:20.005279      11 controller.go:1135] Error obtaining Endpoints for Service "default/probe": no object matching key "default/probe" in local store
[exit 0 at 10:28:22Z]

$ kind delete cluster --name cwtest-1011-read-8 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-8" ...
Deleted nodes: ["cwtest-1011-read-8-control-plane"]
[exit 0 at 10:28:26Z]
```

## Run 12. Secrets Store CSI Driver 1.6.0, base `sync-secret-rotation`

The reading is unknown, so the record still says this step was not run. The
witness file lists the chart's 10 hooks. Five are
lines of `templates/crds-upgrade-hook.yaml` and five are lines of
`templates/keep-crds-upgrade-hook.yaml`, due before an install or an upgrade.
The names say they are about CRDs. This repository does not hold those two
files, so the walk cannot say what the hooks run, and the step stays as it
was. What the walk can say is what happened without them.

```
$ kind create cluster --name cwtest-1011-read-9 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Have a question, bug, or feature request? Let us know! https://kind.sigs.k8s.io/#community 🙂
NAME                               STATUS   ROLES           AGE   VERSION
cwtest-1011-read-9-control-plane   Ready    control-plane   27s   v1.35.0
[exit 0 at 10:29:21Z]

$ /bin/bash "$SITE/sh/secrets-store-csi-driver-secrets-store-csi-driver-1-6-0/sync-secret-rotation/try-objects.sh" 2>&1 | tail -6; echo "script exit: ${PIPESTATUS[0]}"
>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Lifecycle route for the packaged chart's 10 non-test hook occurrence(s). The hook phases are pre-install and pre-upgrade.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
[exit 0 at 10:29:21Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/secrets-store-csi-driver-secrets-store-csi-driver-1-6-0/sync-secret-rotation/try-objects.sh" 2>&1 | tail -26; echo "script exit: ${PIPESTATUS[0]}"
>> Check the 2 CRDs this file holds

>> A CRD is missing, so apply the file's CRDs first
customresourcedefinition.apiextensions.k8s.io/secretproviderclasses.secrets-store.csi.x-k8s.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/secretproviderclasspodstatuses.secrets-store.csi.x-k8s.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/secretproviderclasses.secrets-store.csi.x-k8s.io condition met
customresourcedefinition.apiextensions.k8s.io/secretproviderclasspodstatuses.secrets-store.csi.x-k8s.io condition met

>> Apply the other 10 objects
serviceaccount/secrets-store-csi-driver created
clusterrole.rbac.authorization.k8s.io/secretproviderclasses-admin-role created
clusterrole.rbac.authorization.k8s.io/secretproviderclasses-viewer-role created
clusterrole.rbac.authorization.k8s.io/secretproviderclasspodstatuses-viewer-role created
clusterrole.rbac.authorization.k8s.io/secretprovidersyncing-role created
clusterrole.rbac.authorization.k8s.io/secretproviderclasses-role created
clusterrolebinding.rbac.authorization.k8s.io/secretprovidersyncing-rolebinding created
clusterrolebinding.rbac.authorization.k8s.io/secretproviderclasses-rolebinding created
daemonset.apps/secrets-store-csi-driver created
csidriver.storage.k8s.io/secrets-store.csi.k8s.io created

>> Done. The 2 CRDs were applied first. kubectl applied the other 10 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Lifecycle route for the packaged chart's 10 non-test hook occurrence(s). The hook phases are pre-install and pre-upgrade.
script exit: 0
[exit 0 at 10:29:24Z]
```

The retained file holds both CRDs, and the script applied them first. The
driver became ready with all three containers. No Job existed. Both CRDs were
established, and the API server accepted a SecretProviderClass.

```
$ kubectl -n kube-system rollout status daemonset/secrets-store-csi-driver --timeout=300s; kubectl -n kube-system get pods -l app=secrets-store-csi-driver
Waiting for daemon set "secrets-store-csi-driver" rollout to finish: 0 out of 1 new pods have been updated...
Waiting for daemon set "secrets-store-csi-driver" rollout to finish: 0 of 1 updated pods are available...
daemon set "secrets-store-csi-driver" successfully rolled out
NAME                             READY   STATUS    RESTARTS   AGE
secrets-store-csi-driver-99s8s   3/3     Running   0          18s
[exit 0 at 10:29:42Z]

$ kubectl get crd secretproviderclasses.secrets-store.csi.x-k8s.io secretproviderclasspodstatuses.secrets-store.csi.x-k8s.io -o json | jq -r ".items[] | \"\(.metadata.name) established=\(.status.conditions[] | select(...
secretproviderclasses.secrets-store.csi.x-k8s.io established=True annotations=controller-gen.kubebuilder.io/version
secretproviderclasspodstatuses.secrets-store.csi.x-k8s.io established=True annotations=controller-gen.kubebuilder.io/version
NAME                       ATTACHREQUIRED   PODINFOONMOUNT   STORAGECAPACITY   TOKENREQUESTS   REQUIRESREPUBLISH   MODES       AGE
secrets-store.csi.k8s.io   false            true             false             <unset>         true                Ephemeral   18s
No resources found
[exit 0 at 10:29:42Z]

$ printf "apiVersion: secrets-store.csi.x-k8s.io/v1\nkind: SecretProviderClass\nmetadata:\n  name: probe\n  namespace: default\nspec:\n  provider: probe\n" | kubectl apply -f - && kubectl -n default get secretprovider...
secretproviderclass.secrets-store.csi.x-k8s.io/probe created
NAME    AGE
probe   0s
[exit 0 at 10:29:43Z]

$ kind delete cluster --name cwtest-1011-read-9 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-9" ...
Deleted nodes: ["cwtest-1011-read-9-control-plane"]
[exit 0 at 10:29:46Z]
```

## Run 13. Three scripts as they stand after the readings were recorded

The readings changed what the test scripts do. This run used a new cluster and
the scripts as they are generated now. None was given `REQUIREMENTS_READY=1`.

The cert-manager script still stops, now for one step and not two. The step is
the hooks step, which keeps its place because its reading is that a hook Job
does it. The script prints the reading, and it applied nothing.

```
$ kind create cluster --name cwtest-1011-read-10 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Have a nice day! 👋
NAME                                STATUS   ROLES           AGE   VERSION
cwtest-1011-read-10-control-plane   Ready    control-plane   23s   v1.35.0
[exit 0 at 10:43:32Z]

$ /bin/bash "$SITE/sh/jetstack-cert-manager-v1-20-2/crds-enabled/try-objects.sh" 2>&1 | tail -7; echo "script exit: ${PIPESTATUS[0]}"; kubectl get ns cert-manager 2>&1; kubectl get crd 2>&1

>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Lifecycle route for the packaged chart's 3 non-test hook occurrence(s). The chart's hooks all belong to one Job that only checks the cert-manager API after an install, and the retained file leaves it out, so check...
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
script exit: 1
Error from server (NotFound): namespaces "cert-manager" not found
No resources found
[exit 0 at 10:43:33Z]
```

The CloudNativePG script no longer stops. It applied the objects and listed
the webhook certificate step, with its reading, among the steps it does not
run. The operator filled every `caBundle` as it did in run 1.

```
$ /bin/bash "$SITE/sh/cloudnative-pg-cloudnative-pg-0-28-2/default/try-objects.sh" 2>&1 | tail -12; echo "script exit: ${PIPESTATUS[0]}"
service/cnpg-webhook-service created
deployment.apps/cloudnative-pg created
mutatingwebhookconfiguration.admissionregistration.k8s.io/cnpg-mutating-webhook-configuration created
validatingwebhookconfiguration.admissionregistration.k8s.io/cnpg-validating-webhook-configuration created

>> Done. The 10 CRDs were applied first. kubectl applied the other 11 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 2 steps of this entry's plan. The entry page says who runs each one.
   - Prune protection for the 10 keep-annotated object(s) this base renders.
   - Route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders. The CloudNativePG operator makes its own certificate after it starts and fills the caBundle of both webhook...
script exit: 0
[exit 0 at 10:43:37Z]

$ bash ./ca-wait.sh; kubectl -n default rollout status deployment/cloudnative-pg --timeout=180s
Every caBundle was filled 12 seconds after this check started (9 webhooks).
ValidatingWebhookConfiguration cnpg-validating-webhook-configuration: caBundle lengths 940 940 940 940 940
MutatingWebhookConfiguration cnpg-mutating-webhook-configuration: caBundle lengths 940 940 940 940
Waiting for deployment "cloudnative-pg" rollout to finish: 0 of 1 updated replicas are available...
deployment "cloudnative-pg" successfully rolled out
[exit 0 at 10:43:53Z]
```

The ingress-nginx script for the base `admission-disabled` no longer stops
either.

```
$ /bin/bash "$SITE/sh/ingress-nginx-ingress-nginx-4-15-1/admission-disabled/try-objects.sh" 2>&1 | tail -7; echo "script exit: ${PIPESTATUS[0]}"

>> Done. kubectl applied the 9 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Lifecycle route for the packaged chart's 8 non-test hook occurrence(s). All eight hooks belong to the admission webhook's certificate Jobs, and this base turns the admission webhook off, so no hook applies and yo...
script exit: 0
[exit 0 at 10:43:54Z]

$ kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=300s
Waiting for deployment "ingress-nginx-controller" rollout to finish: 0 of 1 updated replicas are available...
deployment "ingress-nginx-controller" successfully rolled out
[exit 0 at 10:44:21Z]

$ kind delete cluster --name cwtest-1011-read-10 --kubeconfig ./kubeconfig
Deleting cluster "cwtest-1011-read-10" ...
Deleted nodes: ["cwtest-1011-read-10-control-plane"]
[exit 0 at 10:44:24Z]
```

## What went wrong

- No generated script failed, and no image failed to pull.
- The first two script runs of run 1 were piped into `tail`, so the exit code under them is the pipeline's. The next command shows the script's own exit code, which was 1. Every later run prints the script's exit code on its own line.
- One of the walk's own checks was wrong. In run 1 it asked `jq` for the managed fields of an object, and `kubectl` leaves them out unless it is given `--show-managed-fields`. The command failed and was run again with the flag. The failed command is left out of this log.
- One probe proved nothing. In run 5 the walk scaled a Deployment to see a webhook answer, and those webhooks watch StatefulSets. The probe is left out of this log and the run says so.
- The last part of the clean-up command in run 11 was written wrongly. `kubectl get ingressclass,clusterrole/ingress-nginx` mixes two forms and printed an error. The count of 9 deleted objects above it is what shows the first base was removed.
- In run 6 `kubectl rollout status` does not work for the Vault StatefulSet. The walk waited for the Pod instead.

## What the walk did not cover

- This was one walk, on one machine, with one node per cluster. A base that asks for two replicas ran both on that one node.
- No run started from a cluster that held an older version of the same workload, so no upgrade was tested.
- The walk did not test what happens when a certificate that a workload made for itself comes up for renewal.
- The three ECK bases shared one cluster, and so did the two ingress-nginx bases. The walk removed one base's objects before it ran the next, and says so in each run.
- The `no-crds` base of the ECK operator ran on a cluster that already held the CRDs. It was not run on a cluster without them.
- The walk sent no request through the rollout-operator's webhooks and none through KEDA's.
- No hook Job ran. For cert-manager the walk did the hook's check by hand. For the Secrets Store CSI Driver the walk does not know what the hooks do, and it only shows that a first install started without them.
- The ingress-nginx Service of type LoadBalancer got no external address, because a local cluster has no load balancer. No traffic was sent through either controller.
- MetalLB was given no address pool and announced nothing.
- The walk checked that workloads started. It did not check that any of them did useful work beyond the probes shown.
- Linux was not tested.

## Clean-up

Every cluster was deleted in its run, and no cluster of this walk was left.

```
$ kind get clusters | grep cwtest-1011-read || echo "no cwtest-1011-read cluster is left"
no cwtest-1011-read cluster is left
[exit 0 at 10:44:35Z]
```

The SHA-256 of the machine's default kubeconfig was the same before and after
the walk.
