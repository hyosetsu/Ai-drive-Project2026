import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';
import { sendAiError } from './aiError';

// Previewの保護方式は未確定のため、ローカル以外は常に拒否する。
function isLocalDemoAllowed(): boolean {
  return process.env.NODE_ENV !== 'production'
    && process.env.VERCEL_ENV === undefined
    && process.env.AI_DEMO_ENABLED === 'true';
}

export const aiRequestContext: RequestHandler = (_req, res, next) => {
  res.locals.requestId = randomUUID();
  res.set('Cache-Control', 'no-store');
  next();
};

export const aiDemoGate: RequestHandler = (_req, res, next) => {
  if (!isLocalDemoAllowed()) {
    sendAiError(res, 503, 'DEMO_DISABLED', 'AI機能は現在利用できません');
    return;
  }
  next();
};

export const aiEncodingGuard: RequestHandler = (req, res, next) => {
  const encoding = req.headers['content-encoding'];
  if (encoding !== undefined && encoding.toLowerCase() !== 'identity') {
    sendAiError(res, 415, 'UNSUPPORTED_CONTENT_ENCODING', 'この圧縮形式には対応していません');
    return;
  }
  next();
};

export const aiJsonContentTypeGuard: RequestHandler = (req, res, next) => {
  if (req.method === 'POST' && req.path === '/ask' && !req.is('application/json')) {
    sendAiError(res, 400, 'INVALID_BODY', 'JSON形式の本文を指定してください');
    return;
  }
  next();
};
