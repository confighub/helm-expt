# Agent Terms

**UNOFFICIAL/EXPERIMENTAL**

This is a compact glossary for agents. Human explanations live in
[ConfigHub Data Model](../user/confighub-data-model.md) and
[Helm Render Intents](../user/helm-render-intents.md).

| Term | Meaning |
| --- | --- |
| Product command | A command that renders, installs, uploads, applies, or manages configuration for a user, such as `cub`, `helm`, `kubectl`, Argo, or Flux. |
| Repo proof command | An `npm run ...` command that verifies committed repo evidence. |
| Generated surface | A file or directory produced by a script. Change the generator or source data, not only the output. |
| Catalog | The maintained public corpus of Helm chart/version/base rows, evidence, gaps, and next actions. |
| Recipe | The repo-side description of how a chart is rendered and packaged. |
| Package | The `cub installer` artifact produced from a recipe. |
| Base variant | A Helm-rendered shape. Use it when chart version, values, CRDs, storage, Secret strategy, components, or lifecycle behavior change the rendered objects. |
| Render variant | The captured output for one base variant render: exact Kubernetes objects plus the `variant-revision` and package base that store them in this repo. |
| Derived ConfigHub variant | A post-render ConfigHub version made from an uploaded base. Use it for environment, region, customer, target, gates, labels, and scoped file changes after render. |
| Render intent | A compact generated object for one real base row: chart, version, base, render inputs, source lock, known extras, and evidence links. |
| Unit | ConfigHub's versioned object record for desired Kubernetes configuration. |
| Space | A ConfigHub container for Units. |
| Target | The cluster or delivery destination where Units are applied or observed. |
| Route | A named path for work Helm leaves outside plain YAML, such as hooks, CRDs, setup jobs, target prerequisites, webhook certs, generated facts, or GitOps handoff. |
| Receipt | Evidence that a command, render, upload, scan, delivery, or observation happened and passed a defined boundary. |
| Lane | One proof category, such as render parity, ConfigHub proof, local live, GitOps/OCI live, or two-cluster parity. |
| `pass` | Evidence satisfies the scoped lane. |
| `watch` | The main path may work, but something needs review or rerun before a stronger claim. |
| `blocked` | The row cannot pass until a named problem is fixed. |
| `refused` | The repo deliberately does not claim support for that behavior through the current path. |
| Fresh evidence | A new run that may create clusters, publish artifacts, or write receipts. |
| Committed evidence | Existing receipts, data, and summaries already in the repo. |
