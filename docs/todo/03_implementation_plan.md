# TODOアプリ V1 実装手順書

> 保存先: `docs/todo/03_implementation_plan.md`  
> 根拠: `docs/todo/01_requirements.md`（REQ-01〜REQ-04）、`docs/todo/02_design.md`（確定したV1設計）  
> 本書は**これから行う作業の手順**であり、実装済み・テスト合格・デプロイ済みを意味しない。実行結果は `docs/todo/04_test_results.md` に記録する。

## 1. 実装前の前提・仕様照合

### 1.1 既存ファイルと保護対象

- 既存 `index.ts`: Expressの `app` を使用し、`express.urlencoded({ extended: true })`、`express.static(path.join(process.cwd(), 'public'))`、EJSの `views/` を設定済み。`express.json()` は未設定。`/`、`/api/db-check`、`/db-sample` とその登録・削除ルートを**変更しない**。
- 既存 `db.ts`: `DATABASE_URL` と `export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })` を使用。**変更しない**。`connectionTimeoutMillis` の設定はない。`dbUrl` に対する `sslmode` の書き換えは実際の `Pool` に渡されていないので、この演習では改修せず別件として扱う。
- 既存 `package.json`: `dev` は `tsx watch ./index.ts`、`build` は `tsc`、`start` は `node ./dist/index.js`。Express 5.2.1、`pg` 8.23.1、EJS 6.0.1、TypeScript 7.0.2 の宣言を確認済み。依存パッケージの追加は原則不要。
- **要確認**: `tsconfig.json` の実際の内容は提供されていない。`rootDir`、`outDir`、`module`、`moduleResolution`、`include`、EJS等のデプロイ時の同梱方法を実装前に確認する。Vercelでのビルド・関数ルーティングも実環境で確認する。

### 1.2 文書間で固定する名前と仕様

| 対応 | 要件（変更しない） | 設計に従う実装・テスト条件 |
|---|---|---|
| REQ-01 **TODO一覧表示** | `GET /api/v1/todos`、0件でも200・`data: []`、DB非変更 | `SELECT`、`created_at DESC, id DESC`、`getTodos()`、空状態表示は「タスクはありません」 |
| REQ-02 **TODO登録** | `POST /api/v1/todos`、`title` は前後の空白を除き1〜100文字 | 201、`createTodo(title)`、トリム後INSERT、登録結果を返す |
| REQ-03 **完了状態の部分更新** | `PATCH /api/v1/todos/:id`、完了状態のみ変更 | 200、`{ "completed": true/false }`、`updateTodoStatus(id, completed)`、他のキーは無視 |
| REQ-04 **TODO削除** | `DELETE /api/v1/todos/:id`、成功204・本文なし、存在しないIDは404 | 物理DELETE、`deleteTodo(id)`、同じIDを再削除すると404（最終状態は不変） |

- 画面: `/todo`（既存の `express.static(public)` が先に動作するため、`public/todo/` 作成後は通常 `/todo/` への301が発生する。両URLの確認が必要）。ブラウザJSは `/todo/todo.js`。
- DB: `todo_tasks(id SERIAL PRIMARY KEY, title VARCHAR(100), is_completed BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`。`updated_at` は設けない。DBカラム `is_completed` はAPIで `completed` に別名を付ける。
- 共通成功JSON: `{"success":true,"data":...}`。GETは配列、POST/PATCHはオブジェクト、DELETE 204は**本文なし**。共通エラーJSON: `{"success":false,"error":{"code":"...","message":"..."}}`。
- 構造・型の不正（JSON不正、必須欠落、型不一致、ID形式不正）は**400**。文字列 `title` のトリム後0文字・101文字以上・NULは**422**。対象IDなしは**404**。内部例外は**500**、設計書§7.3に列挙された接続・停止エラーコードは**503**。未対応APIメソッドはJSONの404。
- `title` の長さは `Array.from(title.trim()).length` で判定し、1〜100コードポイント。`id` は正規表現 `^[1-9][0-9]*$` に一致し、2147483647以下で安全な整数であること。
- V1対象外: 認証、優先度、絞り込み、検索クエリ、タイトル更新。PreviewとProductionは同一Neon DBを利用し、**個人情報を入れず、架空のデータのみ使う**。

