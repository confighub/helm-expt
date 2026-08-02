# Change an OCI package without ConfigHub

**UNOFFICIAL/EXPERIMENTAL.**

Use this path when you already have an OCI package containing Kubernetes
objects and need to make a small, reviewable change. You do not need a
ConfigHub account, ConfigHub Server, or a Kubernetes cluster.

The command pulls the package, changes one named field, runs checks, and writes
a new local OCI image. It records the input digest, the old and new values, and
the check results inside the output image. It then pulls the new image back and
compares the objects and records.

This is useful before ConfigHub as well as beside it. A team can run the command
locally or in CI, inspect the result, and decide later whether to publish the
image, upload it to ConfigHub, or deploy it with an existing controller.

## Before you change it

First identify what the OCI contains:

```sh
npm run oci:inspect -- oci://REGISTRY/REPOSITORY:TAG
```

The [OCI inspection guide](./inspect-oci-package.md) explains the package roles.
`oci:transform` accepts a literal Kubernetes configuration OCI. A Helm source
chart or cub installer package must be rendered first.

## Change one field

This tested example starts with five reviewed NGINX objects and changes the
Deployment from three replicas to four:

```sh
npm run oci:transform -- \
  oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/byo-nginx-ai-values@sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683 \
  --object Deployment/nginx \
  --namespace nginx \
  --field spec.replicas \
  --value 4 \
  --output oci-layout:./nginx-replicas-4:reviewed
```

Anonymous registry access is the default. The command gives ORAS an empty
credential file. Use `--registry-config FILE` only when the input is private.

`--value` accepts JSON values. Numbers, booleans, strings, arrays, and objects
are supported. The field must already exist. The command will not silently add
an unknown path, add or remove Kubernetes objects, or change more than the one
field you named.

## What the output contains

The new OCI image has four readable files:

| File | Purpose |
| --- | --- |
| `manifests/release-objects.yaml` | The complete changed Kubernetes object set. |
| `records/source.json` | The input reference, resolved digest, object hash, and any context you supplied. |
| `records/change.json` | The object, field, old value, new value, and before/after object hashes. |
| `records/checks.json` | The decision and every pass, warning, or failure. |

If the input already contains companion records, they are retained under
`records/input/`. A second change therefore keeps the records from the first
change instead of replacing them.

The current checks reject malformed objects, duplicate object identities,
obvious placeholder values, and a change that affects anything outside the
named field. They also report unpinned container images, missing probes, and
external Secret references. CRDs, Jobs, and Helm hook annotations produce a
lifecycle warning so that install order and execution still receive a separate
review.

The NGINX example passes with one warning because the target must provide the
`nginx/ai-provider-credentials` Secret. The warning is stored in the output
image.

## What happens next

The command creates a local OCI image layout. It does not publish or deploy it.
From there you can:

- inspect the changed YAML and records;
- push the image to a registry with an authenticated tool;
- upload the literal configuration to ConfigHub as a base variant;
- give a compatible deployment bundle to Argo CD or Flux; or
- discard it and leave the input unchanged.

These are separate actions because they have different permissions and
consequences.

## Proof and limits

The [anonymous OCI-to-OCI receipt](../../data/anonymous-oci-transform-proof/summary.md)
records the public input digest, exact replica change, check results, output
digest, and pull-back comparison.

That reviewed output is also published as a permanent public example:

```text
oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/nginx-replicas-4@sha256:aa58e2a9d120d09f029fdef80596225f8c44d0aa629b18766fe8b6694659f518
```

Read the [publication and ConfigHub import summary](../../data/literal-config-examples/summary.md)
for the recorded digest, anonymous pull-back, companion-record checks, and
exact ConfigHub object comparison. A separate GitHub Actions job repeats the
public source pull with no ConfigHub credentials.

Direct ConfigHub import of an OCI with companion JSON records needs the fix in
[confighub/sdk PR #11](https://github.com/confighub/sdk/pull/11). The fix is
included in cub v0.2.6 and later. Run `cub upgrade` before importing this OCI
with an older client.

The proof does not claim cluster admission, controller reconciliation, workload
health, or a signed provenance chain. Your own command still creates a local OCI
layout until you publish it deliberately.
