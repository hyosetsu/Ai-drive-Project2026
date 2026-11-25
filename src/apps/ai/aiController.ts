import { RequestHandler } from 'express';
import { insertAiHistory, selectLatestAiHistory } from './aiModel';
import { sendAiError } from './aiError';
import { generateMockAnswer } from './aiService';

export const listAiHistory: RequestHandler = async (_req, res) => {
  try {
    const items = await selectLatestAiHistory();
    res.status(200).json({ success: true, items });
  } catch (err: unknown) {
    // Do not expose query text, connection details, or raw exceptions.
    const code = typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: unknown }).code : undefined;
    const unavailable = typeof code === 'string' &&
      (code.startsWith('08') || code.startsWith('53') || code.startsWith('57'));
    sendAiError(
      res,
      unavailable || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' ? 503 : 500,
      'HISTORY_UNAVAILABLE',
      '履歴を取得できませんでした',
    );
  }
};

// The mocked ask endpoint must not be usable from a remote client or deployed service.
function isLocalMockRequest(remoteAddress: string | undefined): boolean {
  return process.env.NODE_ENV === 'development'
    && process.env.VERCEL_ENV === undefined
    && process.env.AI_DEMO_ENABLED === 'true'
    && (remoteAddress === '127.0.0.1'
      || remoteAddress === '::1'
      || remoteAddress === '::ffff:127.0.0.1');
}

export const askAiMock: RequestHandler = async (req, res) => {
  if (!isLocalMockRequest(req.socket.remoteAddress)) {
    sendAiError(res, 503, 'DEMO_DISABLED', 'AI機能は現在利用できません');
    return;
  }

  const body: unknown = req.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    sendAiError(res, 400, 'INVALID_BODY', 'JSONオブジェクトを指定してください');
    return;
  }
  const questionValue: unknown = (body as Record<string, unknown>).question;
  if (typeof questionValue !== 'string') {
    sendAiError(res, 400, 'INVALID_BODY', 'questionは文字列で指定してください');
    return;
  }

  const question = questionValue.trim();
  const length = Array.from(question).length;
  if (length < 1 || length > 2000 || question.includes('\u0000')) {
    sendAiError(res, 422, 'VALIDATION_ERROR', 'questionは1〜2000文字で指定してください');
    return;
  }

  // Only after successful validation: mock Service -> single INSERT -> 201.
  const answer = generateMockAnswer(question).trim();
  if (!answer) {
    sendAiError(res, 502, 'AI_UNAVAILABLE', 'AIの回答を取得できませんでした');
    return;
  }

  try {
    const data = await insertAiHistory(question, answer);
    res.status(201).json({ success: true, data });
  } catch (err: unknown) {
    // Only a definite PostgreSQL INSERT rejection is classified as SAVE_FAILED.
    // All unrecognized/transport errors are result-unknown; never auto-retry.
    const code = typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: unknown }).code : undefined;
    const severity = typeof err === 'object' && err !== null && 'severity' in err
      ? (err as { severity?: unknown }).severity : undefined;
    const rejected = typeof code === 'string' && severity === 'ERROR' &&
      ['22', '23', '42', 'P0'].includes(code.slice(0, 2));
    if (rejected) {
      sendAiError(res, 500, 'SAVE_FAILED', '回答を保存できませんでした');
    } else {
      sendAiError(res, 503, 'SAVE_RESULT_UNKNOWN', '保存結果を確認できませんでした。再送前に履歴をご確認ください');
    }
  }
};
