# Public-site persona simulations

Site tested: http://127.0.0.1:8766/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after five clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 180 | 177 | 3 | 0 | 97/180 | 53/83 | 0 |
| GitOps operator responsible for delivery | 180 | 166 | 14 | 0 | 85/180 | 58/95 | 1 |
| Platform engineer managing environments and fleets | 180 | 168 | 12 | 0 | 90/180 | 65/90 | 1 |
| Security-minded release reviewer | 180 | 160 | 20 | 0 | 64/180 | 93/116 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 137 | 7 | 0 |
| navigation | 144 | 0 | 0 |
| action | 140 | 4 | 0 |
| recovery | 121 | 23 | 0 |
| conversion | 129 | 15 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| Helm | 547 | 47 | 0 |
| AICR | 18 | 0 | 0 |
| OCI | 52 | 2 | 0 |
| YAML | 27 | 0 | 0 |
| mixed | 27 | 0 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| block placeholder credentials | 1 | 8 | 0 |
| find delivery limitations | 4 | 5 | 0 |
| audit an exact diff | 4 | 5 | 0 |
| keep configuration history | 5 | 4 | 0 |
| handle CRDs on first install | 6 | 3 | 0 |
| understand rollback proof | 6 | 3 | 0 |
| promote and publish a release | 7 | 2 | 0 |
| roll back a promoted release | 7 | 2 | 0 |
| pause or inspect a rollout wave | 7 | 2 | 0 |
| understand checked versus not checked | 7 | 2 | 0 |
| handle CRD ordering risk | 7 | 2 | 0 |
| write reviewed objects as OCI | 8 | 1 | 0 |
| save a reviewed result for my team | 8 | 1 | 0 |
| compare development and production | 8 | 1 | 0 |
| render and inspect without applying | 8 | 1 | 0 |

## Navigation language

These are synthetic forced-choice trials, not observed preferences.

| Preferred label | Count |
| --- | ---: |
| Check my config | 39 |
| Investigate | 21 |
| Compare | 16 |
| Help with a chart | 4 |

The current label `Check my config` was preferred in 39 of 80 synthetic trials. The page itself must explain that it builds a prompt for the visitor's own AI assistant; the navigation label does not have to carry that whole explanation.

## Change from baseline

The baseline and candidate use the same personas, goals, starting pages, click limit, and scoring rules.

| Measure | Baseline | Candidate | Change |
| --- | ---: | ---: | ---: |
| Successful journeys | 692/720 | 671/720 | -21 |
| Partial journeys | 28/720 | 49/720 | +21 |
| Failed journeys | 0/720 | 0/720 | 0 |
| Answered on starting page | 312/720 | 336/720 | +24 |
| Useful first click when needed | 288/408 (70.6%) | 269/384 (70.1%) | -0.5 points |
