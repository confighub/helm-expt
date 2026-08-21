# Check configuration in the browser without signing in

The hosted anonymous path has one bounded job: compare rendered Kubernetes
objects and keep the result. It runs in your browser. It does not upload your
files, use a ConfigHub account, or contact a cluster.

Open [Check my config](https://confighub.github.io/helm-expt/site/ask.html) and
choose one of two starts:

1. Select **See the complete example**. The page loads a small AI-written
   NGINX candidate and a safer comparison, runs the browser checks, and shows
   the finished result.
2. Add your own rendered Kubernetes YAML. You may also add a comparison and a
   Catalog source and intent record.

## What the browser does

The page:

- parses the Kubernetes YAML;
- lists the exact object identities;
- compares object contents without treating formatting changes as real changes;
- checks a short list of manifest risks;
- adds known hooks, CRDs, and prerequisites when you supplied a Catalog record;
- records every check that did not run; and
- creates `workshop-result.json`.

The complete result contains the candidate YAML, optional comparison, optional
source and intent record, browser review, and SHA-256 hash for every file. You
can keep it locally or give it to Claude, Codex, another AI assistant, or CI.
The separate YAML and review downloads remain available when a tool expects
ordinary files.

## What stays on your machine

The static website does not:

- render an arbitrary Helm chart or AICR recipe;
- pull an arbitrary OCI package;
- contact Git, ConfigHub, or Kubernetes;
- run schema or admission checks;
- execute hooks or establish CRDs; or
- test workload health, migrations, or external services.

Use Helm, AICR, `cub installer`, `oras`, or your existing build on your machine
to produce the YAML. The page can then inspect it. Use local or CI tools for the
checks that need source access, a registry, or a cluster.

## Three valid endings

The browser result is useful without ConfigHub.

1. Keep `workshop-result.json` with your change.
2. Publish the reviewed Kubernetes objects as OCI for Argo CD, Flux, or another
   consumer.
3. Retain the candidate and review in ConfigHub when a team needs shared
   history, variants, approval, promotion, release OCI, or live comparison.

The page generates the ConfigHub commands and a prompt for the AI assistant you
already use. Signing in is an optional operating choice, not a requirement for
the browser check.

The result format is defined by the
[WorkshopResult schema](../../schemas/config-workshop-result.schema.json).
The individual review inside it follows the
[ConfigurationReview schema](../../schemas/config-workshop-review.schema.json).
