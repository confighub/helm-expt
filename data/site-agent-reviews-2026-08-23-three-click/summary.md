# Three-click agent review

Four low-cost agents modeled 150 first-use journeys each against the public
Config Workshop site. Each journey stopped after three internal clicks. These
are synthetic reviews, not observed human behavior.

| Visitor | Concrete answer | Partial answer | Failed or blocked |
| --- | ---: | ---: | ---: |
| Application developer with AI-written configuration | 78 | 45 | 27 |
| GitOps operator | 118 | 32 | 0 |
| Platform engineer starting from several source formats | 119 | 21 | 10 |
| Release and security reviewer | 108 | 24 | 18 |
| **Total** | **423** | **122** | **55** |

The agents used different task mixes, so the total is a coverage count rather
than a comparison between personas.

## What worked

- Catalog, Check my config, Promote my config, and ConfigHub usually had
  distinct purposes.
- Helm users could find tested configurations, inspect rendered objects, and
  ask why values were ignored.
- The deeper pages distinguish source records, exact objects, lifecycle work,
  OCI transport, ConfigHub records, and live observations.
- The promotion page states which comparisons run in the browser and which
  tests still need a real destination.

## Repeated problems

1. A Catalog search with no result did not give the visitor a direct recovery
   message.
2. Timoni was recorded and tested but was harder to find than Helm, AICR, OCI,
   or YAML.
3. Hooks, CRDs, destination requirements, and current evidence were often one
   link farther away than the promotion question.
4. The browser check required a Catalog source-and-intent record to add known
   lifecycle work, but the chart-and-version form did not offer an immediate
   Catalog search.
5. Several partial results were real capability boundaries: the browser does
   not contact Kubernetes, execute hooks, operate rollout waves, or undo
   external effects. Better wording cannot turn those checks into proof.

## Decisions from this review

- Keep Helm as the main public entry point. Do not replace the homepage with
  five equal source-format doors.
- Add Timoni to the secondary Examples path and to the browser input selector.
- Give a zero-result Catalog search a direct Check my config action.
- Put Catalog search, lifecycle guidance, and current-evidence links beside the
  questions that need them.
- Keep product limits visible. Record them as missing capability or evidence,
  not as navigation failures.

One agent reported that six generated pages were absent from the local
checkout. A direct filesystem check found all six pages, so that finding was
discarded.
