import { pool } from '../../../db';

// pg returns BIGINT as string. Keep IDs as strings to avoid precision loss.
interface AiHistoryRow {
  id: string;
  prompt: string;
  response_text: string;
  created_at: Date;
}

export interface AiHistoryItem {
  id: string;
  prompt: string;
  response: string;
  createdAt: string;
}

// Fixed SQL: do not interpolate request parameters into this query.
const SELECT_LATEST_HISTORY = `
  SELECT id, prompt, response_text, created_at
  FROM ai_qa_logs
  ORDER BY created_at DESC, id DESC
  LIMIT 20
`;

function toHistoryItem(row: AiHistoryRow): AiHistoryItem {
  return {
    id: row.id,
    prompt: row.prompt,
    response: row.response_text,
    createdAt: row.created_at.toISOString(),
  };
}

export async function selectLatestAiHistory(): Promise<AiHistoryItem[]> {
  const result = await pool.query<AiHistoryRow>(SELECT_LATEST_HISTORY);
  return result.rows.map(toHistoryItem);
}

// Prepared for the later ask API. TASK-02 never calls this function.
export async function insertAiHistory(prompt: string, response: string): Promise<AiHistoryItem> {
  const result = await pool.query<AiHistoryRow>(
    `INSERT INTO ai_qa_logs (prompt, response_text)
     VALUES ($1, $2)
     RETURNING id, prompt, response_text, created_at`,
    [prompt, response],
  );
  return toHistoryItem(result.rows[0]);
}
