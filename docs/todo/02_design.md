# TODOアプリ V1 設計書

> 参照元: `docs/todo/01_requirements.md`（REQ-01〜REQ-04は変更しない）。要件定義書と本書が異なる場合は要件定義書を優先する。
> 本書はV1の実装仕様を確定する設計書。DB列・成功/エラーJSON・ステータスは本書で確定し、REQ-01〜REQ-04の機能要件を変更しない。HTTPステータスの区分は授業テキスト「4.1 代表的なステータスコード一覧」に準拠する。Vercel上の動作・DB内既存テーブルの有無は実装時に確認する。

## 1. 作るものとファイルの役割

既存の Express＋TypeScript＋EJS サイトに、`/todo` 画面と `/api/v1/todos` API を追加する。`/` と `/api/db-check` は維持する。DB接続は既存の `db.ts` と `DATABASE_URL` を再利用する。Vercel の Preview と Production は同じ Neon DB を使い、架空データのみを扱う。V1 では認証・優先度・絞り込み・タイトル更新・検索クエリを扱わない。

### ファイル構成（授業テキストに合わせた配置）

TODO用の新規ファイル配置は授業テキストの配置に準拠し、V1の構成として**確定**。既存の `index.ts`・`db.ts`・`package.json` の内容も確認済み。Vercelのデプロイ設定と新規ファイルの実在は実装時に確認する。

| ファイル | 役割 | 状態 |
|---|---|---|
| `index.ts` | `todoRouter` の import と mount のみ追加 | 既存確認済み。`app` 使用、静的配信・EJS設定済み |
| `db.ts` | `export const pool` を再利用、変更しない | 既存確認済み。`pg.Pool` / `DATABASE_URL` 使用 |
| `src/apps/todo/todoRouter.ts` | `/todo` とTODO APIのルーティング | 新規配置確定 |
| `src/apps/todo/todoController.ts` | 検証・Model呼出し・レスポンス生成 | 新規配置確定 |
| `src/apps/todo/todoModel.ts` | SQL実行 | 新規配置確定 |
| `views/todo/index.ejs` | TODO画面の骨組み | 新規配置確定 |
| `public/todo/todo.js` | `TodoApi` と画面イベント | 新規配置確定 |
| `sql/todo/020_create_todo_tasks.sql` | TODOテーブル作成SQL | 新規配置確定・列仕様確定 |
| `docs/todo/02_design.md` | 本設計書 | 保存先確定 |

既存の `package.json` は Express **5.2.1**、`pg` **8.23.1**、`ejs` **6.0.1**、`tsx` による開発起動を指定している。`/`、`/api/db-check`、`/db-sample` 関連ルートはそのまま維持する。

役割の分担は次の通り。

- **Router**: URL とメソッドで Controller を呼ぶ。
- **Controller**: 検証、Model 呼び出し、HTTP ステータスと JSON の生成。
- **Model**: SQL の実行のみ。HTTP の知識を持たない。
- **`todo.js`**: `TodoApi`（通信）と画面イベント（表示更新）。

## 2. リクエストはどこを通るか

### 2.1 処理の流れ

```text
ブラウザ /todo
 ├─ GET /todo → todoRouter → EJS描画 → HTML（骨組みのみ）
 └─ todo.js → TodoApi(fetch) → /api/v1/todos[/:id]
        index.ts（todoRouter を mount）
          → todoRouter（ルート判定、API用ミドルウェア）
          → todoController（検証・応答生成）
          → todoModel（SQL）
          → 既存 db.ts → Neon PostgreSQL
        ← Controller が HTTP 応答を生成 → TodoApi → 画面更新
```

### 2.2 index.ts への追記（最低限）

追加するのは import と mount の2行だけとする。

```typescript
import { todoRouter } from './src/apps/todo/todoRouter';
// 既存のルーティングの後、app.listen(port, ...) より前
app.use(todoRouter);
```

- `express.json()` や `express.urlencoded()` は `index.ts` に追加しない。JSON 解析は `todoRouter.ts` の `/api/v1/todos` 配下だけに適用する。既存ルートの挙動を変えず、JSON 解析エラーも TODO API 専用で統一形式にできる。
- 起動処理、既存API、DB接続設定は書き換えない。
- 既存の Express インスタンス名は `app`。`express.json()` は現行 `index.ts` にはなく、`express.urlencoded({ extended: true })` は設定済み。静的ファイルは `public/`、EJSのビューは `views/` を使う。

