CREATE TABLE IF NOT EXISTS tech2d.agenda_access (
  day date NOT NULL,
  half_hour bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('account', 'anonymous')),
  visitor_key text NOT NULL,
  CHECK (
    (kind = 'anonymous' AND visitor_key ~ '^[0-9a-f]{64}$') OR
    (kind = 'account' AND char_length(visitor_key) BETWEEN 1 AND 128)
  ),
  PRIMARY KEY (day, half_hour, kind, visitor_key)
);

REVOKE ALL ON tech2d.agenda_access FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'tech2d_api') THEN
    GRANT SELECT, INSERT, DELETE ON tech2d.agenda_access TO tech2d_api;
  END IF;
END $$;

INSERT INTO tech2d.schema_migrations(version) VALUES ('004_agenda_access') ON CONFLICT DO NOTHING;
