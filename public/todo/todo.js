
/**
 * TODO APIの通信エラー。
 */
class TodoApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'TodoApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 共通HTTP通信処理。
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

  // 204は本文がないのでJSON解析しない
  if (res.status === 204) {
    return null;
  }

  let body = null;

  try {
    body = await res.json();
  } catch {
    // HTMLなどJSON以外のレスポンス
  }

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
 * TODO API通信層。
 */
class TodoApi {
  static getTodos() {
    return request('/api/v1/todos');
  }

  static createTodo(title) {
    return request('/api/v1/todos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });
  }

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

  static deleteTodo(id) {
    return request(
      `/api/v1/todos/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  }
}

/**
 * TODO画面のイベント処理。
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('todo-form');
  const titleInput = document.getElementById('todo-title');
  const addButton = document.getElementById('add-button');
  const formMessage = document.getElementById('form-message');

  const todoList = document.getElementById('todo-list');
  const listMessage = document.getElementById('list-message');
  const retryButton = document.getElementById('retry-button');

  // TODO画面以外ではイベント登録しない
  if (
    !form ||
    !titleInput ||
    !addButton ||
    !formMessage ||
    !todoList ||
    !listMessage ||
    !retryButton
  ) {
    return;
  }

  let isCreating = false;
  let loadSequence = 0;

  /**
   * 登録フォームのメッセージを表示する。
   */
  function showFormMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.className = isError
      ? 'message error'
      : 'message info';
  }

  /**
   * 一覧のメッセージを表示する。
   */
  function showListMessage(message, isError = false) {
    listMessage.textContent = message;
    listMessage.className = isError
      ? 'message error'
      : 'message info';
  }

  /**
   * APIエラーのメッセージを取り出す。
   */
  function getErrorMessage(error) {
    return error instanceof Error
      ? error.message
      : '予期しないエラーが発生しました';
  }

  /**
   * TODOの1行を作成する。
   */
  function createTodoItem(todo) {
    const li = document.createElement('li');
    li.className = 'todo-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.setAttribute(
      'aria-label',
      `${todo.title}の完了状態`
    );

    const content = document.createElement('div');
    content.className = 'todo-content';

    const title = document.createElement('span');
    title.className = todo.completed
      ? 'todo-title completed'
      : 'todo-title';

    // XSS対策：HTMLとして解釈させない
    title.textContent = todo.title;

    const date = document.createElement('small');
    date.className = 'todo-date';
    date.textContent =
      new Date(todo.created_at).toLocaleString('ja-JP');

    content.appendChild(title);
    content.appendChild(date);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-button';
    deleteButton.textContent = '削除';
    deleteButton.setAttribute(
      'aria-label',
      `${todo.title}を削除`
    );

    /**
     * 完了状態の変更。
     */
    checkbox.addEventListener('change', async () => {
      const previousValue = todo.completed;
      const nextValue = checkbox.checked;

      checkbox.disabled = true;
      deleteButton.disabled = true;
      showListMessage('');

      try {
        await TodoApi.updateTodoStatus(
          todo.id,
          nextValue
        );

        await loadTodos();
      } catch (error) {
        // 更新失敗時はチェック状態を復元
        checkbox.checked = previousValue;
        checkbox.disabled = false;
        deleteButton.disabled = false;

        showListMessage(
          getErrorMessage(error),
          true
        );
      }
    });

    /**
     * TODO削除。
     */
    deleteButton.addEventListener('click', async () => {
      checkbox.disabled = true;
      deleteButton.disabled = true;
      showListMessage('');

      try {
        await TodoApi.deleteTodo(todo.id);
        await loadTodos();
      } catch (error) {
        // 他の操作などですでに削除済みの場合
        if (
          error instanceof TodoApiError &&
          error.status === 404
        ) {
          await loadTodos();

          showListMessage(
            'すでに削除されています'
          );
          return;
        }

        checkbox.disabled = false;
        deleteButton.disabled = false;

        showListMessage(
          getErrorMessage(error),
          true
        );
      }
    });

    li.appendChild(checkbox);
    li.appendChild(content);
    li.appendChild(deleteButton);

    return li;
  }

  /**
   * TODO一覧をAPIから再取得して表示する。
   */
  async function loadTodos() {
    const currentSequence = ++loadSequence;

    showListMessage('読み込み中...');
    retryButton.hidden = true;

    try {
      const todos = await TodoApi.getTodos();

      // 古いリクエストの結果で画面を上書きしない
      if (currentSequence !== loadSequence) {
        return;
      }

      // 既存の一覧を削除
      todoList.replaceChildren();

      if (!Array.isArray(todos)) {
        throw new Error(
          'TODO一覧のデータ形式が正しくありません'
        );
      }

      if (todos.length === 0) {
        showListMessage('タスクはありません');
        return;
      }

      const fragment = document.createDocumentFragment();

      todos.forEach((todo) => {
        fragment.appendChild(createTodoItem(todo));
      });

      todoList.appendChild(fragment);
      showListMessage('');
    } catch (error) {
      if (currentSequence !== loadSequence) {
        return;
      }

      todoList.replaceChildren();

      showListMessage(
        getErrorMessage(error),
        true
      );

      retryButton.hidden = false;

      // 呼び出し元でも必要に応じてエラーを扱えるようにする
      throw error;
    }
  }

  /**
   * TODO登録フォームの送信。
   */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isCreating) {
      return;
    }

    const title = titleInput.value.trim();

    if (title.length === 0) {
      showFormMessage(
        'TODOを入力してください',
        true
      );
      return;
    }

    isCreating = true;
    addButton.disabled = true;
    showFormMessage('');

    try {
      await TodoApi.createTodo(title);

      titleInput.value = '';
      showFormMessage('TODOを登録しました');

      await loadTodos();
    } catch (error) {
      showFormMessage(
        getErrorMessage(error),
        true
      );
    } finally {
      isCreating = false;
      addButton.disabled = false;
    }
  });

  /**
   * 一覧再読み込みボタン。
   */
  retryButton.addEventListener('click', () => {
    loadTodos().catch(() => {
      // loadTodos()内でエラー表示済み
    });
  });

  /**
   * 初回のTODO一覧取得。
   */
  loadTodos().catch(() => {
    // loadTodos()内でエラー表示済み
  });
});
