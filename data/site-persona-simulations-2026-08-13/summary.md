# Public-site persona simulations

Site tested: https://confighub.github.io/helm-expt/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after five clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 180 | 177 | 3 | 0 | 95/180 | 57/85 | 0 |
| GitOps operator responsible for delivery | 180 | 167 | 13 | 0 | 76/180 | 70/104 | 1 |
| Platform engineer managing environments and fleets | 180 | 173 | 7 | 0 | 77/180 | 67/103 | 1 |
| Security-minded release reviewer | 180 | 175 | 5 | 0 | 64/180 | 94/116 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 140 | 4 | 0 |
| navigation | 144 | 0 | 0 |
| action | 141 | 3 | 0 |
| recovery | 130 | 14 | 0 |
| conversion | 137 | 7 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| Helm | 568 | 26 | 0 |
| AICR | 18 | 0 | 0 |
| OCI | 52 | 2 | 0 |
| YAML | 27 | 0 | 0 |
| mixed | 27 | 0 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| find delivery limitations | 2 | 7 | 0 |
| promote and publish a release | 7 | 2 | 0 |
| roll back a promoted release | 7 | 2 | 0 |
| understand checked versus not checked | 7 | 2 | 0 |
| write reviewed objects as OCI | 8 | 1 | 0 |
| save a reviewed result for my team | 8 | 1 | 0 |
| promote a reviewed change | 8 | 1 | 0 |
| deliver with kubectl | 8 | 1 | 0 |
| understand OCI in and OCI out | 8 | 1 | 0 |
| handle CRDs on first install | 8 | 1 | 0 |
| compare desired and live state | 8 | 1 | 0 |
| assign configuration to a fleet | 8 | 1 | 0 |
| understand fleet rollout | 8 | 1 | 0 |
| pause or inspect a rollout wave | 8 | 1 | 0 |
| require approval for production | 8 | 1 | 0 |

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

