CREATE TABLE IF NOT EXISTS macro_runs (
  id uuid PRIMARY KEY,
  indicator text NOT NULL CHECK (indicator IN ('NY.GDP.MKTP.KD.ZG','FP.CPI.TOTL.ZG')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','succeeded','failed')),
  message text NOT NULL DEFAULT '',
  inserted integer NOT NULL DEFAULT 0,
  source_hash text
);
CREATE INDEX IF NOT EXISTS macro_runs_indicator ON macro_runs(indicator,started_at DESC);
CREATE TABLE IF NOT EXISTS macro_observations (
  id uuid PRIMARY KEY,
  indicator text NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  value numeric(48,30),
  provider_updated_at date NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_hash text NOT NULL,
  source_url text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  supersedes_id uuid REFERENCES macro_observations(id),
  run_id uuid NOT NULL REFERENCES macro_runs(id),
  UNIQUE(indicator,year,revision)
);
CREATE INDEX IF NOT EXISTS macro_observations_latest ON macro_observations(indicator,year DESC,revision DESC);
