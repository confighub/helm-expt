# Public-site persona simulations

Site tested: https://confighub.github.io/helm-expt/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after five clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 180 | 169 | 11 | 0 | 101/180 | 50/79 | 0 |
| GitOps operator responsible for delivery | 180 | 170 | 10 | 0 | 94/180 | 51/86 | 0 |
| Platform engineer managing environments and fleets | 180 | 169 | 11 | 0 | 90/180 | 58/90 | 1 |
| Security-minded release reviewer | 180 | 159 | 21 | 0 | 66/180 | 84/114 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 137 | 7 | 0 |
| navigation | 144 | 0 | 0 |
| action | 140 | 4 | 0 |
| recovery | 116 | 28 | 0 |
| conversion | 130 | 14 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| Helm | 543 | 51 | 0 |
| AICR | 18 | 0 | 0 |
| OCI | 52 | 2 | 0 |
| YAML | 27 | 0 | 0 |
| mixed | 27 | 0 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| keep a private configuration private | 0 | 9 | 0 |
| block placeholder credentials | 1 | 8 | 0 |
| find delivery limitations | 3 | 6 | 0 |
| audit an exact diff | 3 | 6 | 0 |
| keep configuration history | 4 | 5 | 0 |
| understand rollback proof | 6 | 3 | 0 |
| understand checked versus not checked | 7 | 2 | 0 |
| handle CRD ordering risk | 7 | 2 | 0 |
| write reviewed objects as OCI | 8 | 1 | 0 |
| save a reviewed result for my team | 8 | 1 | 0 |
| render and inspect without applying | 8 | 1 | 0 |
| deliver with kubectl | 8 | 1 | 0 |
| understand OCI in and OCI out | 8 | 1 | 0 |
| compare desired and live state | 8 | 1 | 0 |
| assign configuration to a fleet | 8 | 1 | 0 |

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
