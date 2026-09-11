# Find the hook and CRD work before delivery

Separate ordinary desired-state objects from lifecycle work. Render a small hook
fixture without executing it, then preserve a refusal for an unsupported custom
resource API. Finish with an explicit delivery checklist and the local evidence
behind it. Nothing is installed or run on a cluster.

## Inspect a hook without running it

You need Git and Helm (`v4.1.4` is the checked version). From a pinned
`helm-expt` checkout at `ed7efffe485b582b41f8d48dc568c8b85492fb74`, create a fresh
output directory. The [upgrade setup](./workshop-upgrade-guide.md#set-up-the-pinned-inputs)
shows how to obtain that checkout. No registry or chart dependencies are needed.

```sh
mkdir lifecycle-review
helm template lifecycle tests/fixtures/hook-job-probe --namespace workshop > lifecycle-review/with-hooks.yaml
helm template lifecycle tests/fixtures/hook-job-probe --namespace workshop --no-hooks > lifecycle-review/without-hooks.yaml
```

Both should exit `0`. Read the files. The full render contains a ConfigMap and a
Job named `hook-job-probe-migration`. The Job declares:

```yaml
helm.sh/hook: post-install,post-upgrade
helm.sh/hook-weight: "1"
helm.sh/hook-delete-policy: before-hook-creation
```

The `--no-hooks` render contains only the ConfigMap. Rendering the Job did not
execute its container, and excluding it did not perform the migration. The
fixture is for learning lifecycle handling; it is not a production migration
package or a prescription for another chart.

If the Workshop plugin is installed using the pinned
[Adapt setup](./workshop-adapt-guide.md#prerequisites-and-setup), retain an object
comparison:

```sh
cub config diff lifecycle-review/with-hooks.yaml lifecycle-review/without-hooks.yaml --json --out lifecycle-review/hook-diff.json
```

Expected exit: `0`, with one removed Job and one unchanged ConfigMap. The Job
annotation describes Helm lifecycle behavior; it does not prove that an
alternative reconciler or plain apply will implement the same semantics.

## Check whether a custom resource API is served

For this part, return to the pinned `cub-workshop` checkout from the
[Compose setup](./workshop-compose-guide.md#prerequisites-and-setup). You need
Node.js and `cub`; the retained component cache requires no registry access.
Use a fresh workspace:

```sh
cub stack sandbox stacks/kubara-gitops-shop.yaml --workspace lifecycle-platform
cp -R lifecycle-platform lifecycle-incompatible
```

The first command should exit `0` with 184 objects. In
`lifecycle-incompatible/components/06-shop-web.yaml`, change only the
ExternalSecret API from `external-secrets.io/v1` to
`external-secrets.io/v1beta1`. Then save the check result:

```sh
cub stack certify lifecycle-incompatible/stack.yaml --json > lifecycle-incompatible/refusal.json
```

Expected exit: `1`, with `certified: false`: the bundled CRD serves `v1`, not
that incompatible version. Preserve the workspace and refusal. The original
workspace remains your unchanged comparison point. Use the
[Compose recovery steps](./workshop-compose-guide.md#preserve-an-incompatible-candidate)
to restore the supported API in a separate copy.

This static check is useful, but does not establish that a real cluster has the
CRD, its controller, working webhooks, secrets or external-provider access.
Serving an API also does not establish that schema/data migrations are safe.

## Finish the lifecycle checklist

Write `lifecycle-review/review.md` and retain the hook comparison plus a pointer
to your CRD refusal workspace. Record each item as observed, required or not-run:

| Question | Evidence or next requirement |
| --- | --- |
| Which objects are ordinary desired state? | The retained ConfigMap; removing the hook leaves it unchanged. |
| What action does the hook request, and when? | The retained Job annotations and command; execution remains not-run. |
| Who executes the action and observes completion? | Must be selected for the real delivery route; do not assume Helm, Argo, Flux or plain apply are interchangeable. |
| What is the failure/retry policy? | Review Job behavior, idempotence, timeout and deletion policy; do not infer data-safe reruns from a successful render. |
| What must exist before a custom resource? | The served CRD/API and the selected controller, admission and external prerequisites. Real target checks remain not-run. |
| What permits promotion? | Successful required checks plus the authorized approval; this local checklist grants neither. |
| What permits rollback? | A prior good revision and evidence for API/data compatibility and successful reversal, not just restoring YAML. |

Do not delete an inconvenient hook, invent a completed Job, or substitute a
served API without preserving the failed candidate and understanding its source.
If a command fails before the expected outcome, keep its error and stop rather
than advancing to delivery.

## A task for an assistant

Start in the prepared `helm-expt` checkout with normal approvals:

```text
Render the pinned hook-job-probe chart with and without hooks into fresh files.
Use cub config diff to retain the removed Job and unchanged ConfigMap. Inspect
its hook, weight and deletion-policy annotations and container command. Explain
why none of this executes the hook. Write a review checklist covering the
executor, ordering, failure/retry, target prerequisites, approval and rollback.
For the CRD part, follow the linked local Compose/API-refusal exercise using the
pinned cub-workshop checkout and a fresh workspace. Keep the incompatible copy
and the exit-1 certified:false result. Do not contact a cluster, execute a Job,
read credentials, publish, apply or approve a change. Distinguish static served
API compatibility from target/controller readiness and data migration safety.
```

The outcome is source fixtures → retained manifests/comparisons/refusal → local
review. ConfigHub representation is not created; delivery, observation and live
rollback are not run. The next edit belongs to the authored chart or maintained
lifecycle route under its owner. See [chart hooks](./chart-hooks-what-happens.md)
for the broader model and [upgrade review](./workshop-upgrade-guide.md) to combine
this checklist with an exact candidate diff.
