# Public-site persona simulations

Site tested: https://confighub.github.io/helm-expt/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after 3 clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 253 | 242 | 9 | 2 | 122/253 | 86/131 | 1 |
| GitOps operator responsible for delivery | 253 | 211 | 42 | 0 | 100/253 | 88/153 | 1 |
| Platform engineer managing environments and fleets | 253 | 232 | 21 | 0 | 123/253 | 89/130 | 1 |
| Security-minded release reviewer | 253 | 207 | 45 | 1 | 85/253 | 116/168 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 194 | 14 | 1 |
| navigation | 188 | 21 | 0 |
| action | 188 | 41 | 2 |
| recovery | 150 | 26 | 0 |
| conversion | 172 | 15 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| AICR | 22 | 0 | 0 |
| Helm | 702 | 77 | 2 |
| OCI | 57 | 8 | 1 |
| Timoni | 16 | 28 | 0 |
| YAML | 42 | 2 | 0 |
| mixed | 53 | 2 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| check lifecycle work before the next environment | 1 | 10 | 0 |
| check current evidence before approving a move | 1 | 10 | 0 |
| find a Timoni configuration carried through OCI | 2 | 9 | 0 |
| compare desired and live state | 2 | 9 | 0 |
| review ordered stages and a partial fleet | 2 | 9 | 0 |
| inspect the Timoni publication receipt | 2 | 9 | 0 |
| handle CRD ordering risk | 2 | 9 | 0 |
| understand partial drift coverage | 3 | 8 | 0 |
| find a reviewed Timoni Redis configuration | 4 | 7 | 0 |
| distinguish object, OCI manifest, and release identities | 5 | 5 | 1 |
| find live drift | 6 | 5 | 0 |
| distinguish source, rendered, and ConfigHub release OCI | 8 | 3 | 0 |
| store the reviewed configuration | 8 | 3 | 0 |
| find the Timoni Redis base and development variant | 8 | 3 | 0 |
| check whether my exact change can move safely | 9 | 0 | 2 |

## Navigation language

These are synthetic forced-choice trials, not observed preferences.

| Preferred label | Count |
| --- | ---: |
| Check my config | 39 |
| Investigate | 21 |
| Compare | 16 |
| Help with a chart | 4 |

The current label `Check my config` was preferred in 39 of 80 synthetic trials. The page itself must explain that it builds a prompt for the visitor's own AI assistant; the navigation label does not have to carry that whole explanation.
