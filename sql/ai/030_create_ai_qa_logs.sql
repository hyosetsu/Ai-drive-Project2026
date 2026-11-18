-- TASK-02: AI question/answer history (DDL only; do not auto-execute)
-- IMPORTANT: inspect the target database and existing table before applying.
-- IF NOT EXISTS will not migrate or verify an existing table's shape.
CREATE TABLE IF NOT EXISTS ai_qa_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prompt TEXT NOT NULL
    CONSTRAINT ai_qa_logs_prompt_length_chk
    CHECK (char_length(prompt) BETWEEN 1 AND 2000 AND char_length(btrim(prompt)) > 0),
  response_text TEXT NOT NULL
    CONSTRAINT ai_qa_logs_response_nonempty_chk
    CHECK (char_length(btrim(response_text)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_qa_logs_created_id
  ON ai_qa_logs (created_at DESC, id DESC);
