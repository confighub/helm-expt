# Compose and review a local workshop stack

Use this guide to compose the retained Kubara GitOps shop stack, save the
materialized result, review one application change, and preserve a refusal for
an incompatible API version. The workflow is local and static. It does not
create ConfigHub records, contact Kubernetes, publish OCI, or deliver an app.

## Prerequisites and setup

You need Node.js, Git, and the `cub` CLI on your `PATH`. No ConfigHub
account or credentials are needed. GitHub access is needed for setup. The
shipped component selections use the plugin's receipt-verified cache, so these
steps need no registry access after setup. No cluster, Docker, Helm, or cloud
access is needed.

If you already completed setup for another Guide, return to that pinned
checkout and skip cloning and installation. Otherwise, start in a directory
that does not already contain `cub-workshop`:

```sh
git clone https://github.com/confighub/cub-workshop.git
cd cub-workshop
git checkout 56e261a87dc3b060a86474bc796d379dd9bb7f3d
cub plugin install "$PWD"
```

The checkout is the exact reviewed workshop source used below. The local plugin
installation is the command runtime; the stack manifest and its component
files remain ordinary local files.

## Save the baseline, move it, and resume it

Create a fresh directory and save the stack as an editable workspace:

```sh
mkdir compose-demo
cd compose-demo
cub stack sandbox ../stacks/kubara-gitops-shop.yaml --workspace ./platform
```

Expected exit code: `0`, with 184 objects. Target prerequisite warnings remain
unverified; static certification does not clear them. Keep `platform/result.json`, `platform/rendered.yaml`,
`platform/stack.yaml`, and every file under `platform/components/`. The saved
workspace is the materialized configuration and its review receipt; it is not a
ConfigHub Space.

Move the complete directory, then certify the moved manifest to demonstrate a
resume:

```sh
mv platform platform-moved
cub stack certify ./platform-moved/stack.yaml --json > ./platform-moved/resume.json
```

Expected exit code: `0`. Moving the whole directory preserves the component
files needed for continuation. Do not recreate only `stack.yaml`.

## Review one changed field

In `platform-moved/components/06-shop-web.yaml`, change only the `shop-web`
Deployment `spec.replicas` from `3` to `2`. Leave `platform-moved/rendered.yaml`
and the original `platform-moved/result.json` unchanged. Then certify and render
the candidate under new filenames:

```sh
cub stack certify ./platform-moved/stack.yaml --json > ./platform-moved/changed-result.json
cub stack sandbox ./platform-moved/stack.yaml --out ./platform-moved/changed.yaml
git diff --no-index ./platform-moved/rendered.yaml ./platform-moved/changed.yaml
```

The first two commands should exit `0`. `git diff --no-index` should exit `1`
because it found the intended difference. Inspect the diff: the meaningful
change is the replica count. A static certification result records the rendered
bytes and checks; it does not approve the change or show that the app runs.

## Preserve an incompatible candidate

First copy the changed workspace:

```sh
cp -R platform-moved incompatible
```

In `incompatible/components/06-shop-web.yaml`, change only the `ExternalSecret`
API version from `external-secrets.io/v1` to `external-secrets.io/v1beta1`.
Save the file, then run:

```sh
cub stack certify ./incompatible/stack.yaml --json > ./incompatible/refusal.json
```

Expected exit code: `1`, with `certified: false`. The bundled External Secrets
CRD serves `v1`, so the incompatible version is refused during certification;
it does not produce a changed materialized render. Keep
`incompatible/refusal.json` as evidence of the refusal.

To recover without erasing the failed attempt, make a separate copy:

```sh
cp -R incompatible recovered
```

In `recovered/components/06-shop-web.yaml`, restore only the ExternalSecret
API version to `external-secrets.io/v1`, then save a new check result:

```sh
cub stack certify ./recovered/stack.yaml --json > ./recovered/recovery.json
```

Expected exit code: `0`. Keep the original `incompatible/refusal.json` and
workspace alongside the recovered copy. This establishes static compatibility
again; it does not roll back or recover a running application.

If a command refuses, retain its JSON result and inspect the named component,
API version, and prerequisite finding before making a new copy. To repeat a
successful run, use a fresh workspace and fresh output names; existing saved
files are deliberately protected.

## A task for an AI assistant

Return to the pinned `cub-workshop` checkout root. Prepare a separate trial:

```sh
mkdir compose-ai
cd compose-ai
```

Open Claude Code or Codex in this directory and paste the task below. Use
your normal tool approvals; do not disable them. Keep the resulting files
and the assistant report together.

```text
Work in the current compose-ai directory; do not reuse another trial's files. Use the installed cub Workshop plugin and complete this local
static task. Save kubara-gitops-shop as a new editable workspace named platform,
retain its result.json and rendered.yaml, move the complete directory to
platform-moved, and resume by certifying platform-moved/stack.yaml. Change only
the shop-web Deployment replicas from 3 to 2 in
platform-moved/components/06-shop-web.yaml. Retain the unchanged baseline,
certify the candidate to changed-result.json, render changed.yaml, and inspect
the diff. Before editing the refusal case, copy platform-moved to a fresh
incompatible directory. In that copy, change only its ExternalSecret apiVersion
from external-secrets.io/v1 to external-secrets.io/v1beta1, certify it to
refusal.json, and preserve the expected refusal. Report exit codes, changed
field, result hashes, refusal reason, and unverified target prerequisites. Do
not contact a cluster, ConfigHub, registry, or credentials, and do not claim
ConfigHub creation, delivery, readiness, or application health.
```

The [retained stack manifest](https://github.com/confighub/cub-workshop/blob/56e261a87dc3b060a86474bc796d379dd9bb7f3d/stacks/kubara-gitops-shop.yaml)
and [Kubara app source](https://github.com/confighub/cub-workshop/blob/56e261a87dc3b060a86474bc796d379dd9bb7f3d/apps/shop-web-kubara.yaml)
define the local input. The result covers source resolution, static composition,
and local materialization. It does not check namespaces, an issuer, a secret
store, target availability, controller health, GitOps reconciliation, or the
application response. Continue with the [adapt guide](./workshop-adapt-guide.md)
for a field-level configuration review.
