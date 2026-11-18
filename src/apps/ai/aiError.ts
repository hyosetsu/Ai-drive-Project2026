import { ErrorRequestHandler, Response } from 'express';

type AiErrorCode =
  | 'DEMO_DISABLED'
  | 'UNSUPPORTED_CONTENT_ENCODING'
  | 'INVALID_BODY'
  | 'INVALID_JSON'
  | 'REQUEST_TOO_LARGE'
  | 'NOT_FOUND'
  | 'INTERNAL_SERVER_ERROR';

export function sendAiError(res: Response, status: number, code: AiErrorCode, message: string): void {
  res.status(status).json({
    success: false,
    error: { code, message, requestId: res.locals.requestId as string },
  });
}

export const aiFinalErrorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (res.headersSent) return;

  const type = typeof err === 'object' && err !== null && 'type' in err
    ? (err as { type?: unknown }).type : undefined;

  if (type === 'entity.too.large') {
    sendAiError(res, 413, 'REQUEST_TOO_LARGE', 'リクエスト本文が大きすぎます');
  } else if (type === 'entity.parse.failed' || type === 'entity.verify.failed') {
    sendAiError(res, 400, 'INVALID_JSON', 'JSONの形式が正しくありません');
  } else {
    // 生の例外、秘密値、本文、スタックは記録・返却しない。
    sendAiError(res, 500, 'INTERNAL_SERVER_ERROR', 'サーバー内部エラーが発生しました');
  }
};
