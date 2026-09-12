CREATE TABLE IF NOT EXISTS app_alert_preferences (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  indicator text NOT NULL CHECK (indicator IN ('NY.GDP.MKTP.KD.ZG','FP.CPI.TOTL.ZG')),
  muted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,indicator)
);
