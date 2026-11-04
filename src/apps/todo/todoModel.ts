import { pool } from '../../../db';

export interface TodoRow {
  id: number;
  title: string;
  completed: boolean;
  created_at: Date;
}

/**
 * TODO一覧を新しい順に取得する。
 * DBへの書き込みは行わない。
 */
export async function selectAllTodos(): Promise<TodoRow[]> {
  const result = await pool.query<TodoRow>(
    `SELECT id, title, is_completed AS completed, created_at
     FROM todo_tasks
     ORDER BY created_at DESC, id DESC`
  );

  return result.rows;
}

/**
 * TODOを新規登録する。
 * titleはControllerで検証・trim済みの値を受け取る。
 */
export async function insertTodo(title: string): Promise<TodoRow> {
  const result = await pool.query<TodoRow>(
    `INSERT INTO todo_tasks (title)
     VALUES ($1)
     RETURNING id, title, is_completed AS completed, created_at`,
    [title]
  );

  return result.rows[0];
}