**作業着手前の一致確認:** `01_requirements.md` のREQ番号・機能・URL・入力制限と、`02_design.md` の表を照合し、差があれば先に文書を修正する。特に `is_completed`（DB）と `completed`（API）を混同しない。

### 1.3 共通の実行方法

以下のコマンド例は**プロジェクト直下から Bash系ターミナル**で実行する。Windows PowerShellでは `curl` の挙動が異なることがあるため、`curl.exe` を使う。`BASE_URL` は環境に合わせて置き換える。APIの実測結果は、実行前に決めた期待値と区別して記録する。

```bash
npm install
npm run build
npm run dev
```

確認用コマンドは**別のターミナル**で実行する（開発サーバーを起動したままにする）。`npm run dev` の期待URLは `http://localhost:3000`。`npm run build` の成功だけでEJS・静的ファイルが本番で配信できるとは判断しない。

## 2. 作業工程（小さな変更単位）

### 工程01　既存機能・設定のベースライン確認

- **対象ファイル:** `index.ts`、`db.ts`、`package.json`、`tsconfig.json`（読み取りのみ）。
- **作業:** `git status` で現在の変更を確認し、`tsconfig.json` の設定（特に `noUnusedLocals`）とVercel設定ファイルの有無を調べる。`npm run build` 後に `dist/` がGitの追跡対象や未追跡ファイルとして現れないこと、`.gitignore` の設定も確認する。既存のルートが動くことを記録する。`DATABASE_URL` の**値は表示・コミットしない**。
- **確認コマンド:**

```bash
git status --short
cat tsconfig.json
cat .gitignore  # ファイルがある場合に確認
npm run build
git status --short  # dist/ が表示されていないか確認
git check-ignore dist/  # ignore対象なら dist/ が表示される（未設定なら終了コード1）
npm run dev
# 別ターミナルで
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/db-check
curl -i http://localhost:3000/db-sample
```

- **期待結果:** ビルドが成功し、`/` が表示され、`/api/db-check` が接続成功JSONを返す。`/db-sample` が既存どおり動く（サンプルのproducts表がある環境）。
- **失敗時に最初に見る場所:** `tsconfig.json` の `rootDir/outDir/include/noUnusedLocals`、`.gitignore` と `dist/` の追跡状態、ターミナルのビルドエラー、`index.ts` のルート順、`db.ts` のログとNeon接続状態。`DATABASE_URL` の内容はログや提出物に貼らない。

### 工程02　TODO用SQLファイルを作成しGitへ保存（DBではまだ実行しない）

- **対象ファイル:** `sql/todo/020_create_todo_tasks.sql`（新規）。
- **作業:** 設計書§3の確定SQLを**そのまま**保存する。`SERIAL` に自動採番させ、`MAX(id)+1` は使わない。CHECKで長さ1〜100文字と `title = btrim(title)` を強制する。`IF NOT EXISTS` は既存スキーマ一致を保証しないため、次工程で既存表を確認する。
- **確認コマンド:**

```bash
git diff --check
git add sql/todo/020_create_todo_tasks.sql
git diff --cached -- sql/todo/020_create_todo_tasks.sql
# 内容を確認してから
git commit -m "Add TODO table creation SQL"
```

- **期待結果:** SQLファイルがGit履歴に保存される。**NeonのDBはこの工程では変化しない**。
- **失敗時に最初に見る場所:** 保存先のスペル、SQLの列名・CHECK・DEFAULT、`git status`、`git diff --cached`。他の変更を誤って一緒にコミットしない。

### 工程03　Neon SQL EditorでSQLを手動実行

- **対象:** Neonの自分のDB、工程02でGit保存したSQL。アプリコードは変更しない。
- **作業:** SQL Editorのプロジェクト・ブランチ・データベースを確認。**①事前照会だけ実行 → ②存在しない場合だけCREATEを実行 → ③列・制約・件数を確認**と分離する。すべてを一括実行しない。同名表がある場合は停止して定義を照合する。PreviewとProductionが同じDBを使うため、DROP/TRUNCATEは行わない。

