-- History reports contain multiple dated observations for one scheme.
-- Existing rows remain intact; immutable evidence triggers remain installed.
ALTER TABLE fund_nav_observations DROP CONSTRAINT fund_nav_observations_pkey;
ALTER TABLE fund_nav_observations ADD PRIMARY KEY (edition_id, scheme_code, observed_on);
