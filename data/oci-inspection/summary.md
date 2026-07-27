# Inspect existing OCI packages

Use one command to identify a supported OCI package, resolve its immutable digest,
and report what is actually inside it:

```sh
npm run oci:inspect -- OCI_REFERENCE
```

The command distinguishes source packages from literal Kubernetes configuration.
For a literal bundle it pulls the layers, parses the Kubernetes objects, counts CRDs,
hooks, Jobs, and Secrets, checks duplicate identities, and flags common unfinished
values. For a cub installer source package, add `--render` to select a preset config
and inspect the objects without applying them.

## Checked examples

| Example | Package kind | Objects | Result | Report |
| --- | --- | ---: | --- | --- |
| AICR literal Kubernetes configuration | literal Kubernetes configuration | 17 | pass | [JSON](./reports/aicr-literal-config.json) |
| Kubara literal Kubernetes configuration | literal Kubernetes configuration | 77 | pass | [JSON](./reports/kubara-literal-config.json) |
| AICR Helm source package | Helm chart source package | 0 | pass | [JSON](./reports/aicr-helm-source.json) |
| Public cub installer package rendered with its default config | cub installer source package | 6 | pass | [JSON](./reports/nginx-installer.json) |

The AICR and Kubara examples are committed local OCI image layouts and are re-read by
`npm run oci:inspect:verify`. The NGINX report was produced from the public package
at its immutable digest; the network-free verifier checks it against the publication
receipt, package definition, and checked render. Use
`npm run oci:inspect:verify-live` to pull and render that public package again.

## Keep the package roles separate

| Package role | What the report can inspect |
| --- | --- |
| Helm chart source | Chart metadata and layers. Render it before expecting Kubernetes objects. |
| cub installer source package | Preset configs, package files, and requirements; use `--render` for the selected objects. |
| Literal Kubernetes configuration | Exact objects, object kinds, obvious lifecycle work, companion records, and basic checks. |
| Unknown OCI package | Manifest and layer metadata, plus any readable YAML or JSON objects found. |

This report is deliberately narrower than a deployment proof. It does not claim that
Kubernetes admitted the objects, a controller reconciled them, or the workload became
healthy.
