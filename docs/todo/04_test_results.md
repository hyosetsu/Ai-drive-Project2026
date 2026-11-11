
# TODOアプリ V1 テスト結果記録

## 工程10：ローカル統合・回帰・異常系テスト

### 1. 実施情報

| 項目 | 内容 |
|---|---|
| 実施日 | 2026年11月11日 |
| 実施環境 | ローカル（Windows / PowerShell） |
| アプリケーション | Express / TypeScript / EJS / JavaScript |
| データベース | Neon PostgreSQL |
| ベースURL | `http://localhost:3000` |
| 対象ブランチ | feature/todo-app |
| 対象コミット | 未記録 |
| 総合判定 | PASS（実施したテスト項目） |

### 2. 対象ファイル

- `src/apps/todo/todoModel.ts`
- `src/apps/todo/todoController.ts`
- `src/apps/todo/todoRouter.ts`
- `views/todo/index.ejs`
- `public/todo/todo.js`
- `public/todo/todo.css`
- `docs/todo/04_test_results.md`

既存機能の回帰確認対象：

- `index.ts`
- `db.ts`
- `/`
- `/api/db-check`
- `/db-sample`

工程10では、原則として既存機能の実装を変更せず、動作確認とテスト結果の記録を行った。

### 3. ビルド・構文確認

| 項目 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|
| `npm run build` | TypeScriptのビルド成功 | 正常終了（詳細ログ未記録） | PASS |
| `node --check public/todo/todo.js` | 構文エラーなし | 正常終了（詳細ログ未記録） | PASS |
| `git diff --check` | 差分チェックでエラーなし | 正常終了（詳細ログ未記録） | PASS |

※ 上記は実施者からの正常動作報告に基づく。コマンドの詳細な出力は保存されていない。

### 4. REQ別テスト結果

#### 4.1 REQ-01：TODO一覧表示

対象API：`GET /api/v1/todos`

| ID | テスト内容 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| T01 | TODO一覧取得 | HTTP 200、dataが配列 | 正常動作を確認（詳細ログ未記録） | PASS |
| T02 | 0件時の一覧 | HTTP 200、data: [] | 正常動作を確認（詳細ログ未記録） | PASS |
| T03 | 複数件の並び順 | created_at DESC、id DESC | 正常動作を確認（詳細ログ未記録） | PASS |
| T04 | GET前後のDB状態 | DBの内容が変化しない | 正常動作を確認（詳細ログ未記録） | PASS |

判定：**REQ-01 PASS**

#### 4.2 REQ-02：TODO登録

対象API：`POST /api/v1/todos`

| ID | テスト内容 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| T05 | 正常なTODO登録 | HTTP 201、保存成功 | 正常動作を確認 | PASS |
| T06 | 前後の空白除去 | trim後のタイトルを保存 | 正常動作を確認 | PASS |
| T07 | 1文字 | HTTP 201 | 正常動作を確認（詳細ログ未記録） | PASS |
| T08 | 100文字 | HTTP 201 | 正常動作を確認（詳細ログ未記録） | PASS |
| T09 | 空文字・空白のみ | HTTP 422 | 正常動作を確認（詳細ログ未記録） | PASS |
| T10 | 101文字・NUL文字 | HTTP 422 | 正常動作を確認（詳細ログ未記録） | PASS |
| T11 | title欠落・型不正 | HTTP 400 | 正常動作を確認（詳細ログ未記録） | PASS |

テストデータ：

- ID：14
- タイトル：`[TEST] 工程10統合確認`
- 初期完了状態：`false`
- 作成日時：`2026-11-11T04:30:21.078Z`

判定：**REQ-02 PASS**

#### 4.3 REQ-03：完了状態の部分更新

対象API：`PATCH /api/v1/todos/:id`

| ID | テスト内容 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| T12 | completedをtrueに更新 | HTTP 200、true | trueを確認 | PASS |
| T13 | completedをfalseに更新 | HTTP 200、false | falseを確認 | PASS |
| T14 | タイトル・作成日時の不変確認 | 更新前後で一致 | 比較結果が両方True | PASS |
| T15 | completedが文字列 | 400 / INVALID_BODY | 400 / INVALID_BODY | PASS |
| T16 | completedが数値 | 400 / INVALID_BODY | 400 / INVALID_BODY | PASS |
| T17 | completedがnull | 400 / INVALID_BODY | 400 / INVALID_BODY | PASS |
| T18 | completed欠落 | 400 / INVALID_BODY | 400 / INVALID_BODY | PASS |
| T19 | 存在しないID | 404 / NOT_FOUND | 404 / NOT_FOUND | PASS |
| T20 | 余分なtitleキーを含むPATCH | タイトル不変 | タイトル不変、completed更新成功 | PASS |

