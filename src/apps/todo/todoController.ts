import type { Request, Response } from 'express';
import {
  selectAllTodos,
  insertTodo,
  updateTodoStatus,
  deleteTodo,
} from './todoModel';

/**
 * URLパラメータのTODO IDを検証する。
 *
 * 有効: 1〜2147483647の10進整数
 * 無効: 0、負数、小数、先頭ゼロ、文字列、上限超過
 */
export function parseId(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (!/^[1-9][0-9]*$/.test(value)) {
    return null;
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    return null;
  }

  return id;
}

/**
 * TODOタイトルを検証する。
 *
 * 文字列以外は400相当、業務値の違反は422相当。
 * 正常な場合は前後の空白を除去したタイトルを返す。
 */
export type TitleValidationResult =
  | { ok: true; title: string }
  | { ok: false; status: 400 | 422; code: string; message: string };

export function validateTitle(value: unknown): TitleValidationResult {
  if (typeof value !== 'string') {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_BODY',
      message: 'titleは文字列で指定してください',
    };
  }

  const title = value.trim();
  const length = Array.from(title).length;

  if (length < 1 || length > 100 || title.includes('\u0000')) {
    return {
      ok: false,
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'titleは1〜100文字で指定してください',
    };
  }

  return {
    ok: true,
    title,
  };
}

/**
 * DB接続などの一時的な障害を503、
 * その他の予期しないエラーを500に分類する。
 */
export function classifyDbError(error: unknown): 500 | 503 {
  if (typeof error !== 'object' || error === null) {
    return 500;
  }

  const code = 'code' in error ? error.code : undefined;

  if (typeof code !== 'string') {
    return 500;
  }

  const transientCodes = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    '08000',
    '08001',
    '08003',
    '08004',
    '08006',
    '57P01',
    '57P02',
    '57P03',
    '53300',
  ]);

  return transientCodes.has(code) ? 503 : 500;
}

/**
 * GET /api/v1/todos
 * TODO一覧を取得する。
 */
export async function list(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const todos = await selectAllTodos();

    res.status(200).json({
      success: true,
      data: todos,
    });
  } catch (error: unknown) {
    const status = classifyDbError(error);

    console.error('TODO一覧取得失敗', {
      code:
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? error.code
          : undefined,
    });

    res.status(status).json({
      success: false,
      error: {
        code:
          status === 503
            ? 'SERVICE_UNAVAILABLE'
            : 'INTERNAL_SERVER_ERROR',
        message: 'TODO一覧を取得できませんでした',
      },
    });
  }
}

/**
 * POST /api/v1/todos
 * TODOを新規登録する。
 */
export async function create(
  req: Request,
  res: Response
): Promise<void> {
  // Content-TypeがJSONであることを確認
  if (!req.is('application/json')) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BODY',
        message: 'Content-Typeはapplication/jsonを指定してください',
      },
    });
    return;
  }

  // JSON本文がオブジェクトであることを確認
  if (
    req.body === null ||
    typeof req.body !== 'object' ||
    Array.isArray(req.body)
  ) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BODY',
        message: 'JSONオブジェクトを指定してください',
      },
    });
    return;
  }

  // titleの型・文字数・NUL文字を検証
  const validation = validateTitle(req.body.title);

  if (!validation.ok) {
    res.status(validation.status).json({
      success: false,
      error: {
        code: validation.code,
        message: validation.message,
      },
    });
    return;
  }

  try {
    // 検証・trim済みのタイトルを登録
    const todo = await insertTodo(validation.title);

    res.status(201).json({
      success: true,
      data: todo,
    });
  } catch (error: unknown) {
    const status = classifyDbError(error);

    console.error('TODO登録失敗', {
      code:
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? error.code
          : undefined,
    });

    res.status(status).json({
      success: false,
      error: {
        code:
          status === 503
            ? 'SERVICE_UNAVAILABLE'
            : 'INTERNAL_SERVER_ERROR',
        message: 'TODOを登録できませんでした',
      },
    });
  }
}

/**
 * PATCH /api/v1/todos/:id
 * 指定したTODOの完了状態を更新する。
 */
export async function updateStatus(
  req: Request,
  res: Response
): Promise<void> {
  // ① URLパラメータのIDを検証
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PARAMETER',
        message: '有効なTODO IDを指定してください',
      },
    });
    return;
  }

  // ② Content-TypeがJSONであることを確認
  if (!req.is('application/json')) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BODY',
        message: 'Content-Typeはapplication/jsonを指定してください',
      },
    });
    return;
  }

  // ③ JSON本文がオブジェクトであることを確認
  if (
    req.body === null ||
    typeof req.body !== 'object' ||
    Array.isArray(req.body)
  ) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BODY',
        message: 'JSONオブジェクトを指定してください',
      },
    });
    return;
  }

  // ④ completedがboolean型であることを確認
  const completed = req.body.completed;

  if (typeof completed !== 'boolean') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BODY',
        message: 'completedはtrueまたはfalseで指定してください',
      },
    });
    return;
  }

  try {
    // ⑤ 指定したTODOの完了状態を更新
    const todo = await updateTodoStatus(id, completed);

    // ⑥ 対象のTODOが存在しない場合
    if (todo === null) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定されたTODOが見つかりません',
        },
      });
      return;
    }

    // ⑦ 更新成功
    res.status(200).json({
      success: true,
      data: todo,
    });
  } catch (error: unknown) {
    // ⑧ DBエラーを500または503に分類
    const status = classifyDbError(error);

    console.error('TODO完了状態更新失敗', {
      code:
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? error.code
          : undefined,
    });

    res.status(status).json({
      success: false,
      error: {
        code:
          status === 503
            ? 'SERVICE_UNAVAILABLE'
            : 'INTERNAL_SERVER_ERROR',
        message: 'TODOの完了状態を更新できませんでした',
      },
    });
  }
}

/**
 * DELETE /api/v1/todos/:id
 * 指定したTODOを削除する。
 */
export async function remove(
  req: Request,
  res: Response
): Promise<void> {
  // ① URLパラメータのIDを検証
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PARAMETER',
        message: '有効なTODO IDを指定してください',
      },
    });
    return;
  }

  try {
    // ② 指定したTODOを削除
    const deleted = await deleteTodo(id);

    // ③ 対象のTODOが存在しない場合
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定されたTODOが見つかりません',
        },
      });
      return;
    }

    // ④ 削除成功時は本文なし
    res.status(204).end();
  } catch (error: unknown) {
    // ⑤ DBエラーを500または503に分類
    const status = classifyDbError(error);

    console.error('TODO削除失敗', {
      code:
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? error.code
          : undefined,
    });

    res.status(status).json({
      success: false,
      error: {
        code:
          status === 503
            ? 'SERVICE_UNAVAILABLE'
            : 'INTERNAL_SERVER_ERROR',
        message: 'TODOを削除できませんでした',
      },
    });
  }
}

/**
 * GET /todo
 * TODO画面を表示する。
 * TODOデータの取得はブラウザ側のTodoApiが行う。
 */
export function showPage(
  _req: Request,
  res: Response
): void {
  res.render('todo/index');
}