# Plain YAML and existing OCI examples

These two examples show that ConfigHub can start from exact Kubernetes objects.
Neither path rerenders Helm.

## Plain YAML

The [plain YAML fixture](../../examples/plain-yaml/acme-web/README.md) contains
one Namespace, ConfigMap, Deployment, and Service. ConfigHub stores one Unit per
object in the `plain-yaml-acme-web-base` Space.

The upload compared 4 stored objects with
the source files. Both object sets have hash
`963bf5420b78fbbfa43be7adbb1ced299edef0b2baf0f36850992a6bf66c1926`.

## Existing OCI

The existing-OCI example starts with the reviewed NGINX replica change:

`oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/nginx-replicas-4@sha256:aa58e2a9d120d09f029fdef80596225f8c44d0aa629b18766fe8b6694659f518`

The artifact is public and pulls without registry credentials. It contains five
Kubernetes objects plus the source, change, and check records from the original
review. ConfigHub imports the same five objects into the
`existing-oci-nginx-replicas-4` Space and records the OCI source and digest.

The direct companion-record import used
[confighub/sdk PR #11](https://github.com/confighub/sdk/pull/11), now merged at
`1e63db4bc767368203660579bfb0a282443c7505`. The fix ships in cub v0.2.6 and later.
Run `cub upgrade` before importing this OCI with an older client.

## What is proved

| Check | Plain YAML | Existing OCI |
| --- | --- | --- |
| Source objects stored unchanged | pass | pass |
| Helm rerender during upload | no | no |
| One README Unit in the demo Space | pass | pass |
| Catalog checks attached | pass | pass |
| Public anonymous OCI pull | n/a | pass |
| Kubernetes deployment | not run | not run |

## Evidence

- [Permanent public OCI receipt](../../runs/anonymous-oci-transform-proof/public-oci-receipt.yaml)
- [Plain YAML ConfigHub receipt](../../runs/literal-yaml-upload-proof/receipt.yaml)
- [Existing OCI ConfigHub receipt](../../runs/existing-oci-upload-proof/receipt.yaml)
- [Plain YAML Space guide](../helm-catalog-readmes/spaces/plain-yaml-acme-web-base/README.md)
- [Existing OCI Space guide](../helm-catalog-readmes/spaces/existing-oci-nginx-replicas-4/README.md)

These are entry examples. Promotion, release OCI, controller delivery, and live
observations begin after the reviewed configuration has been saved in
ConfigHub.