### 2.3 todoRouter.ts の骨子

```typescript
import express, { Router, Request, Response, NextFunction } from 'express';
import * as controller from './todoController'; // Controller の named export を採用する設計案
export const todoRouter = Router();

todoRouter.get('/todo', controller.showPage);

todoRouter.use('/api/v1/todos', (_req, res, next) => {
  res.set('Cache-Control', 'no-store'); // GET を CDN・ブラウザに再利用させない
  next();
});
todoRouter.use('/api/v1/todos', express.json({ limit: '10kb' }));

todoRouter.get('/api/v1/todos', controller.list);
todoRouter.post('/api/v1/todos', controller.create);
todoRouter.patch('/api/v1/todos/:id', controller.updateCompleted);
todoRouter.delete('/api/v1/todos/:id', controller.remove);

// API配下の未定義URL
todoRouter.use('/api/v1/todos', (_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '指定されたURLは存在しません' } });
});

// API配下のエラーハンドラ（ルート定義の後）
todoRouter.use('/api/v1/todos', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'JSONの形式が正しくありません' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(400).json({ success: false, error: { code: 'REQUEST_TOO_LARGE', message: 'リクエストが大きすぎます' } });
  }
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバー内部エラーが発生しました' } });
});
```

TODOの画面とAPIは単一 `todoRouter` にまとめる。未対応メソッド（例：`PUT /api/v1/todos`）は末尾の未定義URLハンドラでJSONの `404 NOT_FOUND` として返し、V1では `405` を使用しない。既存の Express は **5.2.1**。Controller は `try-catch` でエラーを明示的に処理し、既存ルートには影響させない。上記は骨子であり、Controllerの各関数は実装時に作成する。

## 3. DBの設計

**本章のテーブル名・列・型・制約をV1の実装仕様として確定する。** `updated_at` はV1で設けない。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | `SERIAL`（INTEGER） | PRIMARY KEY | 1以上の整数。上限 2147483647 |
| `title` | `VARCHAR(100)` | NOT NULL、`CHECK (char_length(title) BETWEEN 1 AND 100)` | 前後の空白を除いた値を保存 |
| `is_completed` | `BOOLEAN` | NOT NULL DEFAULT FALSE | 完了状態 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT CURRENT_TIMESTAMP | 作成日時 |

IDはDBの `SERIAL` に採番させる。既存の商品のサンプル実装にある `MAX(id)+1` は、同時登録時に同じIDが割り当てられるおそれがあるため採用しない。

```sql
CREATE TABLE IF NOT EXISTS todo_tasks (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(100) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100 AND title = btrim(title)),
  is_completed BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- DB の CHECK は、アプリの検証をすり抜けた場合の最後の防御である。`VARCHAR(100)` と `char_length` は文字（コードポイント）数で数える。`title = btrim(title)` はDB直接操作での前後の通常の空白の混入を防ぐ。全角空白等はアプリ側の `trim()` で除去する。
- DB の列名 `is_completed` と API の項目名 `completed` は、SELECT/RETURNING で `is_completed AS completed` と別名を付けて対応させる。
- SQL は必ずパラメータ化し（`$1`, `$2`）、文字列連結で入力値を埋め込まない。
- このSQLは一度だけ手動で実行する。アプリ起動時やデプロイ時に自動実行しない（Preview と Production が同じDBを共有するため）。
- 既存資料で確認できた `sql/` のSQL番号は `000` と `010` であり、`020` の番号重複はない。同名テーブル `todo_tasks` が実際のNeon DBに存在しないかは、作成前に照会する。

## 4. APIの共通ルール

**HTTPステータスの使い分けは授業テキスト「4.1 代表的なステータスコード一覧」に準拠する。** `success` / `data` / `error` のJSON形式・エラーコード・本文10KB上限は本設計で確定した。GET 0件は要件どおり200で `data: []`、DELETE成功は204で本文なし。POST成功時の201・PATCH成功時の200は本設計で決定した。

- ベースパスは `/api/v1/todos`。個別対象は `/:id`（1以上の整数）。
- GET は読み取りのみでDBを変更しない。DELETE は繰り返しても最終状態が同じ。
- リクエストは JSON（`Content-Type: application/json`）、本文の上限は 10KB。API の全応答に `Cache-Control: no-store` を付ける。
- 同一オリジンのみで使うため CORS は設定しない。

### 成功時

```json
{ "success": true, "data": [ { "id": 1, "title": "テスト", "completed": false, "created_at": "2026-10-28T00:00:00.000Z" } ] }
```

0件の一覧は `200` と `{ "success": true, "data": [] }`。DELETE 成功は `204`、本文なし。

### エラー時

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "利用者向けの概要メッセージ" } }
```