**① 作成前（これだけ先に実行）**

```sql
SELECT to_regclass('public.todo_tasks') AS existing_table;
```

`existing_table` が `NULL` なら②へ進む。NULL以外なら**作成せず**既存定義を確認する。

**② 作成（①がNULLの場合のみ）**

Git保存した `sql/todo/020_create_todo_tasks.sql` の全文をNeon SQL Editorへ貼り付けて実行する。

**③ 作成後（②の成功後のみ）**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'todo_tasks'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.todo_tasks'::regclass
ORDER BY conname;

SELECT COUNT(*) FROM public.todo_tasks;
```

- **期待結果:** 4列とPRIMARY KEY/CHECK等の制約が設計書§3に一致。初回新規作成の場合は0件。DB定義をアプリ起動時・デプロイ時には変更しない。
- **失敗時に最初に見る場所:** SQL Editorの接続先・権限、既存表の有無、CHECK/DEFAULTの定義、SQL実行エラー。Neon SQL Editorで `\d`（psql専用コマンド）は使わない。

### 工程04A　Routerの骨組みとindex.tsへの登録（先に配線する）

- **対象ファイル:** `src/apps/todo/todoRouter.ts`（新規）、`index.ts`（importとmountの2行）。
- **作業:** 最初にRouterを作り、API共通の `Cache-Control: no-store`、`express.json({limit:'10kb'})`、未対応メソッド・未定義APIパスのJSON 404、JSON解析エラーハンドラを定義する。APIのGET/POST/PATCH/DELETEは後工程で順次追加する。画面の `showPage` と `/todo` も工程09でEJSと同時に追加する。`index.ts` では既存ルート後・`app.listen` 前に `app.use(todoRouter)`、先頭に `import { todoRouter } from './src/apps/todo/todoRouter'` だけを追加する。Routerの末尾404はAPI配下に限り、既存ルートを巻き込まないようにする。
- **確認コマンド:**

```bash
npm run build
curl -i -X PUT http://localhost:3000/api/v1/todos
curl -i http://localhost:3000/api/db-check
curl -i http://localhost:3000/
```

- **期待結果:** ビルド成功、未対応PUTは共通JSONの404、既存2ルートは従来どおり。**この段階ではGET一覧APIと `/todo` 画面は未実装であり、404になってよい**。
- **失敗時に最初に見る場所:** Routerのimport/export、`index.ts` のmount位置、JSON解析・未定義URLハンドラの順序、ルートのマッチ範囲。

### 工程04B　共通エラー判定と入力検証関数をController内に用意

- **対象ファイル:** `src/apps/todo/todoController.ts`。
- **作業:** §7.2の `parseId`、title検証（構造/型は400、文字数・NULは422）、completed検証（非booleanは400）、§7.3の500/503分類を**Controller内**に定義し、後工程で再利用する。`todoValidation.ts` は作成しない。検証関数の例:

```typescript
const ID_PATTERN = /^[1-9][0-9]*$/;
const PG_INT_MAX = 2147483647;

function parseId(raw: string): number | null {
  if (!ID_PATTERN.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id <= PG_INT_MAX ? id : null;
}

function validateTitle(value: unknown):
  | { ok: true; title: string }
  | { ok: false; status: 400 | 422; code: 'INVALID_BODY' | 'VALIDATION_ERROR' } {
  if (typeof value !== 'string') return { ok: false, status: 400, code: 'INVALID_BODY' };
  const title = value.trim();
  if (title.includes('\u0000') || Array.from(title).length < 1 || Array.from(title).length > 100) {
    return { ok: false, status: 422, code: 'VALIDATION_ERROR' };
  }
  return { ok: true, title };
}

const TRANSIENT_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN',
  '08000', '08001', '08003', '08004', '08006',
  '57P01', '57P02', '57P03', '53300',
]);

