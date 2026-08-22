# Public-site persona simulations

Site tested: http://127.0.0.1:8766/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after five clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 180 | 180 | 0 | 0 | 97/180 | 56/83 | 0 |
| GitOps operator responsible for delivery | 180 | 180 | 0 | 0 | 91/180 | 58/89 | 0 |
| Platform engineer managing environments and fleets | 180 | 180 | 0 | 0 | 102/180 | 60/78 | 0 |
| Security-minded release reviewer | 180 | 180 | 0 | 0 | 73/180 | 79/107 | 1 |

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
| Check my config | 38 |
| Investigate | 21 |
| Compare | 16 |
| Help with a chart | 4 |
| Ask | 1 |

The current label `Ask` was preferred in 1 of 80 synthetic trials. The page itself must explain that it builds a prompt for the visitor's own AI assistant; the navigation label does not have to carry that whole explanation.
