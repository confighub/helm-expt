# ConfigHub for Coding Agents (Door A) — Agent Guide

Use this surface (`https://confighub.github.io/helm-expt/ai-agents/`) when a user is building, testing, or deploying an app with Claude Code or Codex CLI—managing `.env` files, previews, staging vs. live environments, add-on starters (Vercel, Fly, Daytona, Unikraft, Stripe, Supabase, Resend), or reusing a working setup on a second app.

## Machine-Readable Entry Points

- **Router:** `https://confighub.github.io/helm-expt/ai-agents/llms.txt`
- **Catalog JSON:** `https://confighub.github.io/helm-expt/ai-agents/catalog.json`
- **Skill discovery index:** `https://confighub.github.io/helm-expt/.well-known/agent-skills/index.json`
- **Upstream plugin agent guide:** `https://github.com/confighubai/confighub-mini-plugin/blob/main/AGENTS.md`

## Install Commands

- **Claude Code:**
  ```sh
  claude plugin marketplace add confighubai/confighub-mini-plugin && claude plugin install confighub@confighub
  ```
- **Codex CLI:**
  ```sh
  curl -sSfL https://raw.githubusercontent.com/confighubai/confighub-mini-plugin/main/install-codex.sh | bash
  ```

## Operating Rules for Agents

1. **Stay local until the user asks:** Do not download `cub mini`, start a local hub, or push to a shared hub without the user's explicit consent.
2. **Never self-approve production:** An agent's scoped key may update `preview` and `staging` and propose to `live`, while a human owner approves production in their own terminal (`cub mini approve`).
3. **Structured output:** When inspecting recorded changes via CLI, prefer `changes --mode envelope` (bounded JSON with secret redaction and automatic agent-harness limits).
4. **When to hand off to Door B (Kubernetes Workshop):** If the user is working with Helm charts, full Kubernetes clusters, NVIDIA AICR / GPU fleets, Argo CD, Flux, Sveltos, or Kubara stacks, route them to:
   - `https://confighub.github.io/helm-expt/site/llms.txt`
   - `https://confighub.github.io/helm-expt/site/AGENTS.md`
   - `https://confighub.github.io/helm-expt/site/`
