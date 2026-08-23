# Cross-format processing model

Use this model whenever a source must be transformed, its behavior extends
beyond literal Kubernetes objects, or a destination can change the result.

## Shared stages

1. **Source and intent:** identify the source bytes, version, digest, user
   choices, and declared target assumptions.
2. **Materialize exact Kubernetes objects:** this operation may be a
   render, build, composition, generation, or recorded no-op.
3. **Decide flattening:** decide whether exact objects can replace later source
   processing, whether lifecycle routes must travel with them, or whether
   processing must wait for destination facts.
4. **Record lifecycle work:** identify prerequisites, hooks, CRD ordering,
   tests, waits, certificates, setup Jobs, runtime queries, and generated facts.
5. **Resolve routes:** select the actor and mechanism for lifecycle work for
   the chosen variant, destination, and delivery runtime.
6. **Classify ownership:** say which fields are source-controlled,
   variant-controlled, destination-supplied, or delivery-protected.
7. **Retain and vary:** keep the reviewed base, then derive environment,
   region, customer, or target variants.
8. **Publish, deliver, and observe:** publish an exact OCI when useful, let the
   chosen controller deliver it, and compare desired configuration with the
   observed result.

Route resolution is repeatable. Run it again after a lifecycle-sensitive
variant change, destination assignment, or delivery-runtime change.

## Source mapping

| Source | Materialization | Target-sensitive cases | Lifecycle work to retain |
| --- | --- | --- | --- |
| Helm | Render chart plus values and release context | `lookup`, capabilities, generated values, install-time APIs | Hooks, CRDs, tests, setup Jobs, certificates, required Secrets |
| cub installer | Select a packaged base and render it | Package target facts and user-supplied setup | Recorded prerequisites, setup checks, and base-specific routes |
| Timoni | Build a module or bundle | Runtime cluster queries and cluster-group values | Ordered apply sets, action annotations, waits, tests, health checks, prune behavior |
| AICR | Select and compose a recipe into component configuration | Cloud, accelerator, model, registry, and destination choices | Component order, nested sources, infrastructure prerequisites, validation |
| Kubara | Select components and generate platform configuration | Platform topology, cluster roles, and environment overlays | Bootstrap, Git handoff, controller ownership, application ordering |
| Source OCI | Pull by digest, then run the declared processor | Depends on the packaged source and destination | The processor's lifecycle contract |
| Configuration OCI | Pull exact Kubernetes objects by digest | Admission and destination facts only | Declared prerequisites and delivery requirements |
| Kubernetes YAML | Parse and inventory exact objects | Admission and destination facts only | Declared prerequisites and delivery requirements |
| ConfigHub Units | Read the retained revision | Target, route, policy, and delivery selection | Apply gates, approvals, resolved routes, release and observation records |

## Flattening verdicts

- **Born flattened:** the source already contains exact Kubernetes objects.
- **Safe to flatten:** materialization is deterministic and no required behavior
  is lost when the exact objects are retained.
- **Flatten with routes:** retain the exact objects and explicit lifecycle work.
- **Unsafe to flatten:** materialization depends on target state or behavior
  that has no adequate route outside the original processor.
- **Not assessed:** do not infer safety.

OCI is transport, not a universal execution model. A source module OCI and a
literal configuration OCI can contain different material and require different
processors. Record the artifact role with its digest. Publishing a literal
configuration OCI does not execute its lifecycle routes. When the flattening
verdict is `flatten-with-routes`, resolve those routes for the selected delivery
runtime before asking a controller to reconcile the objects.