function classifyDbError(error: unknown): 500 | 503 {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return 503;
  }
  return 500;
}
```

- **確認コマンド:** `npm run build`。工程01で `noUnusedLocals: true` を確認した場合、未使用の関数はビルドエラーになり得るため、必要に応じて検証関数を `export` するか、工程04Cまで続けて使用箇所を追加したうえでビルドする。設定を無断で緩めない。
- **期待結果:** 関数が使用または適切にexportされた時点でコンパイル成功。**この工程では検証関数の動作確認は未実施**。`1e2` / `01` / `2147483648` のID不正は工程06〜07、タイトルの400/422は工程05、共通エラー分類は工程04C以降と工程10で実際のHTTP応答を確認する。
- **失敗時に最初に見る場所:** Controllerの関数名・スコープ、`unknown` 型の絞り込み、エラー分類の集合。

### 工程04C　REQ-01 TODO一覧表示 API

- **対象ファイル:** `src/apps/todo/todoModel.ts`、`src/apps/todo/todoController.ts`（工程04Bのファイルに追記）、`src/apps/todo/todoRouter.ts`（GETを追加）。
- **作業:** `todoModel.ts` は既存 `db.ts` の `pool` を `../../../db` からimportして一覧用SELECTを実装。ControllerはModelを呼び、成功 `200 {"success":true,"data":[...]}`、例外は§3の500/503に変換する。Routerに `GET /api/v1/todos` を、APIの404ハンドラより**前**に登録する。EJSは工程09まで作らないため `/todo` はここでは確認しない。
- **Modelの最小コード例**（他のCRUD用Model関数は工程05〜07で追加）:

```typescript
import { pool } from '../../../db';

export interface TodoRow {
  id: number;
  title: string;
  completed: boolean;
  created_at: Date; // pgのTIMESTAMPTZは通常Dateとして返る。JSON応答時にISO文字列化される
}

export async function selectAllTodos(): Promise<TodoRow[]> {
  const result = await pool.query<TodoRow>(
    `SELECT id, title, is_completed AS completed, created_at
       FROM todo_tasks ORDER BY created_at DESC, id DESC`
  );
  return result.rows;
}
```

- **Controllerの例**（エラー分類は共通関数で実装。すべてのAPIで再利用する）:

```typescript
import type { Request, Response } from 'express';
import { selectAllTodos } from './todoModel';

