CREATE TABLE IF NOT EXISTS todo_tasks (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(100) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100 AND title = btrim(title)),
  is_completed BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
