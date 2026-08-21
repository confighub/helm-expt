# Public-site persona simulations

Site tested: http://127.0.0.1:8766/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after five clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 180 | 180 | 0 | 0 | 104/180 | 51/76 | 0 |
| GitOps operator responsible for delivery | 180 | 180 | 0 | 0 | 93/180 | 61/87 | 0 |
| Platform engineer managing environments and fleets | 180 | 180 | 0 | 0 | 97/180 | 63/83 | 0 |
| Security-minded release reviewer | 180 | 180 | 0 | 0 | 78/180 | 79/102 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 144 | 0 | 0 |
| navigation | 144 | 0 | 0 |
| action | 144 | 0 | 0 |
| recovery | 144 | 0 | 0 |
| conversion | 144 | 0 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| Helm | 594 | 0 | 0 |
| AICR | 18 | 0 | 0 |
| OCI | 54 | 0 | 0 |
| YAML | 27 | 0 | 0 |
| mixed | 27 | 0 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |

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
| Successful journeys | 703/720 | 720/720 | +17 |
| Partial journeys | 17/720 | 0/720 | -17 |
| Failed journeys | 0/720 | 0/720 | 0 |
| Answered on starting page | 366/720 | 372/720 | +6 |
| Useful first click when needed | 245/354 (69.2%) | 254/348 (73.0%) | 3.8 points |