export async function list(_req: Request, res: Response): Promise<void> {
  try {
    const todos = await selectAllTodos();
    res.status(200).json({ success: true, data: todos });
  } catch (error: unknown) {
    // 実際には §7.3 に従う共通のエラー分類関数をController内で使用する
    const status = classifyDbError(error); // 同ファイルに実装する関数
    console.error('TODO一覧取得失敗', error); // 接続文字列は出力しない
    res.status(status).json({
      success: false,
      error: { code: status === 503 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR',
               message: 'TODO一覧を取得できませんでした' },
    });
  }
}
```

- **確認コマンド:**

```bash
npm run build
curl -i http://localhost:3000/api/v1/todos
curl -i -X PUT http://localhost:3000/api/v1/todos
curl -i http://localhost:3000/api/db-check
```

- **期待結果:** TODOが0件なら `200` と `{"success":true,"data":[]}`。複数件は `created_at DESC, id DESC`。GET後もDB状態不変。PUTはJSON 404、既存 `/api/db-check` は正常。
- **失敗時に最初に見る場所:** `index.ts` のmount、RouterのGET登録順、Model importとSELECT、Neonの接続、Controller例外分類。

### 工程05　REQ-02登録API

- **対象ファイル:** `todoController.ts`、`todoModel.ts`、`todoRouter.ts`。
- **作業:** `POST /api/v1/todos` と `create` を追加。JSONの本文構造・`title` 必須/型を400で判定し、文字列ならNUL、trim後0/101文字以上を422で判定。`Array.from(trimmed).length` を使用。`INSERT INTO todo_tasks (title) VALUES ($1) RETURNING id, title, is_completed AS completed, created_at` で作成し、201+作成オブジェクトを返す。`SERIAL` に採番を任せる。**POSTルートはRouter末尾のJSON 404ハンドラより前に追加する**（後ろでは常に404になる）。
- **確認コマンド:**

```bash
npm run build
curl -i -X POST http://localhost:3000/api/v1/todos -H 'Content-Type: application/json' -d '{"title":"[TEST] 買い物"}'
curl -i -X POST http://localhost:3000/api/v1/todos -H 'Content-Type: application/json' -d '{}'
curl -i -X POST http://localhost:3000/api/v1/todos -H 'Content-Type: application/json' -d '{"title":"   "}'
curl -i http://localhost:3000/api/v1/todos
```

- **期待結果:** 正常入力が201で保存、GETで再取得可能。`{}` は400 `INVALID_BODY`、空白のみは422 `VALIDATION_ERROR`。境界値1/100/101コードポイント、全角空白、絵文字、NUL、数値/null、壊れたJSON、10KB超を追加確認する（§4）。
- **失敗時に最初に見る場所:** RouterのPOST登録位置（末尾JSON 404より前）、`express.json()` の適用位置、Controllerの入力検証順、`trim()` とコードポイント数、`INSERT` の列名とパラメータ、CHECK制約・PostgreSQLエラー。

### 工程06　REQ-03完了状態の部分更新API

- **対象ファイル:** `todoController.ts`、`todoModel.ts`、`todoRouter.ts`。
- **作業:** `PATCH /api/v1/todos/:id` を追加。IDの正規表現と上限を400検証、`completed` が厳密なbooleanでなければ400 `INVALID_BODY`。`completed` 以外のキーは無視する。`UPDATE ... SET is_completed = $1 WHERE id = $2 RETURNING ...` で更新し、0件なら404、成功は200と更新後データを返す。タイトル・作成日時を更新しない。**PATCHルートはRouter末尾のJSON 404ハンドラより前に追加する**。
- **確認コマンド:**

```bash
npm run build
# 工程05で実際に登録した自分の [TEST] レコードIDに置き換える（例の123はそのまま使わない）
TODO_ID=123
curl -i -X PATCH http://localhost:3000/api/v1/todos/${TODO_ID} -H 'Content-Type: application/json' -d '{"completed":true}'
curl -i -X PATCH http://localhost:3000/api/v1/todos/${TODO_ID} -H 'Content-Type: application/json' -d '{"completed":"true"}'
curl -i -X PATCH http://localhost:3000/api/v1/todos/0 -H 'Content-Type: application/json' -d '{"completed":true}'
```

- **注意:** 上記 `TODO_ID=123` と `${TODO_ID}` はBash系ターミナル用。PowerShellでは `$TODO_ID = 123` とし、URLを `http://localhost:3000/api/v1/todos/$TODO_ID` のように指定する。
- **期待結果:** 存在する対象は200でbooleanが反映され、`title` と `created_at` が不変。型違い・不正IDは400、存在しないIDは404。`{"completed":false,"title":"変更しない"}` を送ってもtitleは変わらない。
- **失敗時に最初に見る場所:** RouterのPATCH登録位置（末尾JSON 404より前）、対象IDが実在するか、ControllerのID/boolean検証、`WHERE id = $2` と `rowCount`、DB列 `is_completed` とAPIフィールド `completed` の取り違え。

### 工程07　REQ-04削除API

- **対象ファイル:** `todoController.ts`、`todoModel.ts`、`todoRouter.ts`。
- **作業:** `DELETE /api/v1/todos/:id` を追加。IDを400検証。`DELETE FROM todo_tasks WHERE id = $1 RETURNING id` を実行し、0件なら404、削除できたら `res.status(204).end()` で本文を送らない。自分の `[TEST]` レコードだけに実行する。**DELETEルートはRouter末尾のJSON 404ハンドラより前に追加する**。
- **確認コマンド:**

```bash
npm run build
# 自分が登録した削除対象 [TEST] レコードの実IDに置き換える（例の123はそのまま使わない）
TODO_ID=123
curl -i -X DELETE http://localhost:3000/api/v1/todos/${TODO_ID}
curl -i -X DELETE http://localhost:3000/api/v1/todos/${TODO_ID}
curl -i http://localhost:3000/api/v1/todos
```

