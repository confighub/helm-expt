# Config Workshop AI and drift growth strategy

Date: 2026-08-12

This record decides what Config Workshop is for and how it should attract users who already have an AI assistant.

The decision rests on the two committed AI benchmark rounds. Static chart facts are easy to reproduce. Historical records are not.

## The decision

Config Workshop helps Kubernetes operators make a decision about an exact configuration when trust has become uncertain.

That moment usually arrives before an install, during an upgrade, or after environments stop matching.

The site should help the visitor do three things.

1. Inspect the exact configuration they are considering.
2. Check it against retained packages and dated receipts.
3. Keep the reviewed result when future changes must remain accountable.

The distinctive asset is custody. The site retains bytes, digests, old versions, test receipts, and known gaps.

An assistant can inspect the chart in front of it. It cannot recover a package that changed upstream or a revision nobody retained.

The free path produces a useful local result. ConfigHub starts when that result must become shared, changeable, and recoverable.

### Who the site serves

The primary visitor operates Kubernetes configuration and has a decision to make now.

They may use Helm, AICR, OCI, or plain Kubernetes YAML. Helm remains the strongest acquisition path because its failure modes are common.

The site also serves the visitor's assistant. Machine pages should help it resolve exact versions and cite evidence without guessing.

### What each visitor should do

| Visitor | Moment | One action |
| --- | --- | --- |
| Operator with a public chart | Before an install or upgrade | Find the exact version and run its local check. |
| Operator with an uncovered problem | During a Helm investigation | Generate a local report, then submit the public chart and exact question. |
| Team repeating the change | After choosing a reviewed result | Save that result in ConfigHub and follow the official tutorial. |
| AI assistant | While answering its user's question | Resolve the exact version, read declared coverage, and cite the receipt. |

### Keep one site with two layers

The site should stay on one domain. Separating the product front door from the evidence archive would weaken every claim.

The presentation should still have two clear layers.

| Layer | Purpose | Typical pages |
| --- | --- | --- |
| Action layer | Help a person answer one question and take one next step. | Home, Ask, Try, Catalog, ConfigHub |
| Evidence layer | Let people and tools inspect methods, receipts, refusals, and generated records. | Chart evidence, matrix, verification, known gaps, machine files |

The experimental label belongs to the methods and current coverage. Each receipt remains a specific record with a stated scope.

Growth should come from useful results before signup. The evidence archive makes those results credible, rather than competing with the product journey.

## Test the challenge flywheel

The current loop is prompt, local analysis, catalog lookup, public issue, and a future catalog entry.

It is worth testing, but its present form asks too much before the visitor receives a personal result.

### Where the current loop breaks

| Break | Consequence | Repair |
| --- | --- | --- |
| The prompt is long and generic. | A visitor must translate their problem into our workflow. | Generate a shorter prompt from the decision they select. |
| A public issue is a large request. | Private-chart users leave, while public-chart users may stop after the local answer. | Give the local answer first and make submission optional. |
| The page promises a checked entry. | An unbounded queue can break trust quickly. | Publish an acknowledgement target and a decision target. |
| `changes.json` lacks declared coverage. | An assistant may treat an absent verdict as a passing verdict. | Publish coverage families and canonical evidence URLs. |
| The issue records the artifact more clearly than the question. | Catalog growth follows charts without revealing user demand. | Capture a stable question code and the user's words. |
| Organic traffic is unknown. | Silence cannot distinguish weak demand from weak distribution. | Run a controlled outreach cohort for thirty days. |

### Replace it with a question-first evidence loop

Add a static `ask.html` page. It should run entirely in the browser until the visitor chooses to open a public issue.

The page asks what decision the visitor needs to make. It then asks for the public chart and exact version.

The page generates a tailored prompt for the visitor's assistant. The prompt returns a small structured finding with these fields.

| Field | Why it exists |
| --- | --- |
| `question_code` and `question` | Preserve the decision the visitor was trying to make. |
| `chart`, `version`, and `render_digest` | Bind the answer to exact input and output. |
| `catalog_match` and `coverage` | Show which Workshop records were available. |
| `findings` and `receipt_urls` | Separate computed observations from retained evidence. |
| `recommended_next_step` | Lead to a local command, a public submission, or ConfigHub. |

The issue link should carry this finding into the problem-chart template. The visitor still reviews every field before submission.

Private charts remain local. Public issues should never receive private values, repository URLs, credentials, or customer data.

