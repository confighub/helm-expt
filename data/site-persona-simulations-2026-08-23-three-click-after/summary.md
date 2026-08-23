# Public-site persona simulations

Site tested: https://confighub.github.io/helm-expt/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after 3 clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 253 | 244 | 7 | 2 | 125/253 | 83/128 | 1 |
| GitOps operator responsible for delivery | 253 | 217 | 36 | 0 | 108/253 | 86/145 | 1 |
| Platform engineer managing environments and fleets | 253 | 234 | 19 | 0 | 128/253 | 84/125 | 0 |
| Security-minded release reviewer | 253 | 215 | 37 | 1 | 89/253 | 113/164 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 195 | 13 | 1 |
| navigation | 197 | 12 | 0 |
| action | 196 | 33 | 2 |
| recovery | 150 | 26 | 0 |
| conversion | 172 | 15 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| AICR | 22 | 0 | 0 |
| Helm | 703 | 76 | 2 |
| OCI | 57 | 8 | 1 |
| Timoni | 34 | 10 | 0 |
| YAML | 41 | 3 | 0 |
| mixed | 53 | 2 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| check lifecycle work before the next environment | 1 | 10 | 0 |
| check current evidence before approving a move | 1 | 10 | 0 |
| compare desired and live state | 2 | 9 | 0 |
| review ordered stages and a partial fleet | 2 | 9 | 0 |
| handle CRD ordering risk | 2 | 9 | 0 |
| understand partial drift coverage | 3 | 8 | 0 |
| distinguish object, OCI manifest, and release identities | 5 | 5 | 1 |
| find a reviewed Timoni Redis configuration | 6 | 5 | 0 |
| find live drift | 6 | 5 | 0 |
| distinguish source, rendered, and ConfigHub release OCI | 8 | 3 | 0 |
| find a Timoni configuration carried through OCI | 8 | 3 | 0 |
| store the reviewed configuration | 8 | 3 | 0 |
| find existing YAML app adoption | 8 | 3 | 0 |
| check whether my exact change can move safely | 9 | 0 | 2 |
| deliver with kubectl | 9 | 2 | 0 |

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
| Successful journeys | 892/1012 | 910/1012 | +18 |
| Partial journeys | 117/1012 | 99/1012 | -18 |
| Failed journeys | 3/1012 | 3/1012 | 0 |
| Answered on starting page | 430/1012 | 450/1012 | +20 |
| Useful first click when needed | 379/582 (65.1%) | 366/562 (65.1%) | 0.0 points |