- **注意:** 上記 `TODO_ID=123` と `${TODO_ID}` はBash系ターミナル用。PowerShellでは `$TODO_ID = 123` とし、URLを `http://localhost:3000/api/v1/todos/$TODO_ID` のように指定する。
- **期待結果:** 初回204かつ本文なし、再DELETEはJSON 404。削除対象は一覧から消え、DBの最終状態は同じ。
- **失敗時に最初に見る場所:** RouterのDELETE登録位置（末尾JSON 404より前）、削除対象ID、SQLの `WHERE`、`RETURNING` の0行判定、204応答時に `json()` を呼んでいないか。

### 工程08　TodoApi（通信層）を実装

- **対象ファイル:** `public/todo/todo.js`（新規、まず通信処理のみ）。
- **作業:** 設計書§6.3の `TodoApiError` と共通 `request()`、`getTodos()`、`createTodo(title)`、`updateTodoStatus(id, completed)`、`deleteTodo(id)` を実装。同一オリジンへ `fetch`、送信時JSONヘッダ、204はJSON解析しない。非2xx、非JSONのHTMLエラー、ネットワーク失敗を画面側に伝える。タイトルのDOM挿入には使用しない。
- **確認コマンド:**

```bash
npm run build
curl -i http://localhost:3000/todo/todo.js
```

- **期待結果:** `200` でJavaScriptが配信され、APIの4操作が設計されたURL・メソッドで呼び出せる。204/非JSON/通信失敗を処理できる（ブラウザ開発者ツールのNetwork/Consoleで後続工程にて確認）。
- **失敗時に最初に見る場所:** `express.static`、JSファイルの配置・構文、ブラウザのConsole、NetworkのURL・Content-Type・ステータス。

### 工程09　EJS画面とイベントを実装

- **対象ファイル:** `views/todo/index.ejs`（新規）、`public/todo/todo.js`（画面イベント追加）、`todoController.ts` の `showPage`、`todoRouter.ts` の `GET /todo` ルート。
- **作業:** フォーム、一覧、読み込み中/0件/エラー表示、チェックボックス、削除ボタンを作成。`<script src="/todo/todo.js" defer></script>` で読み込む。初回・操作後にAPIで再取得し、タイトルは `textContent` で表示（XSS防止）。登録時の二重送信抑止、更新失敗時の表示復元、削除404時の再取得を実装。この工程で初めて `showPage` と `GET /todo` を追加する。
- **確認コマンド:**

```bash
npm run build
curl -i http://localhost:3000/todo
curl -i http://localhost:3000/todo/
curl -i http://localhost:3000/todo/todo.js
```

- **期待結果:** `/todo` から通常301で `/todo/` へ移動し、最終的にEJS画面が表示される。0件で「タスクはありません」。フォームで登録・状態変更・削除ができ、ブラウザのNetworkにGET/POST/PATCH/DELETEが記録される。
- **失敗時に最初に見る場所:** `express.static` による301/URL衝突、`res.render('todo/index')`、`views/` の実パス、`todo.js` の読み込みとイベント登録、ブラウザConsole。

### 工程10　ローカル統合・回帰・異常系テスト

- **対象ファイル:** TODO関連の実装一式、`docs/todo/04_test_results.md`（結果記録）。既存ファイルは原則触らない。
- **作業:** §4のテスト項目を実施し、HTTPステータス・JSON・DB前後差・スクリーンショット/ログを記録。既存 `/`・`/api/db-check`・`/db-sample` の回帰確認。障害の再現は他環境に影響しない方法で行う。
- **確認コマンド:**

```bash
npm run build
git diff --check
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/db-check
curl -i http://localhost:3000/api/v1/todos
```

- **期待結果:** REQ-01〜04の受け入れ条件に合格、型/値エラーの400/422、未発見404、204本文なし、既存ルートの維持を確認。**実測結果**を `04_test_results.md` に記録する。いずれのコマンドも未実行なら「未実施」と記入する。
- **失敗時に最初に見る場所:** 最初に失敗したAPIのNetwork情報、Controllerのログ、ModelのSQL、対象DB、設計書との相違。

