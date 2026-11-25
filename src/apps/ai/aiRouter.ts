import express, { Router } from 'express';
import { aiFinalErrorHandler, sendAiError } from './aiError';
import { askAi, listAiHistory } from './aiController';
import {
  aiRequestContext,
  aiDemoGate,
  aiEncodingGuard,
  aiJsonContentTypeGuard,
} from './aiMiddleware';

export const aiRouter = Router();

// The demo gate must run before JSON parsing, Gemini SDK loading, or DB access.
aiRouter.use(aiRequestContext);
aiRouter.use(aiDemoGate);
aiRouter.use(aiEncodingGuard);
aiRouter.use(aiJsonContentTypeGuard);

// TASK-05: send one validated question to Gemini; return 201 only after INSERT.
aiRouter.post('/ask', express.json({ limit: 16384, strict: true }), askAi);

// History is queried only after passing the demo gate.
aiRouter.get('/history', listAiHistory);

aiRouter.use((_req, res) => {
  sendAiError(res, 404, 'NOT_FOUND', '指定されたURLは存在しません');
});

aiRouter.use(aiFinalErrorHandler);
