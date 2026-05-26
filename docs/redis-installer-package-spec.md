# Redis Installer Package Spec

This spec defines the next executable Redis proof slice: turn the existing
Redis variant revisions into a real `cub install` package, then verify that the
package remains deterministic and Helm-equivalent.

This is not the old archived top-20 pathway. The package source is generated
from the current Redis proof revisions:

```text
recipes/bitnami/redis/25.5.3/revisions/*/r001/rendered/release-objects.yaml
```

The durable package source lives at:

```text
packages/bitnami/redis/25.5.3/
```

## Product Claim

For `bitnami/redis@25.5.3`, the current installer package must prove:

```text
correct variants
safe operations
immediate proof
```

The package contains two real installer bases:

```text
default
reuse-existing-secret
```

The current executable selection UX is:

```sh
cub install setup --pull packages/bitnami/redis/25.5.3 --base default --work-dir <work> --non-interactive --namespace redis
cub install setup --pull packages/bitnami/redis/25.5.3 --base reuse-existing-secret --work-dir <work> --non-interactive --namespace redis
```

## Required Files

```text
packages/bitnami/redis/25.5.3/
  installer.yaml
  README.md
  bases/default/kustomization.yaml
  bases/default/upstream.yaml
  bases/reuse-existing-secret/kustomization.yaml
  bases/reuse-existing-secret/upstream.yaml

recipes/bitnami/redis/25.5.3/publication/
  installer-package-receipt.yaml
```

## Required Invariants

1. `installer.yaml` declares a real installer `Package`.
2. The package name is `bitnami-redis` and version is `25.5.3`.
3. Exactly one base is default: `default`.
4. The `default` base points at the default Redis rendered object set.
5. The `reuse-existing-secret` base points at the existing-secret rendered
   object set.
6. `cub install package` produces byte-identical `.tgz` files across two local
   runs from the same source tree.
7. The package receipt records every package source file and SHA256.
8. The package receipt records the deterministic `.tgz` SHA256.
9. `cub install setup --base default` renders all 14 Helm Redis objects, plus
   only the installer namespace support object and one separated Secret.
10. `cub install setup --base reuse-existing-secret` renders all 13 Helm Redis
    objects, plus only the installer namespace support object and no separated
    Secret.
11. Every `cub install` difference from Helm is semantic-equivalent or
    explicitly classified as the namespace support object.
12. OCI publication is a real gated command, not a fake transcript. It runs only
    when a registry ref is supplied:

```sh
REDIS_INSTALLER_OCI_REF=oci://<registry>/<repo>:<tag> npm run redis:publish-package
```

## Proof Commands

```sh
npm run redis:generate-package
npm run redis:verify-package
npm run redis:compare
npm run verify
```

The default `npm run verify` must include `redis:verify-package`.

## Non-Scope For This Slice

This slice does not require a live ConfigHub OCI endpoint to be running. If a
registry ref and credentials are available, `npm run redis:publish-package`
must package, push, inspect, and write a publication receipt under `runs/`.
Without a registry ref, publication remains unrun rather than simulated.
