# Public-site persona simulations

Site tested: https://confighub.github.io/helm-expt/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after five clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 180 | 157 | 21 | 2 | 79/180 | 59/101 | 1 |
| GitOps operator responsible for delivery | 180 | 154 | 26 | 0 | 75/180 | 65/105 | 1 |
| Platform engineer managing environments and fleets | 180 | 160 | 20 | 0 | 71/180 | 67/109 | 1 |
| Security-minded release reviewer | 180 | 156 | 24 | 0 | 54/180 | 81/126 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 123 | 21 | 0 |
| navigation | 140 | 4 | 0 |
| action | 138 | 6 | 0 |
| recovery | 103 | 39 | 2 |
| conversion | 123 | 21 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| Helm | 514 | 78 | 2 |
| AICR | 18 | 0 | 0 |
| OCI | 41 | 13 | 0 |
| YAML | 27 | 0 | 0 |
| mixed | 27 | 0 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| recover when my chart is missing | 0 | 9 | 0 |
| understand checked versus not checked | 1 | 8 | 0 |
| block placeholder credentials | 1 | 8 | 0 |
| find delivery limitations | 2 | 7 | 0 |
| compare desired and live state | 2 | 7 | 0 |
| understand OCI in and OCI out | 3 | 6 | 0 |
| understand base and derived variants | 3 | 6 | 0 |
| audit an exact diff | 4 | 5 | 0 |
| write reviewed objects as OCI | 5 | 4 | 0 |
| promote a reviewed change | 5 | 4 | 0 |
| pause or inspect a rollout wave | 5 | 4 | 0 |
| find live drift | 5 | 4 | 0 |
| find an existing OCI package example | 6 | 3 | 0 |
| handle CRDs on first install | 6 | 3 | 0 |
| keep a private configuration private | 7 | 0 | 2 |

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

