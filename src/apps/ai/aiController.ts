import { RequestHandler } from 'express';
import { selectLatestAiHistory } from './aiModel';
import { sendAiError } from './aiError';

export const listAiHistory: RequestHandler = async (_req, res) => {
  try {
    const items = await selectLatestAiHistory();
    res.status(200).json({ success: true, items });
  } catch (err: unknown) {
    // Distinguish DB connectivity/unavailability from other errors;
    // never expose SQL, connection details, or raw errors to clients/logs.
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
