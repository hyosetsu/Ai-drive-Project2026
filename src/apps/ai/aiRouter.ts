import express, { Router } from 'express';
import { aiFinalErrorHandler, sendAiError } from './aiError';
import { askAiMock, listAiHistory } from './aiController';
import {
  aiRequestContext,
  aiDemoGate,
  aiEncodingGuard,
  aiJsonContentTypeGuard,
} from './aiMiddleware';

export const aiRouter = Router();

// 本文解析・DBアクセス・SDK初期化よりも先にデモ停止を判定。
aiRouter.use(aiRequestContext);
aiRouter.use(aiDemoGate);
aiRouter.use(aiEncodingGuard);
aiRouter.use(aiJsonContentTypeGuard);

// TASK-04: 質問APIだけに16KiBのJSON解析を適用し、ローカル検証用模擬回答を保存。
aiRouter.post('/ask', express.json({ limit: 16384, strict: true }), askAiMock);

// TASK-03: 履歴取得API。デモ停止ゲート通過後にのみDBを照会する。
aiRouter.get('/history', listAiHistory);

aiRouter.use((_req, res) => {
  sendAiError(res, 404, 'NOT_FOUND', '指定されたURLは存在しません');
});

aiRouter.use(aiFinalErrorHandler);
