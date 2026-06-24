# Secret Lifecycle Survey

Generated. Do not edit by hand.

This survey separates two kinds of Secret handling that Helm often mixes
together:

- user or application credential material, such as passwords, tokens, TLS keys,
  object-store credentials, and existing Secret references;
- Kubernetes lifecycle state, such as webhook serving certificates and
  service-account token Secrets.

The survey is built from committed top-100 artifact indexes, rendered object
sets, target facts, hook lifecycle receipts, and webhook certificate lifecycle
receipts. It does not run live lanes.

## Summary

~~~text
variants surveyed: 179
secret rows: 75
variant dispositions: not-applicable=126, delivered=21, staged=18, needs-lane-support=6, delivered-and-staged=4, observed=4
secret dispositions: delivered=31, staged=31, needs-lane-support=8, observed=5
secret roles: user-credential-material=36, kubernetes-lifecycle-state=25, secret-material-review=14
lifecycle secrets still needing lane support: 8
~~~

## Reading Rule

- `delivered` means the rendered artifact contains the Secret and the recipe or
  installer package records how it is handled.
- `staged` means the selected base requires a target Secret before apply.
- `observed` means committed lifecycle evidence records the Secret staging or
  controller behavior for that base.
- `needs-lane-support` means the Secret is visible, but the repo should add a
  staging receipt, lifecycle observation, or explicit refusal before stronger
  live or production claims.
- `not-applicable` means the base has no rendered Secret and no required target
  Secret in the committed artifact index.

## Lifecycle Secrets Needing Lane Support

| Chart | Base | Secret | Evidence |
| --- | --- | --- | --- |
| `crossplane-stable/crossplane@2.3.1` | `default` | `default/crossplane-root-ca` | [recipes/crossplane-stable/crossplane/2.3.1/revisions/default/r001/rendered/release-objects.yaml](../../recipes/crossplane-stable/crossplane/2.3.1/revisions/default/r001/rendered/release-objects.yaml) |
| `crossplane-stable/crossplane@2.3.1` | `default` | `default/crossplane-tls-client` | [recipes/crossplane-stable/crossplane/2.3.1/revisions/default/r001/rendered/release-objects.yaml](../../recipes/crossplane-stable/crossplane/2.3.1/revisions/default/r001/rendered/release-objects.yaml) |
| `crossplane-stable/crossplane@2.3.1` | `default` | `default/crossplane-tls-server` | [recipes/crossplane-stable/crossplane/2.3.1/revisions/default/r001/rendered/release-objects.yaml](../../recipes/crossplane-stable/crossplane/2.3.1/revisions/default/r001/rendered/release-objects.yaml) |
| `elastic/eck-operator@3.4.0` | `default` | `default/elastic-operator-webhook-cert` | [recipes/elastic/eck-operator/3.4.0/revisions/default/r001/rendered/release-objects.yaml](../../recipes/elastic/eck-operator/3.4.0/revisions/default/r001/rendered/release-objects.yaml) |
| `elastic/eck-operator@3.4.0` | `ha` | `default/elastic-operator-webhook-cert` | [recipes/elastic/eck-operator/3.4.0/revisions/ha/r001/rendered/release-objects.yaml](../../recipes/elastic/eck-operator/3.4.0/revisions/ha/r001/rendered/release-objects.yaml) |
| `elastic/eck-operator@3.4.0` | `no-crds` | `default/elastic-operator-webhook-cert` | [recipes/elastic/eck-operator/3.4.0/revisions/no-crds/r001/rendered/release-objects.yaml](../../recipes/elastic/eck-operator/3.4.0/revisions/no-crds/r001/rendered/release-objects.yaml) |
| `gatekeeper/gatekeeper@3.22.2` | `no-crds` | `default/gatekeeper-webhook-server-cert` | [recipes/gatekeeper/gatekeeper/3.22.2/revisions/no-crds/r001/rendered/release-objects.yaml](../../recipes/gatekeeper/gatekeeper/3.22.2/revisions/no-crds/r001/rendered/release-objects.yaml) |
| `hashicorp/consul@2.0.0` | `secure-mesh-existing-secrets` | `consul/consul-consul-auth-method` | [recipes/hashicorp/consul/2.0.0/revisions/secure-mesh-existing-secrets/r001/rendered/release-objects.yaml](../../recipes/hashicorp/consul/2.0.0/revisions/secure-mesh-existing-secrets/r001/rendered/release-objects.yaml) |

Machine-readable forms:

- [variant-summary.csv](./variant-summary.csv)
- [secrets.csv](./secrets.csv)

Regenerate:

~~~sh
npm run secrets:lifecycle
npm run secrets:lifecycle:verify
~~~
