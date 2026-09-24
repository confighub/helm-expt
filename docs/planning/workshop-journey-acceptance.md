# Workshop journey acceptance

Status: agent acceptance recorded on 2026-09-24. **Human acceptance is pending.**
Agent trials are usability evidence, not adoption.

This records the final agent acceptance of the five Workshop journeys, the
entry routes toward platform and GPU outcomes, the blockers still open with
their owners, and a script for running the first human trials. It supports the
[adoption execution plan](./workshop-adoption-execution-plan.md) and the task-8
tracker, #1956.

## Method

Each trial used a fresh agent (Claude Sonnet, as a subagent) that received
only the user's problem and the site's home page. None was given a command
sequence or an answer. Each worked in an empty home directory with `cub`
installed and no Kubernetes cluster, and was told not to sign in anywhere.
The inputs were new to the site's examples. Round 1 ran on the live site.
Rounds 2 to 5 ran on a local build of each fix branch and repeated only the
journeys that had changed. Rounds 4 to 6 reran J1 and J4 on plugin 0.6.50
with inputs the site does not use.

Each report records the route taken from the home page and the useful output
on the user's input. It records the help needed and any misleading
expectation. It keeps what was checked apart from what only a deployment
would prove. It says whether the agent understood the ConfigHub follow-on, and
whether a person with `cub` and no AI assistant could follow the Guide.

In some parallel runs the agents shared one browser pane and saw each other's
tabs. Their reports on navigation were checked against the pages, and later
runs read the site with `curl` or WebFetch only.

## Acceptance table

| Journey | Input | Entry route from home | Useful result | Checked versus deployed kept apart | ConfigHub follow-on | Guide usable with `cub` alone | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| J1 values did nothing | ingress-nginx 4.15.1, then metrics-server 3.13.0, each with a top-level `replicaCount` | Check my config → "Check every key in your own chart" → J1 page → Values Guide | yes, 3 of 3 rounds; on 0.6.50 the check named the right key itself | yes | understood; tied to a shared next change | yes | agent-accepted |
| J2 AI rewrite undid fixes | report-worker rewrite: `LOG_LEVEL` added, six fixes reverted | Check my config → "Review an AI rewrite and keep your fixes" → `ai.html` section 6 → Adapt Guide | yes | yes | understood: linked Units, `--protect`, `--upgrade`, account needed | yes | agent-accepted |
| J3 what my app needs | notes app with Ingress (nginx), Certificate and ServiceMonitor | Build a stack or platform → `stack.html` | yes, 2 of 2 rounds: web-platform plus the app, CHECKED, app needs met | yes | understood; deferred until a cluster exists | yes, after #1983 | agent-accepted |
| J4 before GitOps takes over (Flux) | CloudPirates postgres 0.20.6 handed to Flux | Config → Run it with Flux, Argo CD, or kubectl → section 1 | yes, 3 of 3 rounds | yes | understood; deferred for a single database | yes, after #1983 | agent-accepted |
| J4 before GitOps takes over (Argo CD) | Grafana 10.5.15 (2026-09-23); on 0.6.50, CloudPirates rabbitmq 0.21.28 twice, then CloudPirates mongodb 0.18.15 | the same page | yes, 4 of 4 rounds; each found the `lookup`-generated password, fixed it with the chart's existing-Secret value, and wrote an Application that keeps the release name | yes | understood | yes, after #1985 | agent-accepted |
| J5 installs but never starts | Bitnami mysql 14.0.3, staging then production | Did a chart stop pulling? | yes, 3 of 3 rounds | yes | understood; conditioned on staging success | yes | agent-accepted |
| Platform outcome path | a Heroku-style platform: Redis, Prometheus, Loki, TLS ingress | Apps, Stacks, Kubara pages | a verified parts list and `app-platform` rendered and checked | yes | understood | yes | route honest; product gaps below |
| GPU outcome path | an LLM on GPU nodes (vLLM or NIM) | I run AI on GPUs | pulled vLLM, device-plugin, Karpenter and NIM configuration; `cub app match` ran all three outcomes | yes; hardware facts kept separate | understood | yes | route honest; hardware proof pending |

No trial hit an unexplained refusal. The refusals seen were explained: a
kube-prometheus-stack listing that is unsafe to flatten, and a missing image.

## Fixes made from the trials

| Pull request | Change |
| --- | --- |
| #1958 to #1980 | Journey pages and Guides for J1, J2, J4 and J5; the Check my config handoffs; the plugin pin; `--protect`; the agent skill |
| #1983 | Round 1 to 3 fixes: the J1 search step; the J3 own-app route on `stack.html`; J4 Flux release identity, a HelmRelease template and the existingSecret deletion warning; J5 chart-page notes and the MySQL successor link |
| #1985 | Pin to plugin 0.6.50, whose key suggestions and `lookup` list replace the manual workarounds on the J1 and J4 pages; round-4 fixes: the chart-page password caveat names whose Secret keys it lists, and the handover section covers `oci://` charts, Argo CD not writing Helm's release record, an Argo CD Application template, the `resource-policy: keep` case and finding a chart's existing-Secret value |

## Evidence

