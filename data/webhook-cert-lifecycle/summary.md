# Webhook Certificate Lifecycle Evidence

This generated report records local live rows that passed only after explicit
webhook serving certificate material was staged before apply. These rows prove a
route for replacing hidden chart lifecycle side effects with declared target or
generated facts. They do not claim production certificate management.

## Snapshot

~~~text
staged certificate routes: 2
passing observations:     2
~~~

## Rows

| Chart | Base | Route | Staged Secret | Observation | Receipt |
| --- | --- | --- | --- | --- | --- |
| `ingress-nginx/ingress-nginx@4.15.1` | default | `generated-fact-staged-secret` | `ingress-nginx/ingress-nginx-admission` | [observation](../../runs/next80-local-kind/ingress-nginx-ingress-nginx-4.15.1-default/observation-receipt.yaml) | [staging receipt](./receipts/ingress-nginx-ingress-nginx-4.15.1-default.yaml) |
| `fairwinds-stable/vpa@4.11.0` | default | `generated-fact-staged-secret` | `default/vpa-tls-secret` | [observation](../../runs/next80-local-kind/fairwinds-stable-vpa-4.11.0-default/observation-receipt.yaml) | [staging receipt](./receipts/fairwinds-stable-vpa-4.11.0-default.yaml) |

## What This Proves

The live Kubernetes workload can converge when the webhook serving certificate
is represented as explicit prerequisite material instead of an implicit Helm
hook or controller side effect.

## What This Does Not Prove

These receipts do not prove production CA trust, admission policy safety,
certificate rotation, or long-term serving certificate management. Production
support still needs a target-scoped decision for how the Secret is created,
owned, rotated, and audited.

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
