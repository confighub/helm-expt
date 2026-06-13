# Secret Lifecycle

UNOFFICIAL/EXPERIMENTAL

Helm charts often mix application credentials and Kubernetes lifecycle state in
objects named `Secret`. The harness keeps those cases separate.

User or application credential material includes passwords, tokens, TLS keys,
object-store credentials, and existing Secret references. These belong in an
explicit Secret policy: rendered and separated by the installer package, staged
as target facts, or moved into an existing-Secret base.

Kubernetes lifecycle state includes webhook serving certificates,
service-account token Secrets, and controller-populated certificate material.
These need a lifecycle lane: stage the prerequisite, observe the controller, or
record that the base is not supported for that target shape.

The generated survey is:

```sh
npm run secrets:lifecycle
npm run secrets:lifecycle:verify
```

Read:

- [data/secret-lifecycle/summary.md](../../data/secret-lifecycle/summary.md)
- [data/secret-lifecycle/variant-summary.csv](../../data/secret-lifecycle/variant-summary.csv)
- [data/secret-lifecycle/secrets.csv](../../data/secret-lifecycle/secrets.csv)

Disposition meanings:

- `delivered`: the rendered artifact contains the Secret and the recipe or
  installer package records how it is handled.
- `staged`: the base requires a target Secret before apply.
- `observed`: committed lifecycle evidence records the Secret staging or
  controller behavior for that base.
- `needs-lane-support`: the Secret is visible, but the repo still needs a
  staging receipt, lifecycle observation, or explicit refusal before stronger
  live or production claims.
- `not-applicable`: the base has no rendered Secret and no required target
  Secret in the committed artifact index.