Evidence is kept on the shared workstation at
`$HOME/workshop-trials/2026-09-24-acceptance/`. The `inputs` folder holds each
trial's input. Each round has its own folder, from `round1-j1` to
`round6-j4`, with the agent's report and the files it produced. The
`platform-path` and `gpu-path` folders hold the two outcome routes.

Earlier journey evidence is under `$HOME/workshop-trials/2026-09-23-*` and
`2026-09-24-*`. The tracker #1956 records each round's results.

## Open blockers and owners

| Blocker | Owner | Effect on users |
| --- | --- | --- |
| Human trials: none has run | maintainer, with the script below | agent acceptance only |
| Monitoring profile (#1984): runtime is proven on kind (#1981) and the profile is published. Released cub v0.5.5 ingested it into 27 Units on an isolated v0.5.5 server, and that receipt is still local. The pull request has one failing CI check, and its Guide corrections and artifact verification remain | backend | J3 uses the stack route, while per-listing compose of the operator waits on #1984 |
| cert-manager lifecycle (#1963): the web-platform cert-manager ships no CRDs | backend | the own-app stack check warns that cert-manager CRDs must already exist |
| Stale MySQL successor record in `data/chart-successions/chart-successions.yaml` | backend | the chart page says the successor is not yet a Catalog entry |
| Loki is in no shipped stack | backend | the platform path must add Loki by hand |
| Live Argo CD and Flux controller acceptance | backend, with a target cluster from the maintainer | handover checks are static only |
| GPU hardware proof | needs H100 or H200 access | GPU configuration is planning evidence only |
| The `lookup` list shows source callsites, and a callsite does not prove the template runs. For example, `cloudpirates.secrets.lookup` in CloudPirates mongodb 0.18.15 is defined but never called | backend (plugin wording) | a reader may chase an inert callsite; clearer wording is enough, and it does not block acceptance |
| No "push and the add-ons appear" platform layer | product decision | the site offers a parts list and checks, not a PaaS |

## Human trial facilitator script

This script is for observing one person with one journey. It runs for about 45 minutes. It measures whether a person reaches a useful result on their own configuration, and whether they understand what was checked and what ConfigHub adds. It is not a demo; the facilitator does not teach.

### Before the session (setup, not timed)

- **Consent.** Explain that you are testing the site, not the person. Get consent to take notes, and to record the screen if the person agrees. Nothing they bring is uploaded or kept unless they say so. Offer the fallback input instead of private files.
- **Their machine** needs `helm`, the `cub` CLI ([install](https://confighub.github.io/helm-expt/site/try.html#install-cub)), and a terminal. They may use their own AI assistant or none. Record which.
- **Choose one journey** with the person, from the problem they actually have. The table gives each starting point.

| Journey | Their problem | Starting page | Fallback input if they bring none |
| --- | --- | --- | --- |
| J1 | "I set a value and nothing changed" | home page | metrics-server 3.13.0 with a top-level `replicaCount: 2` |
| J2 | "An assistant rewrote my manifest" | home page | a Deployment plus an assistant rewrite that reverts hand fixes |
| J3 | "What does my app need from the platform?" | home page | a rendered app with an Ingress, a Certificate and a ServiceMonitor |
| J4 | "Argo CD or Flux is taking over a Helm release" | home page | CloudPirates postgres 0.20.6 values |
| J5 | "Will this Bitnami chart start?" | home page | Bitnami mysql 14.0.3 values |

The fallback inputs are kept with the agent acceptance evidence. Use them only when the person has nothing of their own, and record that you did.

### During the session (25 minutes, timed)

1. Say: *"Here is the problem as you described it. Start from this page and solve it the way you normally would. Think aloud. I will not help unless you are stuck."* Open the home page.
2. Do not point, suggest a command, or explain the site. If they ask a question, answer with *"What would you try?"*
3. Record each piece of help as you give it, at one of three levels.
   - Level 0 means no help.
   - Level 1 means a nudge that names no page or command, for example *"is there anything on the page about your own file?"*
   - Level 2 means you named a page or command, or took over.
4. Stop at 25 minutes or when they say they are done. Do not rescue the task.

### Debrief (10 minutes)

Ask these in this order and write down their words. Do not correct them.

1. What did you end up with, and would you commit it?
2. What exactly did the tool check? What would you still need to find out on a real cluster?
3. In your own words, what does "configuration as data" mean here?
4. What would ConfigHub add for you, if anything? When would you need it?
5. What confused you, or where did you nearly give up?
6. Would you use this again for your next change? What would make you?

### Score (after the session, from notes)

Score each item 0, 1 or 2: failed, completed with help, or completed independently.

| Item | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Useful, correct result on their input | | | |
| Kept their intent; no requirement lost | | | |
| Explains what was checked versus what a deployment would prove | | | |
| Explains configuration as data | | | |
| Identifies the ConfigHub next step without prompting | | | |
| Could continue next time from what they saved | | | |

Also record the date, the site commit, the plugin version, which assistant was used if any, the elapsed time, the help level, the route taken from the home page, and every error they could not explain.

### After the session

- With consent, check back after seven days: did they use it again? Record no response separately from confirmed non-use.
- Enter the results next to the agent acceptance table. **Keep them separate: agent trials never count as human acceptance.**
- A pilot journey passes human acceptance when both of two people reach a correct useful result, explain the basic model and name the next action without coaching. This is the adoption plan's threshold, not a market claim.
