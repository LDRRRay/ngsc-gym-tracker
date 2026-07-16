CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observed_at TEXT NOT NULL UNIQUE,
  current_people INTEGER NOT NULL CHECK (current_people >= 0),
  capacity INTEGER NOT NULL CHECK (capacity > 0)
);

CREATE INDEX IF NOT EXISTS idx_observations_observed_at
  ON observations(observed_at);
