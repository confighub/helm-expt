# Anonymous OCI-to-OCI change

This test starts with a public OCI package containing five reviewed NGINX
objects. It pulls the package without registry credentials, changes the NGINX
Deployment from three replicas to four, runs checks, and writes a new local OCI
image layout. No ConfigHub account or server is involved.

## Result

**Passed with one warning.** With no ConfigHub account or server, the public five-object NGINX OCI was pulled at its recorded digest, changed only from three to four replicas, checked, rebuilt as a new OCI image layout, and pulled back to the reviewed object set.

| Item | Recorded result |
|---|---|
| Input | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/byo-nginx-ai-values@sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683` |
| Input objects | 5 at `ded2b7c2624c74ae1dce2a947ad9d99a32a62f5114361970af61c9ca51449345` |
| Change | `Deployment/nginx spec.replicas`: 3 to 4 |
| Output OCI | `sha256:aa58e2a9d120d09f029fdef80596225f8c44d0aa629b18766fe8b6694659f518` |
| Output objects | 5 at `b39636429c375b7c458b1b2cc844a00479aee23cb7442daa3342c79562179340` |
| Pull-back comparison | pass |

## Checks

| Check | Result | What it found |
|---|---|---|
| `kubernetes-object-shape` | pass | 5 object(s) have apiVersion, kind, and metadata.name. |
| `unique-object-identities` | pass | Object identities are unique. |
| `no-obvious-placeholders` | pass | No common unfinished-value markers were found. |
| `digest-pinned-images` | pass | 2 container image(s) are pinned by digest. |
| `workload-probes` | pass | Every workload container declares liveness and readiness probes. |
| `external-secret-references` | warn | Create or otherwise supply these Secrets before deployment: nginx/ai-provider-credentials. |
| `lifecycle-work` | pass | No CRDs, Jobs, or Helm hook annotations were found. |
| `exact-change-scope` | pass | Only Deployment/nginx spec.replicas changed. |

The external Secret warning is expected. The package refers to
`nginx/ai-provider-credentials`, so that Secret must be supplied before
deployment. The warning stays with the output records.

## Repeat it

```bash
npm run oci:transform -- \
  oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/byo-nginx-ai-values@sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683 \
  --object Deployment/nginx \
  --namespace nginx \
  --field spec.replicas \
  --value 4 \
  --output oci-layout:./nginx-replicas-4:reviewed
```

The command writes Kubernetes YAML, a source record, the exact field change,
and the check results into the new OCI image. It then pulls the image back and
compares the objects and records.

## Evidence

- Receipt: [`runs/anonymous-oci-transform-proof/receipt.yaml`](../../runs/anonymous-oci-transform-proof/receipt.yaml)
- Reviewed Kubernetes YAML: [`examples/anonymous-oci-transform/reviewed-output/manifests/release-objects.yaml`](../../examples/anonymous-oci-transform/reviewed-output/manifests/release-objects.yaml)
- Source record: [`examples/anonymous-oci-transform/reviewed-output/records/source.json`](../../examples/anonymous-oci-transform/reviewed-output/records/source.json)
- Change record: [`examples/anonymous-oci-transform/reviewed-output/records/change.json`](../../examples/anonymous-oci-transform/reviewed-output/records/change.json)
- Check record: [`examples/anonymous-oci-transform/reviewed-output/records/checks.json`](../../examples/anonymous-oci-transform/reviewed-output/records/checks.json)
- OCI image index: [`examples/anonymous-oci-transform/output-layout/index.json`](../../examples/anonymous-oci-transform/output-layout/index.json)
- Input publication receipt: [`runs/byo-helm-values-proof/public-oci-receipt.yaml`](../../runs/byo-helm-values-proof/public-oci-receipt.yaml)

## Limits

- The output is a local OCI image layout. Publishing it to a registry is a separate authenticated action.
- The checks do not prove cluster admission, controller reconciliation, workload health, or provenance signatures.
- No ConfigHub command, account, server, Space, Unit, variant, approval, or release is used.

The output is committed as a local OCI image layout. Publishing it to a registry,
uploading it to ConfigHub, or deploying it to Kubernetes are separate actions.
