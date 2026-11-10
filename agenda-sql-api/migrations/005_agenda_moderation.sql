CREATE TABLE IF NOT EXISTS tech2d.agenda_recent_users (
  uid text PRIMARY KEY,
  email text,
  last_seen_at timestamptz NOT NULL,
  network_key text CHECK (network_key ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS agenda_recent_users_last_seen ON tech2d.agenda_recent_users(last_seen_at DESC, uid);

CREATE TABLE IF NOT EXISTS tech2d.agenda_blocks (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('email', 'ip')),
  target text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  UNIQUE (kind, target),
  CHECK (kind <> 'ip' OR target ~ '^[0-9a-f]{64}$')
);

REVOKE ALL ON tech2d.agenda_recent_users, tech2d.agenda_blocks FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'tech2d_api') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON tech2d.agenda_recent_users TO tech2d_api;
    GRANT SELECT, INSERT, DELETE ON tech2d.agenda_blocks TO tech2d_api;
  END IF;
END $$;

INSERT INTO tech2d.schema_migrations(version) VALUES ('005_agenda_moderation') ON CONFLICT DO NOTHING;