Question capture cannot be passive without telemetry. The visitor must choose to submit the question or provide feedback.

### Use a thirty-day falsification test

Organic demand cannot be measured without approved analytics. Use a controlled cohort with a known denominator instead.

Send forty qualified invitations over thirty days. A qualified invitation reaches someone discussing a current problem with a public Helm chart.

Record only aggregate counts in the repository. Keep contact details and private conversations outside the public project.

The planning hypothesis is deliberately modest.

| Result | Thirty-day threshold |
| --- | --- |
| Public submissions | Four from forty invitations |
| Triage-ready submissions | Three with an exact question, chart, version, and reproduction |
| Closed loops | Two receive an entry, refusal, or evidence decision within seven days |
| User confirmation | One submitter confirms that the answer changed or confirmed their decision |

The approach fails its first test if fewer than three submissions are triage-ready.

It also fails if fewer than half of accepted submissions receive a decision within seven days.

A third failure signal appears when every submitter stops after the local answer and declines the public evidence step.

That last result would still validate the local tool. It would reject the demand-first catalog flywheel as the growth mechanism.

## Design the three entry points

### A person with a misbehaving chart

The first page should be `ask.html`, titled "Investigate a Helm problem with your AI."

It should start with the decision, then collect a public chart and version. The page generates the tailored local prompt.

The result should offer one next step.

| Result | Next step |
| --- | --- |
| Checked catalog entry exists | Compare the assistant's answer with its receipts. |
| Public chart has no entry | Review and submit the generated problem-chart issue. |
| Configuration is private | Keep the report local and use local tools. |
| Team needs a durable record | Save the reviewed objects in ConfigHub. |

`cub installer` is the handoff when the catalog already publishes a package. Plain Helm remains valid for an uncovered chart.

### An AI assistant pointed at the site

The assistant should open `llms.txt`, then resolve the chart through the versioned machine contract.

The contract needs four things that the current feed does not provide together.

| Requirement | Contract behavior |
| --- | --- |
| Exact identity | Publish chart, version, aliases, and canonical URL. |
| Declared coverage | Name each verdict family as checked, unchecked, or unavailable. |
| Citable evidence | Publish receipt URLs beside each checked family. |
| Stable meaning | Validate the schema and change its major version when meanings break. |

The assistant should return a local command when static analysis is enough. It should suggest ConfigHub when the question needs history or shared state.

### A search or answer-engine arrival

Search visitors should land on a page matching the question they asked, rather than a general product page.

Four focused drift sections can share one generated page. Each section needs one example, one receipt, and one action.

The titles should match ordinary questions.

| Search question | First action |
| --- | --- |
| Why did Helm ignore my values? | Run the per-key render comparison. |
| Did this chart version change upstream? | Check the retained and current digests. |
| Why do development and production differ? | Compare recorded variants and promotion history. |
| Does the cluster match what we approved? | Open the desired-versus-live evidence and its limits. |

Each page should end with the same three boundary labels already used across the site.

## Sequence the four kinds of drift

The site should present drift in the order a configuration acquires history.

| Drift stage | User problem | Current value | Boundary | Evidence needed before louder claims |
| --- | --- | --- | --- | --- |
| Pre-deploy drift | The chart is unread, or a values key changes nothing. | Render exact objects and compare each supplied key. | Runs on your laptop | Prove exhaustive supplied-key checks beyond the current example. |
| Supply drift | A version string points at changed or unavailable bytes. | Retain exact packages and publish dated digest witnesses. | Runs on your laptop | Run recurring sweeps before making present-tense claims. |
| Environment drift | Development and production no longer share a clear lineage. | Store variants and promote reviewed changes. The matrix reports 179 promotion-proven rows. | Needs a ConfigHub account | Add one complete development-to-production story with deletion behavior. |
| Runtime drift | Live objects differ from reviewed desired state. | Compare desired and observed state where current receipts cover the fields. | Needs an account and a cluster | Expand field coverage and close pruning and conflict gaps. |

The first two stages earn attention and trust. They should remain useful before a visitor creates an account.

Environment drift is the clearest product conversion. ConfigHub keeps the reviewed result and its changes across environments.

Runtime drift supports fleet and enterprise value. The site should keep this claim narrower until its field and convergence evidence improves.

## Prioritized backlog

