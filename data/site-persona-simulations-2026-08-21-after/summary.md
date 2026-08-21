# Public-site persona simulations

Site tested: http://127.0.0.1:8766/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after five clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 180 | 177 | 3 | 0 | 103/180 | 50/77 | 0 |
| GitOps operator responsible for delivery | 180 | 175 | 5 | 0 | 91/180 | 58/89 | 0 |
| Platform engineer managing environments and fleets | 180 | 175 | 5 | 0 | 95/180 | 58/85 | 0 |
| Security-minded release reviewer | 180 | 176 | 4 | 0 | 77/180 | 79/103 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 143 | 1 | 0 |
| navigation | 144 | 0 | 0 |
| action | 140 | 4 | 0 |
| recovery | 136 | 8 | 0 |
| conversion | 140 | 4 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| Helm | 578 | 16 | 0 |
| AICR | 18 | 0 | 0 |
| OCI | 53 | 1 | 0 |
| YAML | 27 | 0 | 0 |
| mixed | 27 | 0 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| handle CRDs on first install | 7 | 2 | 0 |
| handle CRD ordering risk | 7 | 2 | 0 |
| write reviewed objects as OCI | 8 | 1 | 0 |
| save a reviewed result for my team | 8 | 1 | 0 |
| compare development and production | 8 | 1 | 0 |
| render and inspect without applying | 8 | 1 | 0 |
| deliver with kubectl | 8 | 1 | 0 |
| find delivery limitations | 8 | 1 | 0 |
| assign configuration to a fleet | 8 | 1 | 0 |
| understand fleet rollout | 8 | 1 | 0 |
| roll back a promoted release | 8 | 1 | 0 |
| pause or inspect a rollout wave | 8 | 1 | 0 |
| operate a small fleet | 8 | 1 | 0 |
| block placeholder credentials | 8 | 1 | 0 |
| audit an exact diff | 8 | 1 | 0 |

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
| Successful journeys | 702/720 | 703/720 | +1 |
| Partial journeys | 18/720 | 17/720 | -1 |
| Failed journeys | 0/720 | 0/720 | 0 |
| Answered on starting page | 358/720 | 366/720 | +8 |
| Useful first click when needed | 249/362 (68.8%) | 245/354 (69.2%) | 0.4 points |
