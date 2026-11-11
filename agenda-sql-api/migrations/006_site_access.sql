ALTER TABLE tech2d.agenda_access
  ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'agenda' CHECK (site IN ('agenda', 'professores'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM tech2d.schema_migrations WHERE version = '006_site_access') THEN
    ALTER TABLE tech2d.agenda_access DROP CONSTRAINT agenda_access_pkey;
    ALTER TABLE tech2d.agenda_access ADD PRIMARY KEY (site, day, half_hour, kind, visitor_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tech2d.professor_recent_users (
  uid text PRIMARY KEY,
  email text,
  last_seen_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS professor_recent_users_last_seen
  ON tech2d.professor_recent_users(last_seen_at DESC, uid);

REVOKE ALL ON tech2d.professor_recent_users FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'tech2d_api') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON tech2d.professor_recent_users TO tech2d_api;
  END IF;
END $$;

INSERT INTO tech2d.schema_migrations(version) VALUES ('006_site_access') ON CONFLICT DO NOTHING;