確認した内容：

- 対象ID：14
- `completed: false` → `true`：成功
- `completed: true` → `false`：成功
- `title` の変更なし：確認済み
- `created_at` の変更なし：確認済み
- 型不正・必須欠落：すべてHTTP 400
- 存在しないID：HTTP 404

判定：**REQ-03 PASS**

#### 4.4 REQ-04：TODO削除

対象API：`DELETE /api/v1/todos/:id`

| ID | テスト内容 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| T21 | 正常削除 | HTTP 204 | HTTP 204 | PASS |
| T22 | DELETEレスポンス本文 | 0文字 | 0文字 | PASS |
| T23 | 削除後の一覧取得 | 対象IDが存在しない | 対象0件 | PASS |
| T24 | 同じIDの再削除 | 404 / NOT_FOUND | 404 / NOT_FOUND | PASS |
| T25 | 不正ID | 400 / INVALID_PARAMETER | 8件すべて一致 | PASS |

不正IDの確認結果：

| 入力ID | HTTP | エラーコード | 判定 |
|---|---|---|---|
| `0` | 400 | INVALID_PARAMETER | PASS |
| `-1` | 400 | INVALID_PARAMETER | PASS |
| `1.5` | 400 | INVALID_PARAMETER | PASS |
| `1e2` | 400 | INVALID_PARAMETER | PASS |
| `01` | 400 | INVALID_PARAMETER | PASS |
| `abc` | 400 | INVALID_PARAMETER | PASS |
| `1abc` | 400 | INVALID_PARAMETER | PASS |
| `2147483648` | 400 | INVALID_PARAMETER | PASS |

削除対象ID：14

削除後の一覧取得結果：対象0件

判定：**REQ-04 PASS**

### 5. その他の異常系テスト

| ID | テスト内容 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| T26 | JSON構文不正 | 400 / INVALID_JSON | 400 / INVALID_JSON | PASS |
| T27 | JSON本文10KB超 | 400 / REQUEST_TOO_LARGE | 400 / REQUEST_TOO_LARGE | PASS |
| T28 | 未対応PUT | 404 / NOT_FOUND | 404 / NOT_FOUND | PASS |

エラーレスポンスは、共通JSON形式で返されることを確認した。

例：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_JSON",
    "message": "JSONの形式が正しくありません"
  }
}
```

### 6. ブラウザ統合テスト

対象URL：`http://localhost:3000/todo/`

| ID | テスト内容 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| B01 | TODO画面表示 | 正常表示 | 正常動作を確認 | PASS |
| B02 | 登録フォーム | TODO登録成功 | 正常動作を確認 | PASS |
| B03 | 完了チェック | PATCHで状態更新 | 正常動作を確認 | PASS |
| B04 | 完了解除 | PATCHで状態更新 | 正常動作を確認 | PASS |
| B05 | 削除ボタン | DELETEで削除 | 正常動作を確認 | PASS |
| B06 | XSS対策 | HTMLが実行されない | 正常動作を確認 | PASS |
| B07 | 二重送信防止 | 登録中はボタン無効 | 正常動作を確認 | PASS |
| B08 | 更新失敗時の復元 | チェック状態を復元 | 正常動作を確認 | PASS |
| B09 | 削除404時の再取得 | 一覧を再取得 | 正常動作を確認 | PASS |
| B10 | 0件表示 | タスクはありません | 正常動作を確認 | PASS |
| B11 | 取得失敗・再試行 | エラー表示後に再取得 | 正常動作を確認 | PASS |

※ ブラウザ操作の成功は実施者からの報告に基づく。Networkの詳細ログやスクリーンショットは本記録に添付していない。

### 7. 既存機能の回帰テスト

