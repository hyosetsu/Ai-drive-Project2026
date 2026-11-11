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

/**
 * 指定したTODOの完了状態だけを更新する。
 * 対象IDが存在しない場合はnullを返す。
 */
export async function updateTodoStatus(
  id: number,
  completed: boolean
): Promise<TodoRow | null> {
  const result = await pool.query<TodoRow>(
    `UPDATE todo_tasks
     SET is_completed = $1
     WHERE id = $2
     RETURNING id, title, is_completed AS completed, created_at`,
    [completed, id]
  );

  return result.rows[0] ?? null;
}

/**
 * 指定したTODOを削除する。
 * 削除できた場合はtrue、対象が存在しない場合はfalseを返す。
 */
export async function deleteTodo(id: number): Promise<boolean> {
  const result = await pool.query<{ id: number }>(
    `DELETE FROM todo_tasks
     WHERE id = $1
     RETURNING id`,
    [id]
  );

  return result.rows.length > 0;
}
