# Public-site persona simulations

Site tested: http://127.0.0.1:8766/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after 3 clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 264 | 256 | 6 | 2 | 128/264 | 88/136 | 1 |
| GitOps operator responsible for delivery | 264 | 222 | 41 | 1 | 114/264 | 87/150 | 1 |
| Platform engineer managing environments and fleets | 264 | 235 | 29 | 0 | 131/264 | 100/133 | 1 |
| Security-minded release reviewer | 264 | 218 | 45 | 1 | 92/264 | 116/172 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 196 | 12 | 1 |
| navigation | 197 | 12 | 0 |
| action | 216 | 56 | 3 |
| recovery | 150 | 26 | 0 |
| conversion | 172 | 15 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| AICR | 22 | 0 | 0 |
| Helm | 724 | 98 | 3 |
| OCI | 57 | 8 | 1 |
| Timoni | 34 | 10 | 0 |
| YAML | 41 | 3 | 0 |
| mixed | 53 | 2 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
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
| store the reviewed configuration | 8 | 3 | 0 |

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
| Successful journeys | 921/1056 | 931/1056 | +10 |
| Partial journeys | 121/1056 | 121/1056 | 0 |
| Failed journeys | 14/1056 | 4/1056 | -10 |
| Answered on starting page | 463/1056 | 465/1056 | +2 |
| Useful first click when needed | 386/593 (65.1%) | 391/591 (66.2%) | 1.1 points |
