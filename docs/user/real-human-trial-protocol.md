# Run a real-human trial of the site

Two synthetic audit rounds shaped the site, and their fixes are merged. The one loop no audit closes is a real person walking the path. This protocol makes that trial repeatable: twenty minutes, one link, one feedback issue. Send the link, and the protocol does the rest.

## Who to ask

Anyone who uses Helm or operates Kubernetes and has not worked on this site. The first trials should include one person who has never heard of ConfigHub, because the site's first job is to convert exactly that visitor. Do not brief them beyond the invitation below; a briefed visitor cannot stall where a real one would.

## The invitation

Send this text and the site link, and nothing else.

> Please spend twenty minutes on this site, starting at the front page. Bring a chart you actually use, or pick one there. Try to answer one real question you have about it, and stop when you have an answer, an account of why you cannot get one, or twenty minutes have passed. Then file the feedback form linked in the footer, or the Site trial feedback issue template on the repository. Honest friction beats politeness.

## The script the visitor follows

The visitor does not need this section; it describes what the invitation produces.

1. Arrive cold on the front page. The first stall, if any, is usually here, and the feedback form asks for it.
2. Choose a starting question, or search for a chart they use.
3. Try to reach one answer: what a chart installs, whether a configuration is right, whether a change can be promoted, or what the platform story is.
4. Decide what they would do next in real work, and say so in the form.

## What one trial yields

The feedback template captures five facts: the outcome, the minutes it took, the first stall with the exact sentence or control that caused it, anything distrusted, and what the visitor would do next in real work. Three trials are enough to see a pattern; the audits predicted the stalls, and the trials test the predictions.

## How to read the results

- A stall names a page and a sentence. Fix the sentence, not the visitor.
- Distrust findings outrank stalls. The site's whole differentiator is that its honesty earns trust, so a claim that reads as too strong is the most important defect it can have.
- "I would not act on this answer" with a reason is the best possible outcome short of success. It names the missing evidence.
- Keep the raw issues open until each named stall is fixed or explicitly declined, the same discipline the roadmap uses.

## Boundaries

- No analytics or tracking are added to the site; feedback arrives only through the issue template.
- The trial tests the site, not the visitor. There is no task-completion score, and the form never asks the visitor to justify themselves.
- Trials are anonymous in the record. The background line is one sentence, and no names are recorded in the repository.