| ID | URL | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| R01 | `/` | HTTP 200 | HTTP 200 | PASS |
| R02 | `/api/db-check` | HTTP 200 | HTTP 200 | PASS |
| R03 | `/db-sample` | HTTP 200 | HTTP 200 | PASS |
| R04 | `/todo/` | HTTP 200 | HTTP 200 | PASS |
| R05 | `/todo/todo.js` | HTTP 200 | HTTP 200 | PASS |
| R06 | `/todo/todo.css` | HTTP 200 | HTTP 200 | PASS |

DB接続確認：

```json
{
  "status": "ok",
  "database": "connected"
}
```

既存ルートのHTTP応答に異常は確認されなかった。

※ `/db-sample` の登録・削除操作については、今回の記録では実測詳細なし。

### 8. データベース確認

対象テーブル：`public.todo_tasks`

テストに使用したレコード：

| 項目 | 値 |
|---|---|
| ID | 14 |
| タイトル | `[TEST] 工程10統合確認` |
| 初期完了状態 | false |
| 作成日時 | 2026-11-11T04:30:21.078Z |

確認結果：

1. 登録後、TODO一覧から対象レコードを取得できた。
2. PATCHにより完了状態をtrue・falseに変更できた。
3. PATCH後もタイトル・作成日時は変化しなかった。
4. DELETE後、一覧取得で対象レコードが0件になった。
5. 他レコードへの影響は、実施者のDB確認で問題なしと報告された。

確認用SQL：

```sql
SELECT
    id,
    title,
    is_completed,
    created_at
FROM public.todo_tasks
WHERE id = 14;
```

期待結果：DELETE後は0行。

※ SQL Editorの実行ログは本記録に添付していない。

### 9. 障害テストの未実施項目

| 項目 | 状態 | 理由 |
|---|---|---|
| 500 INTERNAL_SERVER_ERROR | 未実施 | 意図的なSQL障害等を発生させていない |
| 503 SERVICE_UNAVAILABLE | 未実施 | 共有DBの停止・接続設定変更を避けた |
| 非JSONエラー応答 | 未実施 | 安全な再現環境を用意していない |
| 通信断 | 未実施 | 通信障害を意図的に再現していない |

これらは共有環境や既存機能への影響を避けるため、無理に再現していない。

未実施項目はPASSとして扱わず、今後、安全なテスト環境を用意した場合に確認する。

### 10. 不具合・対処

- 今回実施したテストでは、不具合を確認していない。
- 実装ファイルの追加修正は不要と判断した。
- 障害テストの未実施項目は第9節に記録した。

### 11. 証跡

| 証跡 | 状態 |
|---|---|
| PowerShellのPATCH結果 | 実行ログで確認済み |
| PowerShellのDELETE結果 | 実行ログで確認済み |
| PowerShellの異常系結果 | 実行ログで確認済み |
| PowerShellの回帰テスト結果 | 実行ログで確認済み |
| ブラウザNetwork | 詳細ログ未添付 |
| ブラウザ画面 | スクリーンショット未添付 |
| Neon SQL | 実行ログ未添付 |

### 12. 工程10の最終判定

| 区分 | 判定 |
|---|---|
| REQ-01 TODO一覧表示 | PASS |
| REQ-02 TODO登録 | PASS |
| REQ-03 完了状態更新 | PASS |
| REQ-04 TODO削除 | PASS |
| 入力値・異常系テスト | PASS（実施項目） |
| ブラウザ統合テスト | PASS |
| 既存機能の回帰テスト | PASS |
| ビルド・構文確認 | PASS |
| DB前後差確認 | PASS |
| 障害テスト（500/503等） | 未実施 |

**総合判定：PASS（工程10完了）**

REQ-01〜REQ-04の主要な受け入れ条件と、ローカル環境で実施した統合・回帰・異常系テストが正常に動作した。

一部の障害テストは未実施だが、その理由を記録し、未実施項目をPASSに含めないこととした。

### 13. 次工程

**工程11：Vercel Previewで動作確認**

確認予定：

- Previewデプロイの成功
- TODO画面・CSS・JavaScriptの配信
- TODO APIのGET・POST・PATCH・DELETE
- Neon PostgreSQLへの接続
- 既存機能の回帰確認
- PreviewとProductionのDB接続先確認

テストデータには `[TEST]` を付けた架空データのみを使用し、既存データを変更しない。
