# Workshop Guide design review

Reviewed: 1 October 2026. Follow-through for #679, after the #2059 prototype.

## Goal and scope

A newcomer should find a task, understand what the first result means, and
recognize when a later command changes local files, ConfigHub or a cluster.
Keep the six main sections, approved homepage positioning, existing Guide URLs
and evidence boundaries. The review covers hierarchy and task navigation, not
new runtime capabilities or a claim of measured adoption.

## Comparables and decisions

The following pages were read and visually inspected at 1280 x 720 and
390 x 844. These are observations of a small representative sample, not a
ranking of whole products. Their designs inform decisions; their wording is
not copied.

| Reference | Useful observation | Consequence for Workshop |
| --- | --- | --- |
| [Wikipedia: Kubernetes](https://en.wikipedia.org/wiki/Kubernetes) | A clear article title and a local contents list distinguish the current subject from global navigation. The sampled page also has a large warning and infobox that dominate the phone view. | Use a local Guide outline; do not copy the warning-heavy opening or introduce an encyclopedia hierarchy. |
| [Hugging Face: Model Hub](https://huggingface.co/docs/hub/en/models-the-hub) | Documentation separates the subject, local outline and catalog navigation. Its signup banner takes substantial space before the actual explanation, including on mobile. | Keep exact configuration identity and readable evidence available, but keep the anonymous first task ahead of account acquisition. Do not add a signup banner. |
| [HashiCorp: Create infrastructure](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/aws-create) | A task title, short tutorial sequence and explicit prerequisites make the route legible. The large interactive-terminal area delays the first instruction in the sampled phone view. | Name the task and requirements, show commands and expected results, and avoid decorative or empty interactive space before the first useful action. |
| [JFrog: Get started](https://docs.jfrog.com/artifactory/docs/getting-started) | Product orientation is distinct from setup and connection tasks; the large hero occupies much of the phone viewport. | Keep the progression into managed ConfigHub work, but make it optional after a useful local result and avoid a larger marketing hero. |
| [ConfigHub documentation](https://docs.confighub.com/) | A restrained reading column and direct product documentation links support deeper learning; the opening is a conceptual introduction rather than a short task. | Workshop provides the bounded first task and links to official documentation for sustained operations. Do not duplicate the product reference or imply a local preview is deployment. |

## Observed Workshop friction

The prior Flux page presented a long section tree on the left, a separate
outline on the right, an expanded agent prompt and a full handover sequence.
This made choosing an action compete with understanding its instructions.
The Argo prototype had already addressed that problem on one page.

The Apps page put three long teaching cards ahead of its full directory.
The own-chart Guide explained several models and agent-checking habits before
the first render. The GPU page explained its taxonomy before its two starting
paths. Sveltos and Kubara mentioned sensitive input handling after commands
that prepared those inputs.

## Implementation

- All registered Guides use a local heading-based outline, with All Guides,
  AI and ConfigHub links retained. Longer outlines disclose their later sections.
  The duplicate right rail is removed from these pages. The registry remains
  the source of Guide identity, including Markdown-backed Helm Guides.
- Guide reading width is bounded. Phone layouts retain a collapsed local menu,
  command blocks scroll within the content column, and summaries have visible
  keyboard focus. A skip link bypasses repeated chrome.
- Flux and Sveltos now offer a useful stopping point after planning; their
  later write/delivery sections are disclosed separately. Plan examples stay
  visible. Sveltos distinguishes local script creation from scripts that can
  change the management cluster.
- Kubara keeps local generation and the inspectable result visible, places
  sensitive-input guidance before preparation, and discloses governance steps.
  Existing health and rollback limitations remain.
- The GPU entry presents local inspection and existing-node observation as
  separate choices. Collector resource creation remains explicit beside the
  node command. The model explanation and four-question table are optional.
- The own-chart introduction is shorter, still defines flattened configuration
  as fully rendered Kubernetes objects, and distinguishes rendering from
  deployment. Agent-checking detail follows the four main moves; its anchor,
  commands and evidence remain intact.
- Apps exposes a directory shortcut and three concise example choices, each
  with its complete before/after teaching material available on expansion.
  The migration sequence and hand-back/data-recovery boundary stay visible.
- AI keeps its existing prompt-first content. It gains the same local
  navigation as the other Guides; no replacement messaging or new IA is needed.

- The NIM entry offers a concrete model-file inspection before GPU setup. The
  Redis entry folds its introductory comparison and retains its delivery link.
- The UIs Guide leads with the official ConfigHub GUI for Enterprise Server and
  SaaS. The UI SDK serves custom use cases and plugins, including disconnected
  use; cub-commander is explicitly an early experimental terminal UI.

- Docs now starts with eight practical topics, including AI, GitOps and
  deployment. The full entry demonstration and corpus index moves to Catalog
  docs; general documentation stays available in a collapsed index. Existing
  Docs anchors remain valid, and the doc-map gate checks coverage across both.
- Apps uses direct language about keeping existing tools, previewing a change,
  and choosing when to switch delivery. The recovery limits remain explicit.

## Validation and limits

Two inexpensive fresh readers performed seven content-reading tasks, without
executing commands. The first correctly identified prerequisites, first results
and mutation boundaries for Flux, Sveltos, local AICR inspection and an app
example. The second correctly read the Helm, Kubara and UI routes, but found
that the alternate Helm route did not define flattened configuration and that
Kubara's existing-install shortcut appeared after new-install commands. Both
were corrected and reread. These are reading trials, not runtime acceptance.

Browser checks covered twelve entry pages at widths 390, 768 and 1280 pixels.
All 36 final checks had no page-level horizontal overflow. Initial phone
failures in the own-chart and NIM documents were corrected by allowing long
inline identifiers to wrap and applying the Guide layout to the NIM entry.
Command blocks retain internal horizontal scrolling. Keyboard checks reached
the skip link, content and local menu. Fragment links opened the optional Argo,
Flux, Sveltos and Kubara sections; mobile scroll clearance was increased so
headings remain below the header. The removal of the old rail also exposed a
missing Redis delivery link, which was restored explicitly.

The final UIs wording was checked against the requested product distinctions.
Repository gate results are recorded in the accompanying PR and #679. Those
gates cover generation, links, prose constraints and retained command surfaces.

These checks do not execute plugin operations, prove production migration,
measure adoption, establish a population success rate or provide a complete
screen-reader accessibility audit. Real-person acceptance remains #1956.
