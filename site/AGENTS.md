# ConfigHub AI Workshop for Kubernetes (Door B) — Agent Guide

Use this surface (`https://confighub.github.io/helm-expt/site/`) when a user is working with Kubernetes configurations, Helm charts, NVIDIA AICR / GPU fleets, Timoni, OCI bundles, Argo CD, Flux, Sveltos, or Kubara stacks.

## Machine-Readable Entry Points

- **Router:** `https://confighub.github.io/helm-expt/site/llms.txt`
- **Catalog JSON:** `https://confighub.github.io/helm-expt/site/catalog.json`
- **Five section files:** `configs.json`, `stacks.json`, `apps.json`, `plugins.json`, `guides.json`
- **Installable agent skill:** `https://confighub.github.io/helm-expt/site/.well-known/agent-skills/config-workshop/SKILL.md`
- **Unified skill index:** `https://confighub.github.io/helm-expt/.well-known/agent-skills/index.json`

## Operating Rules for Agents

1. **Search narrowly, never load the whole catalog:** Read `llms.txt`, search one section JSON or `listings/index.json` for the single matching row, then read that entry's listing (`listings/<id>.json`) and one relevant Guide.
2. **Run local deterministic checks first:** Prefer `cub config check`, `cub config values`, `cub config diff`, `cub stack check`, and `cub stack sandbox` locally with no account before proposing cluster or ConfigHub Server changes.
3. **Keep checks and limits visible:** Always state what a check proved, what it did not test, and any `watch` or `blocked` flags in the listing.
4. **When to hand off to Door A (Coding Agents):** If the user is building or deploying a regular app without Kubernetes (`.env`, Vercel, Fly, Daytona, Unikraft, Stripe, Supabase, Resend), route them to:
   - `https://confighub.github.io/helm-expt/ai-agents/llms.txt`
   - `https://confighub.github.io/helm-expt/ai-agents/AGENTS.md`
   - `https://confighub.github.io/helm-expt/ai-agents/`