### 400/422 と 500/503 の境界、エラーコード

- **400**: リクエスト形式・構造・必須項目の欠落・型不一致（JSON構文不正、`title`/`completed` 未指定・型不一致、ID形式不正）。
- **422**: 形式と型は正しいが業務ルール違反（文字列titleのtrim後0文字、101文字以上等）。`completed` はbooleanの両値を許すため、現時点で422に該当する業務ルールはない。
- **500**: 内部のプログラム不具合、SQL構文エラー、DB例外など。
- **503**: 過負荷・メンテナンス等で利用不可の場合、および§7.3の列挙済み接続・停止エラーコードに一致した場合。すべてのDBエラーを503にはしない。
- 検証順序: パスIDの形式（400）→ JSON本文の解析・構造と必須/型（400）→ 値の業務ルール（422）→ 対象の存在（404）。

| ステータス | code | 発生条件 |
|---|---|---|
| 400 | `INVALID_PARAMETER` | `id` が `^[1-9][0-9]*$` に合わない、または 2147483647 を超える |
| 400 | `INVALID_JSON` | JSON の構文不正 |
| 400 | `REQUEST_TOO_LARGE` | 本文が10KBを超える |
| 400 | `INVALID_BODY` | 本文未指定・構造不正、必須項目不足、型不一致 |
| 422 | `VALIDATION_ERROR` | 文字列titleがtrim後0文字・101文字以上・NUL文字を含むなど、値の業務ルール違反 |
| 404 | `NOT_FOUND` | 更新・削除の対象IDが存在しない、または未定義のURL |
| 500 | `INTERNAL_SERVER_ERROR` | プログラムエラー・SQL構文エラー・通常のDB例外 |
| 503 | `SERVICE_UNAVAILABLE` | §7.3に列挙した接続・停止エラーコードに一致した場合など、サービスが利用不可 |

メッセージには SQL、スタックトレース、接続情報などの内部情報を含めない。

## 5. API詳細設計

各JSON例は第4章で確定した共通フォーマットを用いる。`created_at` は第3章で確定したDB列を使用する。エラー応答の例は `{"success":false,"error":{"code":"...","message":"..."}}`。GETやDELETEに本文を送らない。

### 5.1 REQ-01 TODO一覧を取得する

| 項目 | 内容 |
|---|---|
| メソッド・URL | `GET /api/v1/todos` |
| リクエスト本文 | なし |
| 成功ステータス | `200 OK`（0件でも200） |
| 成功JSON | `{"success":true,"data":[{"id":1,"title":"買い物","completed":false,"created_at":"2026-10-28T00:00:00.000Z"}]}`。0件時は必ず `data: []` |
| 失敗ステータス | `500`（内部・DB例外）、`503`（一時的なサービス利用不可） |
| 失敗JSON | 第4章の共通エラー形式。500: `INTERNAL_SERVER_ERROR`、503: `SERVICE_UNAVAILABLE` |
| DB処理 | `SELECT id, title, is_completed AS completed, created_at FROM todo_tasks ORDER BY created_at DESC, id DESC;` |
| TodoApi | `getTodos()` |
| 確認方法 | 0件と複数件でステータス・画面・並び順・DBが読み取り前後で不変であることを確認 |

### 5.2 REQ-02 TODOを登録する

