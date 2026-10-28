import express, { Request, Response } from 'express';
import path from 'path';
import { pool } from './db';

const app = express(); // Expressアプリケーションを作成
const port: number = 3000; // ローカルで使用するポート番号

// ------------------------------
// Expressの基本設定
// ------------------------------
app.use(express.urlencoded({ extended: true })); // フォームから送信されたデータを受け取れるようにする
app.use(express.static(path.join(process.cwd(), 'public'))); // CSSや画像などの静的ファイルを公開する
app.set('view engine', 'ejs'); // テンプレートエンジンにEJSを設定
app.set('views', path.join(process.cwd(), 'views')); // EJSファイルを保存するフォルダーを指定

// ------------------------------
// ルーティング
// ------------------------------

// 「/」にアクセスされたときの処理
app.get('/', (req: Request, res: Response): void => {
  res.render('index');
});

app.get('/api/db-check', async (_req, res) => {
  try {
    const result = await pool.query('SELECT 1 AS connection_test');
    res.json({
      status: 'ok',
      database: result.rows[0].connection_test === 1 ? 'connected' : 'error',
    });
  } catch (error) {
    console.error('DB接続確認に失敗しました', error);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

type Product = { id: number; name: string; price: number };

// 商品一覧表示
app.get('/db-sample', async (_req, res) => {
  try {
    const result = await pool.query<Product>(
      'SELECT id, name, price FROM products ORDER BY id'
    );
    res.render('db-sample', { products: result.rows });
  } catch (error) {
    console.error('商品一覧の取得に失敗しました', error);
    res.status(503).send('商品一覧を表示できません');
  }
});

// ------------------------------
// 新規登録機能の追加
// ------------------------------

// 1. 新規登録フォーム画面の表示
app.get('/db-sample/new', (_req, res) => {
  res.render('db-new.ejs');
});

// 2. 新規登録データの受け取りとデータベースへの保存
app.post('/db-sample', async (req, res) => {
  const { name, price } = req.body;
  try {
    // 1. 現在の最大のidを取得し、次のID（最大値 + 1）を計算する
    const maxIdResult = await pool.query('SELECT MAX(id) as max_id FROM products');
    // テーブルが空（データが0件）の場合は 0 になるため、+1 して 1 からスタートする
    const newId = (maxIdResult.rows[0].max_id || 0) + 1;

    // 2. 採番したidを含めてデータベースに挿入する
    await pool.query(
      'INSERT INTO products (id, name, price) VALUES ($1, $2, $3)',
      [newId, name, price]
    );
   
    res.redirect('/db-sample'); // 登録後は一覧画面へリダイレクト
  } catch (error) {
    console.error('商品の登録に失敗しました', error);
    res.status(500).send('商品の登録に失敗しました');
  }
});

// ------------------------------
// 削除機能の追加
// ------------------------------

// 3. 指定したIDのデータを削除
app.post('/db-sample/:id/delete', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.redirect('/db-sample'); // 削除後は一覧画面へリダイレクト
  } catch (error) {
    console.error('商品の削除に失敗しました', error);
    res.status(500).send('商品の削除に失敗しました');
  }
});

// ------------------------------
// サーバー起動
// ------------------------------

app.listen(port, (): void => {
  console.log(`Server started: http://localhost:${port}`);
});
