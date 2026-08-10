# Anonymous OCI work in CI

This run checks that the public configuration tools can be used inside a CI job
without a ConfigHub account.

## Result

**PASS.** A GitHub Actions job with no ConfigHub credentials anonymously pulled the public NGINX installer package, rendered and inspected six Kubernetes objects, packaged them as OCI, and pulled back the same object set.

The job pulled bitnami/nginx@24.0.2 from `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2` at
`sha256:08947210de607a6b9b8e7b8423b024e3fe89a0fc2b09581f80e2401008e445a1`, selected the `http-clusterip` preset, and
rendered 6 Kubernetes objects:
`Deployment`, `Namespace`, `NetworkPolicy`, `PodDisruptionBudget`, `Service`, `ServiceAccount`.

It then packaged those reviewed files as a local OCI image layout. Pulling that
layout back produced the same object-set hash,
`1e7de3915db6173ff8e58022d8413ae87660c86fad8f1b4e33772526bd15cd74`. The output manifest digest was
`sha256:d10ce8d07f7b9b276fe5758557c947166ce4cd6a77fc513e32072516bdd79a20`.

## Where it ran

- Provider: GitHub Actions
- Workflow: Anonymous OCI CI proof
- Run: https://github.com/confighub/helm-expt/actions/runs/30222445913
- Commit: `24912e2e0b94da24d60dd7114098d213e79f2b6b`
- Installer source: `0b553b3c35bd629bad1784e07dfe0bc77af7432c`

## What this proves

This is the `OCI -> work -> OCI` shape running as a CI job. The work is
anonymous: the job had no ConfigHub token, account context, saved history,
variant, approval, or release.

The same public tools can also be used as `OCI -> work` when a job only needs
to inspect or test a package, or as `work -> OCI` when the starting point is a
repository rather than an existing OCI package.

## Limits

- The output is an OCI image layout uploaded as a GitHub Actions artifact, not a public registry package.
- This run uses no ConfigHub account, saved history, variant, approval, cluster, or delivery controller.
- A hosted public service that performs this work remains planned, not shipped.
- This NGINX preset has no Helm hooks or CRDs. Configurations with lifecycle work still need their recorded routes.