| 項目 | 内容 |
|---|---|
| メソッド・URL | `POST /api/v1/todos` |
| リクエスト本文 | `{"title":"買い物に行く"}` |
| 成功ステータス | `201 Created` |
| 成功JSON | `{"success":true,"data":{"id":1,"title":"買い物に行く","completed":false,"created_at":"2026-10-28T00:00:00.000Z"}}` |
| 失敗ステータス | `400`（JSON不正・title未指定・型不一致）、`422`（文字列titleがtrim後0文字/101文字以上）、`500` / `503` |
| 失敗JSON | 第4章の形式。400: `INVALID_JSON` / `INVALID_BODY`、422: `VALIDATION_ERROR`、500/503: 共通コード |
| DB処理 | `INSERT INTO todo_tasks (title) VALUES ($1) RETURNING id, title, is_completed AS completed, created_at;`（trim済みtitleを引数にする） |
| TodoApi | `createTodo(title)` |
| 確認方法 | 0・1・100・101文字、半角・全角空白のみ、前後空白、絵文字の100/101コードポイント、NUL、数値/null/未指定、JSON不正を試してステータス、登録結果、画面を確認 |

### 5.3 REQ-03 完了状態を変える

| 項目 | 内容 |
|---|---|
| メソッド・URL | `PATCH /api/v1/todos/:id` |
| リクエスト本文 | `{"completed":true}` または `{"completed":false}`。`completed` 以外の項目（`title` など）は無視し、タイトルは更新しない |
| 成功ステータス | `200 OK` |
| 成功JSON | `{"success":true,"data":{"id":1,"title":"買い物","completed":true,"created_at":"2026-10-28T00:00:00.000Z"}}` |
| 失敗ステータス | `400`（ID形式不正、JSON不正、completed未指定・型不一致）、`404`（IDなし）、`500` / `503`。現仕様にPATCH固有の422条件なし |
| 失敗JSON | 第4章の形式。400: `INVALID_PARAMETER` / `INVALID_JSON` / `INVALID_BODY`、404: `NOT_FOUND`、500/503: 共通コード |
| DB処理 | `UPDATE todo_tasks SET is_completed = $1 WHERE id = $2 RETURNING id, title, is_completed AS completed, created_at;`（0件なら404） |
| TodoApi | `updateTodoStatus(id, completed)` |
| 確認方法 | true/false、同じ値、未指定/文字列/数値、ID=0/負数/小数/`1e2`/`01`/`2147483648`/存在しない値を試し、他列が変わらないことを確認 |

### 5.4 REQ-04 TODOを削除する

| 項目 | 内容 |
|---|---|
| メソッド・URL | `DELETE /api/v1/todos/:id` |
| リクエスト本文 | なし |
| 成功ステータス | `204 No Content` |
| 成功レスポンス | **本文なし（JSONを返さない）** |
| 失敗ステータス | `400`（ID形式不正）、`404`（対象なし、再削除も404）、`500` / `503` |
| 失敗JSON | 第4章の形式。400: `INVALID_PARAMETER`、404: `NOT_FOUND`、500/503: 共通コード |
| DB処理 | `DELETE FROM todo_tasks WHERE id = $1 RETURNING id;`（0件なら404） |
| TodoApi | `deleteTodo(id)` |
| 確認方法 | 削除時204・本文なし、一覧から消失、同一IDの再DELETE時404でも最終DB状態不変を確認 |

## 6. 画面とTodoApiの設計

### 6.1 表示方式（クライアント描画）

**URLの注意:** 既存 `index.ts` は `express.static(public)` を Router より前に登録している。`public/todo/` の作成後、静的ミドルウェアのディレクトリ処理により `GET /todo` は通常 `301` で `/todo/` にリダイレクトされる。`/todo/` は Router の `GET /todo` で画面を表示できる想定だが、実際のローカルとVercelでリダイレクト先と表示を確認する。`index.ts` は変更せず、このURL変化をV1の仕様として許容する。

1. `GET /todo`（静的配信により `/todo/` へリダイレクトする場合あり）で EJS が骨組みのみを返す（`<script src="/todo/todo.js" defer>`。ES Modules は使わない）。
2. `DOMContentLoaded` で `TodoApi.getTodos()` を実行し、`<ul>/<li>` を構築する。
3. 取得中は「読み込み中」、0件は「タスクはありません」、失敗は一覧領域にエラーメッセージと再読み込みボタンを表示する。

