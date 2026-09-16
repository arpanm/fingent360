ALTER TABLE research_calendar_editions ADD COLUMN source_id text NOT NULL DEFAULT 'bea-calendar' CHECK(source_id IN ('bea-calendar','bls-calendar'));
CREATE INDEX research_calendar_source_editions ON research_calendar_editions(source_id,retrieved_at DESC,hash);
