INSERT INTO tech2d.schema_migrations(version) VALUES ('008_compact_schedule_catalog') ON CONFLICT DO NOTHING;

-- Activate only after the catalog API is reading school_schedule_catalog.
UPDATE tech2d.catalog_documents
SET data = data
WHERE collection = 'schedules' AND data ? 'professor';
