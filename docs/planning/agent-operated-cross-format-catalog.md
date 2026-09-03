# Agent-operated cross-format Catalog plan

**Status:** active implementation plan.

## Objective

Make ConfigHub Workshop useful to people who work with Claude, Codex, or another
coding agent every day. An agent should be able to answer one configuration
question using exact source records, Kubernetes objects, lifecycle work, checks,
and evidence. It should not need to guess chart behavior or search hundreds of
generated pages.

The public human journey remains:

1. Find a configuration we have already investigated.
2. Check a configuration the user or an agent produced.
3. Test the proposed move to another environment.
4. Keep the accepted result locally, as OCI, or in ConfigHub.

## Workstreams

### 1. Installable Agent Skill

Publish a versioned Agent Skills-compatible `SKILL.md` that covers Catalog
resolution, local inspection, comparison, lifecycle work, promotion review,
OCI output, and the optional ConfigHub handoff.

The skill must prefer exact versions and digests, keep private input local by
default, distinguish checks that ran from checks that did not run, redact
Secret values, preview before mutation, use the source-neutral processing
model, and work from static public endpoints without a ConfigHub account.

### 2. Agent-facing public entry point

Give the existing AI page one clear purpose: use ConfigHub Workshop with an AI
agent. Put user tasks and realistic prompts first. Keep Catalog maintenance,
guardrails, ConfigHub Apps, and evidence as deeper sections.

Expose the page from the main navigation without adding another navigation
item. Keep Guides available from the homepage and Docs.

### 3. Machine contract and evaluations

Publish the skill at a stable `.well-known/agent-skills/` path and list it in
`llms.txt`. Add deterministic checks for its metadata, safety rules, links, and
cross-format vocabulary.

Maintain realistic evaluation prompts for an exact Catalog question,
AI-written Helm values, a promotion comparison, lifecycle work, unsafe
flattening, OCI role distinctions, and ConfigHub retention.

Run fresh-agent evaluations with only the skill, CLI help, supplied input, and
one relevant Catalog record. Record retries, missing checks, unsafe actions,
wrong claims, and documentation gaps. Do not count a static file check as an
agent task-completion result.

### 4. Timoni source support

Add Timoni as a source type inside the existing Catalog. Do not create a second
Catalog or position it as a replacement for the current Helm-first entry path.

The first retained entry must record the module OCI version and digest, typed
configuration schema and selected values, exact objects and inventory digest,
lifecycle behavior, flattening verdict, route intent, ownership, target facts,
artifact roles, and current test limits.

Start with one small module that can be built offline after the OCI pull.
Follow with one lifecycle-heavy component and one multi-environment bundle only
after the first adapter and evidence contract are stable.

### 5. Cross-format model consolidation

Use one processing contract across Helm, cub installer, Timoni, AICR, Kubara,
source OCI, configuration OCI, YAML, and ConfigHub:

```text
source and intent
-> materialize exact objects
-> decide flattening
-> record lifecycle work
-> resolve routes for variant + destination + runtime
-> classify field ownership
-> retain and vary
-> publish, deliver, and observe
```

Materialization may be a render, build, composition, generation, or recorded
no-op. Flattening is a decision, not another word for rendering. Route
resolution can happen again after a derived variant or destination is selected.
OCI is the transport; it does not make every lifecycle rule executable.

### 6. Documentation MCP

A read-only documentation MCP service remains a follow-up. It should search and
return the same current Markdown and machine records exposed through `llms.txt`.
Do not add a public MCP command until a real endpoint exists and is maintained.

## Acceptance criteria

- The skill passes the repository validator and its published copy is current.
- A person can find the AI-agent entry point from every generated page.
- The AI page starts with tasks and commands, not internal Catalog process.
- `llms.txt` links the skill, machine records, Check, and Promote.
- One Timoni record passes the source-neutral schema and processing verifier.
- Existing source records remain valid.
- Site, docs, machine-contract, skill, and processing-model gates pass.

## Follow-up decisions

- Where to host the read-only documentation MCP service.
- Which lifecycle-heavy CNCF component should follow the first Timoni entry.
- Whether a component page should compare multiple source formats directly or
  link to a source-format comparison page.
- Which low-cost models join the recurring task-completion evaluation matrix.
