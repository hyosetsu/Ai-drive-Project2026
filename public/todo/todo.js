/**
 * TODO APIの通信エラーを表すクラス。
 */
class TodoApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * TODO API共通のHTTP通信処理。
 *
 * 成功時: dataを返す
 * DELETE成功時（204）: nullを返す
 * 失敗時: TodoApiErrorを投げる
 */
async function request(path, options = {}) {
  let res;

  try {
    res = await fetch(path, {
      cache: 'no-store',
      ...options,
    });
  } catch {
    throw new TodoApiError(
      0,
      'NETWORK_ERROR',
      '通信に失敗しました。接続を確認してください'
    );
  }

  // DELETE成功時は本文がないためJSON解析しない
  if (res.status === 204) {
    return null;
  }

  let body = null;

  try {
    body = await res.json();
  } catch {
    // HTMLなどJSON以外の応答
  }

  // HTTPエラーを共通形式に変換
  if (!res.ok) {
    const e = body && body.error;

    throw new TodoApiError(
      res.status,
      (e && e.code) || 'UNKNOWN_ERROR',
      (e && e.message) ||
        `サーバーエラーが発生しました（${res.status}）`
    );
  }

  return body ? body.data : null;
}

/**
 * TODO APIの通信層。
 */
class TodoApi {
  /**
   * GET /api/v1/todos
   * TODO一覧を取得する。
   */
  static getTodos() {
    return request('/api/v1/todos');
  }

  /**
   * POST /api/v1/todos
   * TODOを新規登録する。
   */
  static createTodo(title) {
    return request('/api/v1/todos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });
  }

  /**
   * PATCH /api/v1/todos/:id
   * TODOの完了状態を更新する。
   */
  static updateTodoStatus(id, completed) {
    return request(
      `/api/v1/todos/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed }),
      }
    );
  }

  /**
   * DELETE /api/v1/todos/:id
   * TODOを削除する。
   */
  static deleteTodo(id) {
    return request(
      `/api/v1/todos/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  }
}
