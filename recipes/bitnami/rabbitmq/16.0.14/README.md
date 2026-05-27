# bitnami/rabbitmq 16.0.14 Proof

This is the promoted proof slice for the RabbitMQ public Helm chart.

Variants:

- `generated-passwords`: RabbitMQ password and Erlang cookie bound as generated facts; image repository pinned to the still-pullable Bitnami legacy mirror with explicit image-substitution policy; 10 Helm objects, 11 cub install objects including Namespace.
- `existing-secret`: target Secrets supply RabbitMQ password and Erlang cookie; image repository pinned to the still-pullable Bitnami legacy mirror with explicit image-substitution policy; 9 Helm objects, 10 cub install objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub install setup`, plus the explained Namespace support object;
- default chart rendering is nondeterministic until generated credentials and the Erlang cookie are bound;
- the generated-passwords variant persists auth.password and auth.erlangCookie before render;
- the existing-secret variant uses declared target Secrets for both generated values and still renders only chart-owned configuration;
- generated fact, target fact, dependency lock, StatefulSet/PVC, clustering, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run rabbitmq:generate-proof
npm run rabbitmq:generate-package
npm run rabbitmq:verify-proof
npm run rabbitmq:verify-package
npm run rabbitmq:compare
```
