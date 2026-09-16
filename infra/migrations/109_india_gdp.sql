ALTER TABLE india_macro_editions DROP CONSTRAINT india_macro_editions_kind_check;
ALTER TABLE india_macro_editions ADD CONSTRAINT india_macro_editions_kind_check CHECK(kind IN ('cpi','calendar','gdp'));
CREATE TABLE india_gdp_gate(id boolean PRIMARY KEY DEFAULT true CHECK(id),rights_evidence text NOT NULL DEFAULT '');
INSERT INTO india_gdp_gate(id) VALUES(true);
INSERT INTO research_auto_schedules(source_id,enabled,interval_minutes) VALUES('india-gdp',false,60) ON CONFLICT DO NOTHING;
