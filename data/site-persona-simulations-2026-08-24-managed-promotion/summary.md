# Public-site persona simulations

Site tested: http://127.0.0.1:8766/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after 3 clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 264 | 246 | 6 | 12 | 127/264 | 82/137 | 1 |
| GitOps operator responsible for delivery | 264 | 222 | 41 | 1 | 114/264 | 87/150 | 1 |
| Platform engineer managing environments and fleets | 264 | 235 | 29 | 0 | 130/264 | 100/134 | 1 |
| Security-minded release reviewer | 264 | 218 | 45 | 1 | 92/264 | 117/172 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 196 | 12 | 1 |
| navigation | 197 | 12 | 0 |
| action | 206 | 56 | 13 |
| recovery | 150 | 26 | 0 |
| conversion | 172 | 15 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| AICR | 22 | 0 | 0 |
| Helm | 714 | 98 | 13 |
| OCI | 57 | 8 | 1 |
| Timoni | 34 | 10 | 0 |
| YAML | 41 | 3 | 0 |
| mixed | 53 | 2 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| ask my AI to review a destination-specific promotion | 1 | 0 | 10 |
| check current evidence before approving a move | 1 | 10 | 0 |
| check lifecycle work before the next environment | 2 | 9 | 0 |
| compare desired and live state | 2 | 9 | 0 |
| review ordered stages and a partial fleet | 2 | 9 | 0 |
| follow a retained base through staging approval release and delivery | 2 | 9 | 0 |
| check which destination claims have live evidence | 2 | 9 | 0 |
| understand partial drift coverage | 3 | 8 | 0 |
| handle CRD ordering risk | 3 | 8 | 0 |
| check a lifecycle-heavy upgrade against its destination | 4 | 6 | 1 |
| distinguish object, OCI manifest, and release identities | 5 | 5 | 1 |
| find a reviewed Timoni Redis configuration | 6 | 5 | 0 |
| find live drift | 6 | 5 | 0 |
| distinguish source, rendered, and ConfigHub release OCI | 8 | 3 | 0 |
| find a Timoni configuration carried through OCI | 8 | 3 | 0 |

## Navigation language

These are synthetic forced-choice trials, not observed preferences.

| Preferred label | Count |
| --- | ---: |
| Check my config | 39 |
| Investigate | 21 |
| Compare | 16 |
| Help with a chart | 4 |

The current label `Check my config` was preferred in 39 of 80 synthetic trials. The page itself must explain that it builds a prompt for the visitor's own AI assistant; the navigation label does not have to carry that whole explanation.
