CREATE TABLE IF NOT EXISTS schedule_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  event_datetime TIMESTAMPTZ NOT NULL,
  reminder_intervals INTEGER[] NOT NULL DEFAULT ARRAY[1440,720,360,120,60,30],
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS reminder_intervals INTEGER[] NOT NULL DEFAULT ARRAY[1440,720,360,120,60,30];
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS idx_schedule_items_event_datetime ON schedule_items (event_datetime);

CREATE TABLE IF NOT EXISTS reminder_log (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES schedule_items (id) ON DELETE CASCADE,
  interval_minutes INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, interval_minutes)
);

CREATE TABLE IF NOT EXISTS digest_log (
  id SERIAL PRIMARY KEY,
  digest_date DATE NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
