
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
    '08000',
    '08001',
    '08003',
    '08004',
    '08006',
    '08007',
    '08P01',
    '57P01',
    '57P02',
    '57P03',
    '53300',
    '53400',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
  ]);

  return transientCodes.has(code) ? 503 : 500;
}
