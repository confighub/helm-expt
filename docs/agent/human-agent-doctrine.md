# Human And Agent Documentation Doctrine

**UNOFFICIAL/EXPERIMENTAL**

`helm-expt` has two documentation audiences. Human pages explain the product and
the problem. Agent pages explain which repo files and commands to use.

The two layers must stay aligned, but they should not become copies of each
other.

## Split Of Responsibility

| Layer | Owns | Should not own |
| --- | --- | --- |
| Public website | Product value, first routes, catalog browsing, proof signposts. | Long command recipes, repo recovery steps, internal maintenance rules. |
| `docs/user` | Product and proof explanations for technical users. | Agent checklists or every generated-data path. |
| `docs/agent` | Task recipes, recovery steps, verifier choice, repo vocabulary, read-only catalog rules. | Marketing copy, broad product narrative, or new claims. |
| `tests/npm-scripts.md` | Full npm command runbook. | Public-facing value story. |
| `data/`, `recipes/`, `packages/` | Generated evidence and generated package docs. | Manual narrative edits. |

## Drift Rules

When a human-facing page changes:

1. If it changes a product claim, make sure the evidence or refusal boundary is
   still linked from the human page.
2. If it changes a command, update the matching agent task or recovery note if
   agents need to run it.
3. If it introduces a new term, update `docs/agent/terms.md` only when agents
   need the term to operate the repo.
4. Do not add agent checklists to the public page. Link to
   `docs/agent/README.md` instead.

When an agent-facing page changes:

1. Link back to the human explanation instead of restating the whole story.
2. Keep commands exact and scoped.
3. Say whether a command mutates files, needs a cluster, or creates receipts.
4. Do not create a new product claim. Point to the human doc, claim register, or
   generated evidence that owns the claim.

## Canonical Pairings

| Topic | Human source | Agent/operator source |
| --- | --- | --- |
| Business purpose and user journey | `docs/reference/config-catalog-doctrine.md#business-purpose-and-user-journey` | Link to the canonical section; do not mirror it in agent instructions. |
| First-run story | `docs/user/try-now.md` and public Get Started page | `docs/agent/tasks.md` |
| Command choice | `docs/user/choosing-commands.md` | `docs/agent/tasks.md` and `tests/npm-scripts.md` |
| Verification model | `docs/user/verification.md` | `docs/agent/verification.md` |
| Recovery from failures | Human docs only when user-visible | `docs/agent/recovery.md` |
| Catalog status | Public catalog and `data/README.md` | `docs/agent/catalog.md` |
| Vocabulary | `docs/user/confighub-data-model.md` and `docs/user/helm-render-intents.md` | `docs/agent/terms.md` |
| Human/agent split | Public site only links to it | this file and `docs/planning/agent-experience-audit.md` |

## Website Rule

The website may link agents and maintainers to `docs/agent/README.md`, but it
should not become the agent manual. Put the link in Docs/FAQ, not the top
navigation.

## Review Checklist

Before committing a docs change, ask:

- Did I change a human claim without checking the evidence boundary?
- Did I change a command without updating the agent recipe that uses it?
- Did I add an agent instruction to a human page when a link would do?
- Did I hand-edit generated evidence instead of the generator or source data?
- Did I run the narrow verifier for the changed surface?
