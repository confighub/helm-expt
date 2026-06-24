# House layout

**UNOFFICIAL/EXPERIMENTAL.** How every page is shaped. Companion to
[house-voice.md](./house-voice.md) — that one governs the words, this one the layout.
Reference exemplar: <https://hall.kvick.dev/> — a Kubernetes-tool landing page that is
simple and good.

## Principles

1. **Narrow prose.** Hold reading columns to about 60 characters and centre them, even
   inside a wide section. Width is for layout, not for text.
2. **Hairline sections.** Separate sections with one thin rule and generous vertical
   space — not nested boxes or stacked heavy cards.
3. **Commands as a terminal card.** Show every CLI block in a styled terminal — a small
   title bar plus a monospace body, annotated with `#` comments per step. Never a bare
   code fence. This is the single biggest upgrade for the helm-vs-cub blocks (pattern below).
4. **Two-column hero.** Lead with the message on one side and the actual commands (a
   terminal card) on the other; collapse to one column when narrow.
5. **Cards in a light grid.** Steps and options go in a simple responsive grid with
   *subtle* elevation — a thin border and a soft surface, never heavy borders, drop
   shadows, or glow.
6. **One accent, two fonts.** A neutral body font plus one display font for headings; a
   single accent colour; restraint everywhere.
7. **Tasteful motion only.** A short fade-in on load is plenty. No glow, no parallax, no
   flashy effects.

## Theme

Keep our light, clean surface — it carries the experimental banner and reads well. Borrow
hall's *structure*, not its dark palette.

## The terminal-card pattern

A rounded panel with two parts:

- **Title bar** — the context for the commands, e.g. `prometheus → monitoring`, in muted
  monospace, with a hairline under it.
- **Body** — monospace, comfortable line-height. `#` comments are muted; the `$` prompt and
  command are primary text; long commands use `\` line-continuation so they wrap cleanly.

One card can hold both paths (a `# plain Helm` block and a `# ConfigHub` block), so the
reader sees the comparison in one frame.

## Where to apply, in order

1. **Get Started** (`try.html`) — two-column hero (parity message ↔ terminal card), then the
   two-step explanation, then the cards. Copy in [get-started-rewrite-brief.md](./get-started-rewrite-brief.md).
2. **Serverless** (`serverless.html`) — the same spine; render from
   [serverless-mode.md](../user/serverless-mode.md).
3. **Chart pages** — terminal cards for the try commands; move the `Generated at:` timestamp
   out of the headline into the footer (build exhaust never opens a page — voice rule 7).
4. The homepage hero and journey cards.

## How to check

Read a finished page once: is the prose narrow and centred, are commands in terminal cards,
are sections separated by a single hairline, is there one accent colour and plenty of
whitespace? If any answer is no, it is not in the layout yet.
