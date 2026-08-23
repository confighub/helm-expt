# Public-site persona simulations

Site tested: http://127.0.0.1:8766/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after five clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 210 | 208 | 0 | 2 | 106/210 | 71/104 | 0 |
| GitOps operator responsible for delivery | 210 | 193 | 17 | 0 | 85/210 | 78/125 | 1 |
| Platform engineer managing environments and fleets | 210 | 199 | 11 | 0 | 110/210 | 73/100 | 0 |
| Security-minded release reviewer | 210 | 192 | 18 | 0 | 76/210 | 97/134 | 1 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 160 | 0 | 0 |
| navigation | 159 | 1 | 0 |
| action | 172 | 26 | 2 |
| recovery | 150 | 10 | 0 |
| conversion | 151 | 9 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| Helm | 653 | 45 | 2 |
| AICR | 20 | 0 | 0 |
| OCI | 60 | 0 | 0 |
| YAML | 29 | 1 | 0 |
| mixed | 30 | 0 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| check lifecycle work before the next environment | 1 | 9 | 0 |
| check current evidence before approving a move | 1 | 9 | 0 |
| compare desired and live state | 2 | 8 | 0 |
| review ordered stages and a partial fleet | 2 | 8 | 0 |
| handle CRD ordering risk | 2 | 8 | 0 |
| check whether my exact change can move safely | 8 | 0 | 2 |
| find live drift | 8 | 2 | 0 |
| find existing YAML app adoption | 9 | 1 | 0 |
| relate source release and live state | 9 | 1 | 0 |

## Navigation language

These are synthetic forced-choice trials, not observed preferences.

| Preferred label | Count |
| --- | ---: |
| Check my config | 39 |
| Investigate | 21 |
| Compare | 16 |
| Help with a chart | 4 |

The current label `Check my config` was preferred in 39 of 80 synthetic trials. The page itself must explain that it builds a prompt for the visitor's own AI assistant; the navigation label does not have to carry that whole explanation.

## Baseline comparison

No direct comparison was made. The baseline has 720 journeys and the candidate has 840; their goals or starting pages differ.
