# First-use and browser follow-up

Release tested: `ae083116d235270c459d6e87a72c9c07a287f4d9` (#1896).
Plugin source: `56e261a87dc3b060a86474bc796d379dd9bb7f3d` (0.6.21).
Tracked by #1897. This is a small agent trial and an operator browser check,
not human acceptance or a population estimate.

## Plugin setup

One fresh assistant installed the pinned checkout into an isolated cub config,
then ran `cub config check redis`. Both exited zero; the check reported 14
objects and a required redis namespace. cub v0.4.4 was already installed.
Fresh CLI installation remains untested. Clone and checkout were part of setup,
but their durations were not captured separately; the reported install-command
latency is not total setup time. The trial did not produce the exact Catalog
lookup envelope used by mission M1 and does not count as another M1 pass.

The original report is retained with paths normalized. Its installer-versus-
Workshop observation is a navigation detour, not an incompatible instruction:
the installer walkthrough and Workshop inspection are different valid tasks.
Likewise, default Redis and reuse-existing-secret are distinct configurations.
No evidence supports changing their object counts to agree.

## Browser check

The in-app browser opened the published Redis chart page and found the exact
inspection JSON link. The supported download action returned without error,
but exposed no saved artifact path. Neither expected filename existed in the
normal Downloads location. Downloaded bytes therefore remain UNVERIFIED;
a successful method return is not a saved-file acceptance pass.

At a 390 by 844 viewport, the published homepage and Compose Guide each had
390-pixel document width, with no page-wide horizontal overflow. The Guide's
assistant heading was approximately 4,013 pixels below its top, with no early
direct route. The follow-up adds a jump link before setup in seven Guides,
while explicitly retaining setup as a prerequisite. Code blocks may scroll
horizontally; that is distinct from page overflow. This limited observation
is not a full accessibility audit or keyboard acceptance.

Browser tabs used the existing profile, not a clean profile. The temporary
viewport override was reset after the check. No deployment, target access,
ConfigHub mutation, or live recovery was performed.

## Remaining acceptance

Actual saved browser bytes, clean CLI installation, mixed-history unassisted
recovery, concise CLI refusal output, keyboard/accessibility coverage and human
mission observations remain open in #1897. Hosted live-chat acceptance remains
separate in #1861. The successful guided recovery regressions in the preceding
round do not close the unassisted recovery item.

## Retention

`retention.json` records original and retained file hashes. Absolute trial and
home paths were normalized to `$TRIAL` and `$HOME`; trailing whitespace was removed; result content was not corrected.
The participant report and result are observations, qualified above.

Candidate browser follow-up: at the normal viewport, the shortcut resolved to
the assistant heading with its top at approximately zero pixels. At 390 pixels,
two tool-driven clicks left the hash empty and did not scroll. The mobile
shortcut interaction therefore remains unresolved, despite valid anchors and
no page overflow. Do not treat the desktop result as mobile acceptance.

Keyboard activation of the shortcut at 390 pixels did resolve the hash and
placed the heading at approximately zero pixels. The inline link wrapped
across two lines in the first candidate; the final copy starts the paragraph
with the shorter link to avoid that wrapping. This is a targeted keyboard
activation check, not a full tab-order or screen-reader audit.

Final candidate: with the shortened link first in its paragraph, a browser
click at 390 by 844 resolved `#a-task-for-an-ai-assistant`, moved the heading
to -0.16 pixels (rounding around zero), and kept document width at 390 pixels.
This passes the targeted mobile shortcut check; the earlier failed clicks
remain recorded above.
