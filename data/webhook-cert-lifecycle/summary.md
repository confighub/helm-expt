# Webhook Certificate Lifecycle Evidence

This generated report records local live rows that passed only after explicit
webhook serving certificate material was staged before apply. These rows prove a
route for replacing hidden chart lifecycle side effects with declared target or
generated facts. They do not claim production certificate management.

## Snapshot

~~~text
staged certificate routes: 5
passing observations:     5
routes with staged CRDs:  2
~~~

## Rows

| Chart | Base | Route | Staged Secret | Staged CRDs | Observation | Receipt |
| --- | --- | --- | --- | ---: | --- | --- |
| `ingress-nginx/ingress-nginx@4.15.1` | default | `generated-fact-staged-secret` | `ingress-nginx/ingress-nginx-admission` | 0 | [observation](../../runs/next80-local-kind/ingress-nginx-ingress-nginx-4.15.1-default/observation-receipt.yaml) | [staging receipt](./receipts/ingress-nginx-ingress-nginx-4.15.1-default.yaml) |
| `fairwinds-stable/vpa@4.11.0` | default | `generated-fact-staged-secret` | `default/vpa-tls-secret` | 0 | [observation](../../runs/next80-local-kind/fairwinds-stable-vpa-4.11.0-default/observation-receipt.yaml) | [staging receipt](./receipts/fairwinds-stable-vpa-4.11.0-default.yaml) |
| `prometheus-community/kube-prometheus-stack@86.1.0` | default | `generated-fact-staged-secret` | `monitoring/kube-prometheus-stack-admission` | 0 | [observation](../../runs/next80-local-kind/prometheus-community-kube-prometheus-stack-86.1.0-default/observation-receipt.yaml) | [staging receipt](./receipts/prometheus-community-kube-prometheus-stack-86.1.0-default.yaml) |
| `prometheus-community/kube-prometheus-stack@86.1.0` | no-crds | `target-facts-staged-crds-and-secret` | `monitoring/kube-prometheus-stack-admission` | 10 | [observation](../../runs/next80-local-kind/prometheus-community-kube-prometheus-stack-86.1.0-no-crds/observation-receipt.yaml) | [staging receipt](./receipts/prometheus-community-kube-prometheus-stack-86.1.0-no-crds.yaml) |
| `prometheus-community/kube-prometheus-stack@85.3.3` | no-crds | `target-facts-staged-crds-and-secret` | `monitoring/kube-prometheus-stack-admission` | 10 | [observation](../../runs/next80-local-kind/prometheus-community-kube-prometheus-stack-85.3.3-no-crds/observation-receipt.yaml) | [staging receipt](./receipts/prometheus-community-kube-prometheus-stack-85.3.3-no-crds.yaml) |

## What This Proves

The live Kubernetes workload can converge when the webhook serving certificate
is represented as explicit prerequisite material instead of an implicit Helm
hook or controller side effect. For no-CRDs bases, the route also proves the
declared CRDs can be staged before applying the config-only rendered objects.

## What This Does Not Prove

These receipts do not prove production CA trust, admission policy safety,
certificate rotation, or long-term serving certificate management. Production
support still needs a target-scoped decision for how the Secret is created,
owned, rotated, and audited. No-CRDs rows also need a target-scoped CRD
ownership and upgrade policy.

Machine-readable files:

~~~text
data/webhook-cert-lifecycle/evidence.csv
data/webhook-cert-lifecycle/receipts/*.yaml
~~~

Regenerate and verify:

~~~sh
npm run webhook-cert:lifecycle
npm run webhook-cert:lifecycle:verify
~~~
