-- SQLite control-plane board. One writer (lock). Not the file attention.dump SoT.

CREATE TABLE IF NOT EXISTS thesis (
  slot INTEGER PRIMARY KEY CHECK (slot = 1),
  experiment_id TEXT NOT NULL,
  title TEXT NOT NULL,
  kill TEXT,
  instrument TEXT,
  status TEXT NOT NULL CHECK (status = 'ACTIVE'),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS packets (
  packet_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  kind TEXT,
  uri TEXT,
  completeness REAL,
  runner_result TEXT,
  verdict TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locks (
  resource TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  token TEXT NOT NULL,
  acquired_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seats (
  experiment_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('author', 'proof', 'human')),
  PRIMARY KEY (experiment_id, actor)
);

CREATE TABLE IF NOT EXISTS budgets (
  experiment_id TEXT PRIMARY KEY,
  ca_hours_budget REAL NOT NULL,
  proof_min_budget REAL NOT NULL,
  spent_ca_hours REAL NOT NULL DEFAULT 0,
  spent_proof_min REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
