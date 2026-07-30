# Onboarding And Entry Paths

**UNOFFICIAL/EXPERIMENTAL.** This doctrine keeps the public catalog aligned
with the ConfigHub product tutorial.

## One ConfigHub Tutorial

The [ConfigHub tutorial](https://docs.confighub.com/get-started/tutorial/) is
the canonical product journey. It teaches one sequence:

1. Set up a cluster.
2. Install and release one component.
3. Change it, add production, and promote the change.

The catalog must not create a second ConfigHub tutorial. It helps a user
choose, inspect, and test configuration before that journey.

## What Each Thing Does

| Item | Role |
| --- | --- |
| Helm, AICR, Kubernetes YAML | Configuration that a user already has. |
| Existing OCI | A package that already contains configuration. |
| `cub installer`, `cub helm`, CI | Tools that prepare, render, or import configuration. |
| ConfigHub | The system that records, changes, releases, and promotes configuration. |
| Argo CD, Flux, Kubernetes | Systems that deliver configuration to clusters. |

Do not present these items as competing products. A user does not need to
learn their implementation differences before completing a first task.

`cub helm` imports an arbitrary Helm chart and its values. `cub installer`
reads a maintained catalog package with named configurations and recorded
requirements. This distinction belongs in the FAQ and technical guides. It
must not become the main public message.

## Three Operating Choices For Starting Examples

Show these choices when a person is trying a starting example. They make
different promises.

| Choice | ConfigHub Server | ConfigHub account | Status |
| --- | --- | --- | --- |
| Local | No | No | Available. Pull public packages. Write files or OCI. Test them locally or in CI. |
| Hosted and anonymous | Yes | No | Planned. Inspect and test public configuration without signing in. |
| ConfigHub | Yes | Yes | Available. Record changes, release them, add environments, and promote them through the official tutorial. |

Public package and OCI pulls already work without registry login. They support
the local path. They do not prove that the hosted anonymous service exists.

Do not describe the hosted anonymous service as released until a public
endpoint and a recorded test exist.

Do not repeat these three choices throughout later examples. After a person
claims or uploads a configuration, the variants, promotions, releases, Apps,
apply gates, and fleet examples use ConfigHub Server and require an account.
The official ConfigHub tutorial owns that managed journey.

Use the terms precisely:

- **No server** means the action does not use ConfigHub Server.
- **Anonymous** means the action does not require a ConfigHub account.
- A local command or CI job can be both.

## Several Ways In, One Journey Afterward

The catalog can have short starting examples for:

- a reviewed Helm catalog package;
- a user's own Helm chart and values;
- AICR, existing OCI, or Kubernetes YAML.

Each path must end with exact Kubernetes objects that the user can inspect.
The next managed step is the same for every source: continue with the official
ConfigHub tutorial.

Keep source-specific information with the result:

- Helm records the chart, version, values, render context, and known install work.
- AICR records the source package digest, fixed components, allowed inputs, and generated applications.
- Existing OCI and YAML record their source digest or source files.

## Page Ownership

| Page | Job |
| --- | --- |
| `site/try.html` | Complete one local catalog-package task in three steps. |
| `site/redis-walkthrough.html` | Keep the complete Redis parity, OCI, upgrade, promotion, and rollback example. |
| ConfigHub tutorial | Teach the ConfigHub product journey. |
| `site/testing.html` | Index the working starting, managed, platform, and App examples. |
| `site/entry-path-reference.html` | Keep the detailed Helm, AICR, OCI, and YAML commands and proof links. |
| `site/how-it-works.html` | Explain the full model after the first task. |
| `site/docs.html` | Help a technical reader find the correct guide or evidence. |

## Simplified Technical English

Use STE discipline on instructions, status text, technical descriptions, and
entry-path choices.

- Give one instruction per sentence.
- Give each step one result.
- Name the tool that performs an action.
- Keep a condition beside the action it controls.
- Use one word for one meaning.
- Do not omit articles, subjects, or required qualifiers to make text shorter.
- Keep commands outside prose when a command block is clearer.
- Preserve limits and evidence links.

The short Try page has these additional limits:

- three numbered steps;
- no more than three command blocks;
- one chart and one selected configuration;
- no upgrade, promotion, GitOps, or fleet tutorial on the same page;
- a clear choice between local, anonymous, and ConfigHub use;
- a direct link to the official ConfigHub tutorial.

## Acceptance Checks

The site verifier must fail when:

- the short Try page loses the official tutorial link;
- the short Try page has more than three command blocks;
- local and anonymous are described as the same condition;
- a managed example presents local or anonymous operation as an alternative to
  ConfigHub Server;
- AICR, Helm, OCI, or Kubernetes YAML disappears from the entry-path page;
- the detailed Redis walkthrough loses its parity, OCI, upgrade, or rollback evidence.
