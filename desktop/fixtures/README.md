# attention.dump fixtures

UI-only dumps. The shell is a view — these files are not a second store.

| File | State |
| --- | --- |
| `attention.dump.json` | human-waiting (designer SoT) |
| `attention.dump.flight.json` | in-flight only — no Approve |
| `attention.dump.empty.json` | idle board → Empty Waiting |

```bash
export RDOS_DUMP="$PWD/fixtures/attention.dump.json"
npm run tauri dev
```

Frontend: `http://127.0.0.1:1420/?fixture=human#/waiting` (`empty`, `flight`, `missing`).