ローカルでは既存の `express.static(path.join(process.cwd(), 'public'))` により `/todo/todo.js` で配信する。EJSの基準ディレクトリは `views/`。**Vercel上での静的ファイル配信とEJS同梱は要確認**。

### 6.2 画面の挙動

| 操作 | 挙動 |
|---|---|
| 登録 | 送信中は登録ボタンを無効化（二重送信防止）。成功後は入力欄を空にして一覧を再取得。失敗時は入力値を残してエラー表示 |
| 完了切替 | 送信中はそのチェックボックスを無効化。失敗時はチェック状態を元に戻し、エラー表示 |
| 削除 | 成功後に一覧を再取得。`404` の場合も「すでに削除されています」と表示して一覧を再取得 |

ユーザー入力は `textContent` で DOM に設定し、`innerHTML` に title を連結しない。日時は `new Date(created_at).toLocaleString('ja-JP')` で表示する。

### 6.3 TodoApi（`public/todo/todo.js`）

全メソッドで「成功時はデータを返す／失敗時は `TodoApiError` を投げる」に統一する。非JSON応答（HTML の 500/504 など）や通信断も同じ形で扱う。`TodoApi` のメソッド名と引数は本設計で確定する。

```javascript
class TodoApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, { cache: 'no-store', ...options });
  } catch {
    throw new TodoApiError(0, 'NETWORK_ERROR', '通信に失敗しました。接続を確認してください');
  }
  if (res.status === 204) return null; // 本文なし。JSONを読まない
  let body = null;
  try { body = await res.json(); } catch { /* JSONでない応答 */ }
  if (!res.ok) {
    const e = body && body.error;
    throw new TodoApiError(res.status, (e && e.code) || 'UNKNOWN_ERROR',
      (e && e.message) || `サーバーエラーが発生しました（${res.status}）`);
  }
  return body ? body.data : null;
}

class TodoApi {
  static getTodos() { return request('/api/v1/todos'); }

  static createTodo(title) {
    return request('/api/v1/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  }

  static updateTodoStatus(id, completed) {
    return request(`/api/v1/todos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
  }

  static deleteTodo(id) {
    return request(`/api/v1/todos/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
```

画面イベント処理は `TodoApi` を呼び、`catch` で `error.message` を表示する。通信・ステータス判定・本文の読み取りは `TodoApi` が担当する。

## 7. エラーはどこで処理するか

### 7.1 層ごとの責務

| 場所 | 役割 |
|---|---|
| Model | SQLを実行し、例外は捕捉せず投げる。更新・削除で 0 行だったことを返す |
| Controller | 検証、`try-catch`、ステータスと JSON の決定、サーバー側ログ出力（接続文字列は出さない） |
| Router のエラーハンドラ | JSON解析エラーなど、Controller に届く前のエラーを統一形式に変換 |
| `todo.js` | 非2xx・通信失敗を受け取りメッセージを表示。失敗した完了切替・削除を成功扱いしない |
| 既存のエラー処理 | 確認済みの `index.ts` には共通エラーハンドラはなく、各既存ルートで `try-catch` と `console.error` を使っている。TODO API用のハンドラを追加しても既存ルートは変更しない |

### 7.2 入力検証（Controller 内）

**ID**: `^[1-9][0-9]*$` に合い、かつ 2147483647 以下。

```typescript
const ID_PATTERN = /^[1-9][0-9]*$/;
const PG_INT_MAX = 2147483647;

function parseId(raw: string): number | null {
  if (!ID_PATTERN.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n <= PG_INT_MAX ? n : null;
}
```

`isNaN` と `id < 1` だけでは `1.5`・`1e2` が通り、`parseInt` では `1abc` が 1 になる。上限超過は PostgreSQL のエラーになるため、先に 400 にする。

**title**（形式・型の不備は400、値の業務ルール違反は422）:

1. `title` 未指定、null、数値、配列等の型不一致は **400**。
2. 文字列が `\u0000`（NUL文字）を含む場合は安全な保存ができない入力として **422**（設計上の検証条件）。
3. `trim()` 後の文字数が1〜100以外なら **422**。`Array.from(trimmed).length` でコードポイント数を数える。
4. 保存するのは `trim()` 後の値。

**completed**: `typeof completed === 'boolean'`。`"true"`、`1`、null、未指定は型・構造の不備で **400**。boolean `true` / `false` はどちらも有効で、現在のルールでは422を返すケースはない。

**本文**: JSON構文不正、本文なし、期待するJSONオブジェクトでない、必須項目なし・型不一致は **400**。`Content-Type` がJSONでない場合も構造不備として400に整理する（必要なら415への変更をV2で検討）。`req.body` が未定義でも安全に判定する。

### 7.3 500 と 503 の判定

授業テキストの区分により、プログラムエラーや通常のDB例外は **500**、過負荷・メンテナンス・一時的な接続障害などサービスが一時的に利用できない場合は **503** とする。実装とテストの判定を統一するため、下表に列挙したNode/PostgreSQLのエラーコードに一致すれば **503**、それ以外のアプリで捕捉した例外は **500** とする。これはV1の機械的な分類規則であり、障害原因が実際に一時的であることを保証するものではない。

| 判定条件 | 対応 |
|---|---|
| Nodeコード `ECONNREFUSED` / `ECONNRESET` / `ETIMEDOUT` / `EAI_AGAIN` | **503** |
| PostgreSQLコード `08000` / `08001` / `08003` / `08004` / `08006` / `57P01` / `57P02` / `57P03` / `53300` | **503** |
| `ENOTFOUND`、`08P01`、SQL構文エラー、制約違反、コード上の不具合、原因不明、および表にないエラーコード | **500** |
| Vercel等が生成するHTMLの504 | アプリからJSONを返せたとは扱わない。TodoApiで非JSON応答として表示する |

確認済みの `db.ts` の `Pool` には **`connectionTimeoutMillis` の指定がない**。そのため「プールの設定した接続タイムアウト」を503の独立した判定条件にはしない。接続待ちが長引くとVercel側のタイムアウトによる504等が先に発生する可能性がある。V1では `db.ts` を変更しないため、接続遅延時の挙動は環境別テストで記録する。

## 8. 実装への注意事項

1. **既存コードの確認済み事項**: `index.ts` は `app`、`express.urlencoded`、`express.static(public)`、EJS `views/` を使用し、`express.json()` は未使用。`db.ts` は `pool` をexport。`package.json` は Express 5.2.1 / `tsx watch ./index.ts`。Vercel設定とNeon DBの既存テーブルの実在は実行環境で確認する。既存の共通エラーハンドラはない。
2. **`index.ts` の追記は最低限**（import と mount のみ）。`/` と `/api/db-check` の動作を維持する。
3. **SQLは必ずパラメータ化する**。サーバー側で入力検証を行う。
4. **`pool.query()` を直接使う**（`src/apps/todo/todoModel.ts` から `../../../db` の `pool` をimportする）。`pool.connect()` を使う場合は `finally` で `release()` する。`DATABASE_URL` が Neon のプール接続用（`-pooler`）かも確認する **［要確認］**。
5. **PreviewとProductionは同じDBを使う**: テストデータの title には `[TEST]` のような接頭辞を付け、自分が作ったデータだけを削除する。一括削除の処理・SQLは作らない。スキーマ変更は本番にも即時に影響する。
6. **認証がない**: URL を知っていれば誰でも作成・削除できるため、個人情報・実データは入れない。
7. **`DATABASE_URL` をコード・ログ・エラー応答に出さない**。既存 `db.ts` では `dbUrl.searchParams.set('sslmode', 'verify-full')` の結果を接続に使っておらず、実際に使われるのは `process.env.DATABASE_URL`。TODO追加に伴う変更はせず、SSL設定の実効性は別途確認する。
8. **本設計で確定した仕様**: DB列・JSON共通構造・エラーコード名・10KB制限、POST/PATCHの成功ステータスを確定した。`01_requirements.md` のREQ-01〜04は変更しない。
9. **未対応メソッド**: `PUT /api/v1/todos` 等は V1 では JSON の404を返すことを確認する。
10. **環境別確認**: ローカル、Vercel Preview、Productionで `/`、`/api/db-check`、`/todo`（`/todo/` への301を含む）と4操作を確認する。共有DBでは架空のテストデータのみを使用する。
