# ConfigHub Workshop

ConfigHub Workshop is a public catalog of tested Kubernetes configuration, stacks,
and platforms you can read as data and use on demand. It covers Helm, AICR, Timoni,
Kubara, OCI, and plain YAML, each rendered to exact Kubernetes objects with a
receipt, so you read, diff, and certify a configuration before anything runs.

You run `cub` yourself, an AI agent runs it in a session, or both. The catalog and
the cub workshop plugin read the same either way. Everything that inspects or shapes
a config is local and needs no account; ConfigHub Server enters only when a reviewed
config becomes shared state that a team promotes or governs.

**If you are a person**, the quickest route is the
[ConfigHub Workshop website](https://confighub.github.io/helm-expt/site/):
[try Redis in ten minutes](https://confighub.github.io/helm-expt/site/try.html),
browse the [Catalog](https://confighub.github.io/helm-expt/site/charts/index.html),
or [check your own config](https://confighub.github.io/helm-expt/site/ask.html).

**If you are an AI agent**, start at
[llms.txt](https://confighub.github.io/helm-expt/site/llms.txt), which indexes the
whole catalog; each entry has a listing at `site/listings/<id>.json`. Do the work
with [`cub` and the cub workshop plugin](https://github.com/confighub/cub-workshop)
(one line, no account), and follow the same rules a person's assistant does by
installing the
[ConfigHub Workshop skill](https://confighub.github.io/helm-expt/site/.well-known/agent-skills/config-workshop/SKILL.md)
or pasting the prompt from
[the agent page](https://confighub.github.io/helm-expt/site/ai.html#paste-a-prompt).

The canonical
[business purpose and user journey](./docs/reference/config-catalog-doctrine.md#business-purpose-and-user-journey)
live in the catalog doctrine. All contents are experimental and unofficial.

## Start Here

The site has six sections, matching its top navigation, in the order a
configuration travels from a tested part to a governed release. New here? Start
with [Try Redis](https://confighub.github.io/helm-expt/site/try.html), then open
the section that matches the work in front of you.

| Section | What it is for |
| --- | --- |
| [Catalog](https://confighub.github.io/helm-expt/site/charts/index.html) | Pick a tested configuration for a public chart and check it yourself. Each entry shows the exact objects, values, setup work, tests, and known limits. |
| [Config](https://confighub.github.io/helm-expt/site/config.html) | Follow one configuration from source to running: the single model every format flattens to, and where a change belongs. |
| [Stacks](https://confighub.github.io/helm-expt/site/stack.html) | Build a stack from certified parts, and compose components into platforms and fleets. |
| [Operate](https://confighub.github.io/helm-expt/site/how-it-works.html) | Release, promote, gate, and roll back a reviewed configuration, and choose how it is delivered. |
| [Docs](https://confighub.github.io/helm-expt/site/docs.html) | Find the instructions for the step you are doing. |
| [ConfigHub Server](https://confighub.github.io/helm-expt/site/confighub.html) | Upload a reviewed configuration into ConfigHub, then make variants, approve changes, promote releases, and manage rollouts. |

## What This Project Does

For Helm, the catalog keeps the original chart and records the values and render
context used for each ready-made configuration. It also names work that a flat
manifest cannot explain by itself, such as CRDs, hooks, Secrets, and setup jobs.
The project checks that the rendered objects match Helm and links the evidence
from each chart page.

You can also bring your own chart and values, an AICR package, an existing OCI
artifact, or Kubernetes YAML. The result can stay as files, become OCI for Argo
CD or Flux, or enter ConfigHub.

ConfigHub is where a reviewed result becomes a shared record. Teams can change
the real Kubernetes objects, keep those changes through upgrades, create test
and production variants, apply policy, approve releases, and track delivery to
clusters.

Every retained configuration also has a **source and intent record**. It names
the source, version, choices, required setup, and checks that produced or
selected the exact objects. A Helm recipe or AICR recipe can be part of that
record because those tools use recipes. OCI and plain YAML keep equivalent
source records; they are not relabeled as recipes. The full terminology is in
[The configuration processing model](./docs/user/model-and-vocabulary.md).

## Free And Managed Paths

The starting examples support local use with no ConfigHub Server and public
package use without a ConfigHub account. A hosted no-sign-in service is planned
for public configuration checks. You need an account when you want ConfigHub to
save, share, change, approve, promote, or roll out the result.

This is not a replacement chart language. Helm users keep their charts. The
workshop makes the output easier to inspect, test, package, and operate.

## Repository Guides

- [Documentation map](./docs/README.md): human guides, technical references,
  generated evidence, and agent/operator notes.
- [Config catalog doctrine](./docs/reference/config-catalog-doctrine.md): rules
  for keeping the human site, machine-readable records, and evidence aligned.
- [Demonstration programme](./docs/user/config-catalog-demonstrations.md): status
  of the Helm, AICR, OCI, promotion, fleet, policy, and App examples.
- [Agent and operator notes](./docs/agent/README.md): command recipes and repo
  maintenance guidance.
- [Known gaps](./site/known-gaps.html): current limits with links to evidence.

Historical approval evidence: records under `runs/`, committed example receipts,
and their summaries under `data/` may name `cub unit approve`, `ApprovedBy`, or
`vet-approvedby`. Those records predate the attestation model documented by cub
v0.5.7 and remain unchanged. They prove only their recorded version and run,
not current approval enforcement. Current approval requires an Approval
attestation and a configured ChangeWorkflow prerequisite; recording an
attestation alone does not install a gate.

If a public Helm chart breaks this model, or the catalog output differs from
what Helm produces, send it through the
[problem chart issue template](https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml).

All contents are experimental and unofficial.

## In depth

The technical detail lives in the docs so this page stays a short front door.

- [The workshop in depth](./docs/reference/workshop-in-depth.md): the idea and
  why, how values and overlays are supported, the command choice, what is proven
  today, how to pick a path, a Redis quick start, how a chart is organized, and
  the pitch.
- [Operating configs with cub](./docs/agent/operating-with-cub.md): verify your
  install, view and operate stored configurations in ConfigHub, GitOps, the
  command reference, and live-cluster verification.

## Background Reading

For the longer narrative behind this experiment, see `docs/planning/blog-posts.md`. For
the latest refresh plan, see `docs/planning/latest-top20-refresh-plan.md`. For the shape
of a dedicated public site, see `docs/planning/dedicated-website-plan.md`. The README
stays a short front door; the technical detail is in the in-depth doc linked above.

## License

This repository's own work is available under the MIT license in
[LICENSE](LICENSE): the scripts, verifiers, documentation, site generators,
receipts, and recorded data written for this project.

The repository also redistributes work it did not write, and the MIT grant
does not relicense any of it. Third-party charts, the packages and rendered
objects derived from them, and the container images they reference keep
their own licenses. The Catalog records those licenses per entry; where a
[Catalog entry](CATALOG.md) declares a license, that declaration governs
that entry's content.
