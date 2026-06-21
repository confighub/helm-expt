# Outside User Test

_A UX test (outside-user) in the [helm-expt test map](../../tests/README.md)._

This is a short test protocol for a Helm user who has not worked on helm-expt.
The goal is to find out whether the public surface explains the product without
inside context.

Run this test with a real person. Do not coach them except where the script says
to answer a question.

## Participant

Pick someone who knows Helm and Kubernetes, but does not know this repo.

Record:

```text
name:
role:
Helm experience:
Kubernetes experience:
ConfigHub experience:
date:
repo commit:
```

## Setup

Give the participant the repository URL and the generated public site path:

```text
https://github.com/confighub/helm-expt
site/try.html
```

If they want to run commands, they need Node and a shell. They do not need an
npm install step.

## Fifteen-Minute Script

1. Start at `site/try.html`.
2. Find the Redis catalog entry.
3. Identify the recommended Redis variant.
4. Open the rendered objects for that variant.
5. Open the proof status for that variant.
6. Run one local verification command from [Verify It Yourself](../user/verify-it-yourself.md).
7. Read [Why Synced Is Not Working](../user/why-synced-is-not-working.md).
8. Open [Top-100 Coverage](../../data/top100-coverage/summary.md).

Do not explain the model first. The page should carry the first pass.

## Questions

Ask these after the participant finishes the script:

1. What problem is helm-expt trying to solve?
2. What is proven for Redis?
3. What is not proven?
4. Where would you look for a different chart?
5. What would make you trust this enough to try it on one of your charts?
6. Which part felt too complicated?
7. Which part, if any, would be worth paying for?

## Target Outcomes

| Task | Target |
| --- | --- |
| Explain the purpose | Under 2 minutes. |
| Find Redis variants | Under 2 minutes. |
| Find rendered objects and proof status | Under 3 minutes. |
| Run one verification command | Under 5 minutes after cloning. |
| State one current limitation | Participant can name at least one limitation without prompting. |

## Results Template

```text
participant:
commit:
time_to_purpose:
time_to_redis_variant:
time_to_rendered_objects:
time_to_verification:
wrong_turns:
unclear_words:
trusted_claims:
untrusted_claims:
would_try:
would_pay_for:
notes:
```

## Follow-Up

File findings as repo issues when they change the product surface:

```text
unclear first page
variant not findable
proof status hard to interpret
command failed
claim sounded too broad
paid/free boundary unclear
```