### 工程11　Vercel Previewで動作確認

- **対象:** 変更済みソース、VercelのPreviewデプロイ、Neon DB、`04_test_results.md`。
- **作業:** ブランチをリモートへpushし、実際に作られたPreview URLで確認。Vercelの既存設定と `DATABASE_URL` のPreview設定を照合。**Productionと同じDB**を参照するので、`[TEST]` を付けた架空データだけで操作。SQLは再実行しない。
- **確認コマンド:**

```bash
npm run build
git status --short
git push -u origin HEAD
# 実際のPreview URLが発行されたら置き換える
curl -i 'https://<PREVIEW_URL>/api/db-check'
curl -i 'https://<PREVIEW_URL>/api/v1/todos'
curl -i 'https://<PREVIEW_URL>/todo'
```

- **期待結果:** Previewで既存画面とTODO画面/API4操作が動作し、EJS・`public/todo/todo.js` が配信される。`/todo` の301先も確認。Production側と同じNeon DBを利用することを**設定と観測**で確認する。
- **失敗時に最初に見る場所:** Vercelのビルドログ/Functionsログ、ルート設定、`tsconfig.json` の出力先とEJS同梱、環境変数がPreviewに設定されているか、Neon接続。HTMLの504等はAPIのJSON 503と区別して記録する。**Deployment Protection** により `curl` で401/認証画面が返る場合があるため、認証済みブラウザで確認し、必要に応じてVercelのDeployment Protection設定・アクセス権を確認する（保護の無効化は必須にしない）。

### 工程12　Pull Request作成・レビュー

- **対象:** PR差分（SQL/Router/Controller/Model/EJS/JS/設計・手順・テスト文書）。
- **作業:** 実装をコミットし、GitHub上でPRを作成（レビュー運用がある場合）。差分の目的をファイル単位で説明し、設計との照合、シークレット混入、既存機能への影響、Previewでの結果をレビューする。PRの取り込みはレビュー後に行う。
- **確認コマンド:**

```bash
git status --short
git diff --check
git log -5 --oneline
git diff --stat <BASE_BRANCH>...HEAD
# <BASE_BRANCH> は実際の統合先ブランチ名に置き換える
# PR作成はGitHubの画面から行う（GitHub CLI導入済みなら gh pr create も可）
```

- **期待結果:** PRが作成され、変更理由・確認手順・Preview結果・影響範囲を説明できる。レビュー指摘が解消され、取り込みが承認される。**PR作成やマージを実施済みとは記載しない**。
- **失敗時に最初に見る場所:** GitHubの比較先ブランチ、未コミット差分、権限、CI/ビルドログ、SQLや環境変数の誤コミット。

### 工程13　Productionで確認

- **対象:** Vercel Productionの実際のデプロイURL、Neon DB、`docs/todo/04_test_results.md`。
- **作業:** PRマージ後など、プロジェクトの正規のProductionデプロイ手順で公開する。実際の公開URLとデプロイ結果を確認。既存機能とTODOを再確認し、作成・変更・削除は**自分の `[TEST]` データのみ**で最小限実施。SQLの自動実行・全件削除はしない。
- **確認コマンド:**

```bash
curl -i 'https://<PRODUCTION_URL>/'
curl -i 'https://<PRODUCTION_URL>/api/db-check'
curl -i 'https://<PRODUCTION_URL>/api/v1/todos'
curl -i 'https://<PRODUCTION_URL>/todo'
```

- **期待結果:** Productionで既存ルート・画面・TODO API4操作が利用でき、Previewと同じDBを参照している。確認に使った自分の架空データは必要に応じて個別削除する。結果を日付・環境・URL・ステータスとともに記録。
- **失敗時に最初に見る場所:** VercelのProductionデプロイ/Functionsログ、Production環境変数、Neonの接続先、EJS・静的ファイルの配置、Previewとの差分。

## 3. 実装中のエラー判定・確認ポイント

