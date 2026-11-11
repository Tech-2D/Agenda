CREATE TABLE IF NOT EXISTS tech2d.school_teachers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS tech2d.school_subjects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS tech2d.school_classes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS tech2d.school_time_slots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  start_time time(0) NOT NULL,
  end_time time(0) NOT NULL,
  CHECK (start_time < end_time),
  UNIQUE (start_time, end_time)
);

CREATE TABLE IF NOT EXISTS tech2d.school_schedules (
  id text PRIMARY KEY,
  teacher_id bigint NOT NULL REFERENCES tech2d.school_teachers(id),
  subject_id bigint NOT NULL REFERENCES tech2d.school_subjects(id),
  class_id bigint NOT NULL REFERENCES tech2d.school_classes(id),
  time_slot_id bigint NOT NULL REFERENCES tech2d.school_time_slots(id),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  active boolean NOT NULL
);
CREATE INDEX IF NOT EXISTS school_schedules_active_class_day
  ON tech2d.school_schedules (class_id, day_of_week) WHERE active;

CREATE OR REPLACE FUNCTION tech2d.sync_school_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  payload jsonb;
  normalized_keys CONSTANT text[] := ARRAY[
    'professor', 'subject', 'className', 'startTime', 'endTime', 'dayOfWeek', 'active'
  ];
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM tech2d.school_schedules WHERE id = OLD.id;
    RETURN NULL;
  END IF;

  payload := NEW.data;
  -- The update below removes the normalized fields after the relational row exists.
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1
     AND payload = OLD.data - normalized_keys THEN
    RETURN NULL;
  END IF;

  IF (jsonb_typeof(payload->'professor') = 'string'
    AND jsonb_typeof(payload->'subject') = 'string'
    AND jsonb_typeof(payload->'className') = 'string'
    AND jsonb_typeof(payload->'dayOfWeek') = 'number'
    AND jsonb_typeof(payload->'active') = 'boolean'
    AND payload->>'dayOfWeek' ~ '^[0-6]$'
    AND payload->>'startTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND payload->>'endTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Invalid schedule projection' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO tech2d.school_teachers(name) VALUES (payload->>'professor') ON CONFLICT (name) DO NOTHING;
  INSERT INTO tech2d.school_subjects(name) VALUES (payload->>'subject') ON CONFLICT (name) DO NOTHING;
  INSERT INTO tech2d.school_classes(name) VALUES (payload->>'className') ON CONFLICT (name) DO NOTHING;
  INSERT INTO tech2d.school_time_slots(start_time, end_time)
    VALUES ((payload->>'startTime')::time, (payload->>'endTime')::time)
    ON CONFLICT (start_time, end_time) DO NOTHING;

  INSERT INTO tech2d.school_schedules(id, teacher_id, subject_id, class_id, time_slot_id, day_of_week, active)
  SELECT NEW.id, teacher.id, subject.id, class.id, slot.id, (payload->>'dayOfWeek')::smallint, (payload->>'active')::boolean
  FROM tech2d.school_teachers teacher
  CROSS JOIN tech2d.school_subjects subject
  CROSS JOIN tech2d.school_classes class
  CROSS JOIN tech2d.school_time_slots slot
  WHERE teacher.name = payload->>'professor'
    AND subject.name = payload->>'subject'
    AND class.name = payload->>'className'
    AND slot.start_time = (payload->>'startTime')::time
    AND slot.end_time = (payload->>'endTime')::time
  ON CONFLICT (id) DO UPDATE SET
    teacher_id = excluded.teacher_id, subject_id = excluded.subject_id, class_id = excluded.class_id,
    time_slot_id = excluded.time_slot_id, day_of_week = excluded.day_of_week, active = excluded.active;

  IF EXISTS (SELECT FROM tech2d.schema_migrations WHERE version = '008_compact_schedule_catalog') THEN
    UPDATE tech2d.catalog_documents
    SET data = payload - normalized_keys
    WHERE collection = 'schedules' AND id = NEW.id;
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION tech2d.sync_school_schedule() FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM tech2d.schema_migrations WHERE version = '007_normalize_schedules') THEN
    CREATE TRIGGER normalize_schedule_write
      AFTER INSERT OR UPDATE OF data ON tech2d.catalog_documents
      FOR EACH ROW WHEN (NEW.collection = 'schedules')
      EXECUTE FUNCTION tech2d.sync_school_schedule();
    CREATE TRIGGER normalize_schedule_delete
      AFTER DELETE ON tech2d.catalog_documents
      FOR EACH ROW WHEN (OLD.collection = 'schedules')
      EXECUTE FUNCTION tech2d.sync_school_schedule();

    UPDATE tech2d.catalog_documents SET data = data WHERE collection = 'schedules';
  END IF;
END $$;

CREATE OR REPLACE VIEW tech2d.school_schedule_catalog AS
SELECT schedule.id, schedule.day_of_week, schedule.active, class.name AS class_name,
  extra.data || jsonb_build_object(
    'professor', teacher.name, 'subject', subject.name, 'className', class.name,
    'startTime', left(slot.start_time::text, 5), 'endTime', left(slot.end_time::text, 5),
    'dayOfWeek', schedule.day_of_week, 'active', schedule.active
  ) AS data
FROM tech2d.school_schedules schedule
JOIN tech2d.catalog_documents extra ON extra.collection = 'schedules' AND extra.id = schedule.id
JOIN tech2d.school_teachers teacher ON teacher.id = schedule.teacher_id
JOIN tech2d.school_subjects subject ON subject.id = schedule.subject_id
JOIN tech2d.school_classes class ON class.id = schedule.class_id
JOIN tech2d.school_time_slots slot ON slot.id = schedule.time_slot_id;

REVOKE ALL ON tech2d.school_schedule_catalog FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'tech2d_api') THEN
    GRANT SELECT ON tech2d.school_schedule_catalog TO tech2d_api;
  END IF;
END $$;

INSERT INTO tech2d.schema_migrations(version) VALUES ('007_normalize_schedules') ON CONFLICT DO NOTHING;
