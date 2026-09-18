# Local board

Runtime packets live under `$RDOS_HOME/board/` (default `var/board/` in a working tree).

Each experiment packet is `board/experiments/<id>.json` and **must** carry machine-time fields:

- `estimate_ca_hours`
- `estimate_proof_min`
- `human_gates[]`
- `actuals`

`attention.dump` is `board/attention.dump.json` — P0 and HARD LAW are siblings. This file is the data SoT.