| Rank | Issue | Change | Acceptance |
| --- | --- | --- | --- |
| 1 | #1537 and #1539 | Build the question-first `ask.html` page and generated prompt. | Local-only operation, stable question code, public issue handoff, and private-chart boundary. |
| 2 | #1538 | Finish the machine contract already started by `schema_version`. | JSON Schema, coverage families, aliases, canonical URLs, receipt URLs, consumer gate, and compatibility text. |
| 3 | #1251 | Put the custody position and four drift stages on the home journey. | One purpose, three visitor actions, and a direct ConfigHub handoff without enlarging the hero. |
| 4 | #1537 | Run the receiving operation and thirty-day test. | Triage label, acknowledgement target, decision target, monthly aggregate, and close-the-loop comment. |
| 5 | #1540 | Publish the retention promise and computed corpus value. | Retained-version count, oldest date, replaced byte-pair count, license gate, and additive-only policy. |
| 6 | #1406 | Make catalog coverage answer the visitor's question. | Each chart page names checked families and links the matching receipts. |
| 7 | #1251 | Prove one exact handoff from local result into ConfigHub. | The same digest is visible before upload and in the saved base, followed by one official tutorial step. |
| 8 | #15 | Add the existing-release diagnostic to the misbehaving-chart path. | Show prior Helm release state, likely upgrade hazards, and evidence limits. |
| 9 | New issue below | Add generated search sections for the four drift questions. | Each section has one example, one receipt, one action, and a canonical URL. |
| 10 | #949 | Keep runtime drift claims aligned with shipped remediation evidence. | Field coverage, pruning, conflict behavior, and live convergence remain explicit per path. |

### New issue draft

**Title:** Add search entry pages for the four configuration drift questions

**Body:**

Config Workshop now leads with configuration drift, but search visitors still land on broad pages.

Generate one focused entry for each stage: pre-deploy, supply, environment, and runtime drift.

Each entry must answer one ordinary question. It must link one receipt and offer one next action.

Use the existing boundary labels. Keep runtime claims scoped to current desired-versus-live field coverage.

Acceptance requires canonical URLs, machine links in `llms.txt`, and the existing site verification gates.

Umbrella: #1251.

## Draft copy for the first three changes

### Rank 1 copy for the Ask page

**Page title**

Investigate a Helm problem with your AI

**Lead**

Start with the decision you need to make. Choose a question, add a public chart and version, then give the generated prompt to your assistant.

Your assistant renders the chart locally. It tests your values and checks this catalog for retained bytes and receipts.

Private values stay on your laptop. You choose whether to file a public question.

**Form labels**

- What are you trying to decide?
- Which public chart and version are involved?
- What did you expect to happen?

**Buttons**

- Build my prompt
- Check the catalog
- File the public question

**Proposed response promise**

We acknowledge public submissions within two business days. We post an entry, refusal, or evidence decision within seven days.

Publish that sentence only after the receiving owner accepts the timing.

### Rank 2 copy for `llms.txt`

```text
## Machine contract

Use changes.json to resolve an exact chart and version. Its schema_version defines the field meanings.

Read coverage before citing a verdict. Missing coverage means we have not checked that claim.

Use the canonical chart URL and cite the receipt URLs. Page copy is a guide, while receipts hold the evidence.

Schema version 1 keeps existing field meanings stable. A breaking change uses a new major version.

When an entry is absent, render locally. Ask the user before filing a public issue.
```

### Rank 3 copy for the home page

**Headline**

Detect and Stop Config Drift

**Lead**

Helm and AI can tell you what a chart renders today. They cannot recover bytes, decisions, or prior state that nobody kept.

Config Workshop keeps reviewed packages and receipts. Use them to check an exact version, then pin the result you chose.

Save it in ConfigHub when your team needs shared changes, promotion, or rollback.

**Primary actions**

- Check an exact chart
- Investigate a Helm problem
- Keep a reviewed result

**Drift sequence**

Check what will render. Pin the bytes you reviewed. Keep environments related. Compare approved state with the live cluster.

Use the existing boundary labels beneath the action that needs each level.

## What this strategy deliberately rejects

The Workshop should not compete with a capable assistant on static chart explanation.

It should not build a general private-chart upload service before the local prompt produces measurable demand.

It should not make runtime drift the main promise while field coverage and convergence evidence remain partial.

The durable position is simpler. Assistants compute from current bytes. Config Workshop and ConfigHub keep the records they will need later.