| 事象 | 期待HTTP / code | 最初に確認する箇所 |
|---|---|---|
| JSON構文不正 | 400 / `INVALID_JSON` | Routerの `express.json()` と専用エラーハンドラ |
| 10KB超 | 400 / `REQUEST_TOO_LARGE` | JSON body limit とエラーの `type` |
| 必須欠落・型不一致・本文不正 | 400 / `INVALID_BODY` | Controllerの構造・型チェック |
| ID形式不正・0・負数・2147483648 | 400 / `INVALID_PARAMETER` | `parseId` とURLパラメータ |
| 文字列titleのtrim後0文字・101文字以上・NUL | 422 / `VALIDATION_ERROR` | Controllerの業務ルール検証 |
| PATCH/DELETEの存在しないID | 404 / `NOT_FOUND` | Modelの0件判定 |
| 未対応PUTなど | 404 / `NOT_FOUND` | Router末尾の未定義APIハンドラ |
| SQL構文エラー、`ENOTFOUND`、`08P01`、その他未列挙の例外 | 500 / `INTERNAL_SERVER_ERROR` | Controllerログ、SQLとエラーコード |
| Node `ECONNREFUSED` / `ECONNRESET` / `ETIMEDOUT` / `EAI_AGAIN`、PG `08000` / `08001` / `08003` / `08004` / `08006` / `57P01`〜`57P03` / `53300` | 503 / `SERVICE_UNAVAILABLE` | サーバーログの実際のエラーコード（文字列の推測ではなくコード照合） |
| Vercelが返すHTML 504など | アプリJSONではない | Vercel FunctionsログとTodoApiの非JSONエラー処理 |

**注意:** `db.ts` に `connectionTimeoutMillis` がないため、Pool設定によるタイムアウトを503の独立した条件として想定しない。サービス障害を無理に発生させず、可能な環境で安全に再現・観測する。

## 4. REQ別の完了条件（1文ずつ）と確認データ

- **REQ-01 TODO一覧表示:** 0件の `GET /api/v1/todos` がHTTP 200・`data: []` を返して画面に「タスクはありません」と表示され、複数件は指定順に表示されてGET前後でDBが変化しなければ完了。
- **REQ-02 TODO登録:** 前後の空白除去後1〜100文字の有効な `title` が201で保存・再取得でき、0/101文字・空白のみは422で保存されず、必須欠落や型不一致は400なら完了。
- **REQ-03 完了状態の部分更新:** 既存IDの `completed` を `true` / `false` にPATCHすると200で状態だけが変わり、タイトル等は不変で、不正入力400・対象なし404を確認できれば完了。
- **REQ-04 TODO削除:** 対象IDのDELETEが204・本文なしで成功し、再GETで消失、同IDの再DELETEが404で最終DB状態が変わらなければ完了。

**境界値の追加確認:** `title` の0/1/100/101コードポイント、半角/全角空白、絵文字100/101、NUL、null/数値、破損JSON、本文10KB超。IDの `0`、`-1`、`1.5`、`1e2`、`01`、`abc`、`1abc`、`2147483648`、存在しない正の整数。`completed` の `true`、`false`、`"true"`、`1`、null、未指定、および余分な `title` キー。各結果は実測するまで「未実施」と記録する。

## 5. AI生成コードの説明・レビュー

AIがコードやSQLを生成した場合も、各変更の目的を学生本人が次の観点で説明できることを確認する。

1. `index.ts` の2行をどこに加え、既存ルートをなぜ変更しないか。
2. Router → Controller → Model → `pool` → Neon の役割と、400/422/404/500/503をどこで返すか。
3. `SERIAL` と `$1` / `$2` を使う理由、DBの `is_completed` をAPIの `completed` に変換する理由。
4. 204で本文を返さず、`TodoApi` がJSON解析しない理由。
5. `textContent`、入力制限、架空データ限定、Preview/Production共有DBがなぜ必要か。
6. ローカル・Preview・Productionの結果の違いを、ログと実際の操作結果から説明できるか。

**完了判定:** すべての工程で「対象ファイル／実施した作業／確認コマンド／実測結果／不具合・対処」を `04_test_results.md` に残し、未確認項目（`tsconfig.json`・Vercel設定・Neon接続先等）を確認してからProductionの完了を宣言する。
