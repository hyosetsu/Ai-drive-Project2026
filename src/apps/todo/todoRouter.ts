
import express, { Router, Request, Response, NextFunction } from 'express';
import { list, create, updateStatus, remove } from './todoController';

export const todoRouter = Router();

// TODO APIのキャッシュを無効化する
todoRouter.use('/api/v1/todos', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// TODO API専用のJSONパーサー（上限10KB）
todoRouter.use('/api/v1/todos', express.json({ limit: '10kb' }));

// REQ-01: TODO一覧取得
todoRouter.get('/api/v1/todos', list);

// REQ-02: TODO新規登録
todoRouter.post('/api/v1/todos', create);

// REQ-03: TODO完了状態更新
todoRouter.patch('/api/v1/todos/:id', updateStatus);

// REQ-04: TODO削除
todoRouter.delete('/api/v1/todos/:id', remove);

// TODO: 工程09でGET /todoを追加する

// 未定義のTODO APIへのアクセスはJSONで404を返す
todoRouter.use('/api/v1/todos', (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '指定されたURLは存在しません',
    },
  });
});

// TODO APIのJSON解析エラーなどを処理する
todoRouter.use(
  '/api/v1/todos',
  (err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'JSONの形式が正しくありません',
        },
      });
    }

    if (err?.type === 'entity.too.large') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'リクエストが大きすぎます',
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'サーバー内部エラーが発生しました',
      },
    });
  },
);
