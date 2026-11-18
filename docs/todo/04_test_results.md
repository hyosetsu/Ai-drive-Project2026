
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

---

## 工程11：Vercel Previewでの動作確認

> **記録状況：主要な動作確認完了（実施者報告）**  
> 工程11の画面・API・回帰テストは正常動作が報告された。未提示の詳細情報は推測して記入せず「未記録」「未確認」とした。

### 1. 実施情報

| 項目 | 内容 |
|---|---|
| 実施日 | 2026年11月18日（結果報告日） |
| 実施者 | 実施者本人 |
| 実施環境 | Vercel Preview（実施者報告） |
| Gitリポジトリ | `hyosetsu/Ai-drive-Project2026` |
| 対象ブランチ | `feature/todo-app` |
| ローカルで確認したコミット | `29ccd7f`（`origin/feature/todo-app` と一致） |
| Vercelで実際にデプロイされたコミット | `29ccd7f32052600b4d974651754f734433b7d8b7`（指定PreviewデプロイのVercel情報から確認） |
| Vercelプロジェクト | `ai-drive-project2026` |
| Preview URL | `https://ai-drive-project2026-4jmx14tdv-hyosetsus-projects.vercel.app` |
| デプロイステータス | `READY`（Vercelのデプロイ情報を確認） |
| Neon接続先 | 接続成功を確認。Preview / Production間の接続先照合は未確認（接続文字列は記録しない） |

### 2. デプロイ前の確認

| ID | 確認項目 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| P01 | `npm run build` | ビルド成功 | `tsc` がエラーなく終了 | PASS |
| P02 | `git diff --check` | エラーなし | 出力なし、エラーなし | PASS |
| P03 | Gitのブランチ・コミット | Preview対象が明確で、Productionブランチへの直接pushではない | `feature/todo-app`、`29ccd7f`、`origin/feature/todo-app` と一致。`git status --short` は出力なし | PASS |
| P04 | VercelのGit連携・Root Directory | 正しいリポジトリ・ディレクトリを参照 | 設定の直接確認記録なし | 未確認 |
| P05 | Previewの環境変数 | `DATABASE_URL` 等の必要な変数名が設定済み | Vercelで `feature/todo-app` 向けPreviewの `DATABASE_URL` と `DATABASE_URL_POOLED` の登録を確認。値は取得・記録しない | PASS（変数名・適用対象） |
| P06 | PreviewとProductionのDB接続先 | PreviewとProductionが同一Neon DBを参照し、共有データへの影響を確認する | PreviewとProductionに `DATABASE_URL` / `DATABASE_URL_POOLED` の設定がそれぞれ存在し、Neonに `production` ブランチが存在することを確認。両環境の接続先が同一かは検証できていない | 未確認（同一性） |
| P07 | Previewデプロイ | 対象コミットのデプロイが `Ready` | 指定Previewデプロイが `READY`、Gitブランチ `feature/todo-app`、デプロイ済みコミット `29ccd7f` をVercel情報で照合。これは当時のPreviewデプロイであり、PR #5最新コミットとは異なる | PASS（指定デプロイ） |

### 3. Preview画面・API・静的ファイル確認

| ID | パス | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| P08 | `/` | HTTP 200・TOPページ表示 | 正常動作（実施者報告） | PASS |
| P09 | `/api/db-check` | HTTP 200・DB接続成功 | 正常動作・DB接続成功（実施者報告） | PASS |
| P10 | `/api/v1/todos` の一覧取得操作 | TODO一覧を取得できる | 一覧取得成功（実施者報告） | PASS |
| P10-H | `/api/v1/todos` のHTTP仕様 | HTTP 200・成功JSONの `data` が配列 | ブラウザNetworkでGET 200 OK、`content-type: application/json; charset=utf-8`、本文が `success: true`・`data` 配列（9件）と確認 | PASS |
| P11 | `/todo` | 想定どおりのリダイレクトまたは画面表示 | このパス単独の結果は未報告 | 未確認 |
| P12 | `/todo/` | HTTP 200・TODO画面表示 | HTTP 200・画面正常表示（実施者報告） | PASS |
| P13 | `/todo/todo.js` | HTTP 200・JavaScript配信 | HTTP 200（実施者報告） | PASS |
| P14 | `/todo/todo.css` | HTTP 200・CSS配信 | HTTP 200（実施者報告） | PASS |
| P15 | `/db-sample` | HTTP 200・既存商品一覧表示 | 正常動作（実施者報告） | PASS |

### 4. PreviewでのTODO CRUDテスト

テストデータは `[TEST]` を付けた架空データに限定し、既存レコードの更新・削除を避ける。実測詳細が報告されていない項目については、成功した操作と区別して記録する。

| ID | 操作・確認内容 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| P16 | GET `/api/v1/todos` の一覧取得操作 | TODO一覧を取得できる | 一覧取得成功（実施者報告） | PASS |
| P16-H | GETのHTTP仕様 | HTTP 200・成功JSONの `data` が配列 | ブラウザNetworkでGET 200 OK、レスポンス本文の `success: true` と `data` 配列（9件）を確認 | PASS |
| P17 | POST `/api/v1/todos` の登録操作 | テストデータを登録できる | 登録操作成功（実施者報告） | PASS |
| P17-H | POSTのHTTP仕様 | HTTP 201・成功JSONの形式が設計どおり | 2026-11-18 05:22:10 UTC、POST `/api/v1/todos` が `201 Created`、`Content-Type: application/json; charset=utf-8`、`Content-Length: 111`。ResponseのJSON本文詳細は未提示 | 一部確認（201・JSONヘッダーはPASS） |
| P18 | PATCH `/api/v1/todos/:id` の更新操作 | `completed` を変更できる | 更新操作成功（実施者報告） | PASS |
| P18-H | PATCHのHTTP仕様 | HTTP 200・更新後データを返す | 2026-11-18 05:22:56 UTC、PATCH `/api/v1/todos/20` が `200 OK`、`Content-Type: application/json; charset=utf-8`、`Content-Length: 111`。Responseの更新後JSON詳細は未提示 | 一部確認（200・JSONヘッダーはPASS） |
| P19 | PATCH後の他列確認 | `title`・`created_at` が変化しない | Previewでの他列比較結果は未報告 | 未確認 |
| P20 | DELETE `/api/v1/todos/:id` の削除操作 | 自分のテストデータを削除できる | 削除操作成功（実施者報告） | PASS |
| P20-H | DELETEのHTTP仕様 | HTTP 204・レスポンス本文なし（0文字） | DELETE `/api/v1/todos/20` が05:23:02 UTCに204、別のテストID `/api/v1/todos/21` が05:25:38 UTCに `204 No Content`。いずれも `Content-Type`・`Content-Length` なし。204はHTTP仕様上本文を持たない。NetworkのResponse欄で0文字を直接計測した記録はなし | PASS（204・本文なしのHTTP仕様と整合） |
| P21 | DELETE後のGET | 対象IDが取得結果に存在しない | Previewでの削除後の一覧比較結果は未報告 | 未確認 |

- 使用したテストタイトル：未記録
- 登録されたテストID：未記録
- テスト開始前の対象状態：未記録
- テスト終了後の対象状態：未記録
- 他レコードへの影響：未確認
- HTTPステータス・レスポンス詳細：GETは200・成功JSON・`data` 配列（9件）を確認し、P10-H・P16-HをPASS。POST 201とPATCH 200のステータス・JSONヘッダーは確認済みだがResponse本文は未提示のため、P17-H・P18-Hは「一部確認」。DELETEはID 20・21で204と本文なしのHTTP仕様に整合するヘッダーを確認したためP20-HはPASS（Response欄での独立したバイト数計測は未記録）。

### 4.1 GET APIの追加証跡（2026年11月18日）

実施者がブラウザのNetwork情報とレスポンス本文を提示したため、P10-H・P16-Hの「未確認」をPASSに更新した。

| 確認項目 | 実測結果 |
|---|---|
| Request URL | `https://ai-drive-project2026-4jmx14tdv-hyosetsus-projects.vercel.app/api/v1/todos` |
| Request Method | GET |
| Status Code | 200 OK |
| Response Content-Type | `application/json; charset=utf-8` |
| Cache-Control | `no-store` |
| Response JSON | `success: true`、`data` は9件の配列 |
| 各TODOの項目 | `id`、`title`、`completed`、`created_at` を確認 |
| 判定 | **PASS**（GETのHTTP仕様とJSON形式） |

※ レスポンスには既存のテストレコードなどが含まれるが、ここでは全件を転記しない。提示されたRequest URLはGETの証跡であり、PRの最新コミットに対応するデプロイかどうかは別途照合が必要。

※ リクエストヘッダーに含まれた認証Cookie・セッショントークンなどの値は、機密情報として本書には保存しない。

### 4.2 POST・PATCH・DELETEの追加HTTP証跡（2026年11月18日）

実施者がChromeのNetworkからリクエスト・応答ヘッダーを提示した。以下は**提示された実測情報のみ**を要約し、認証Cookie・セッション値は転記しない。時刻はレスポンスのDateヘッダー（UTC）。

| 操作 | 対象パス | 時刻（UTC） | 確認したHTTP応答 | 本文仕様の確認 |
|---|---|---|---|---|
| POST | `/api/v1/todos` | 05:22:10 | `201 Created`、JSON Content-Type、Content-Length 111 | Response JSONのフィールドと内容は未提示 |
| PATCH | `/api/v1/todos/20` | 05:22:56 | `200 OK`、JSON Content-Type、Content-Length 111 | 更新後の `completed` 等のResponse JSONは未提示 |
| DELETE | `/api/v1/todos/20` | 05:23:02 | `204 No Content`、Content-Type/Lengthなし | 204はHTTP仕様上本文なし。Responseタブでの0文字独立計測は未記録 |
| DELETE | `/api/v1/todos/21` | 05:25:38 | `204 No Content`、Content-Type/Lengthなし | 別IDでも同様の仕様を確認。Responseタブでの0文字独立計測は未記録 |

補足：PATCH付近で取得されたGET 200のログは、PATCH自体の200の証拠として扱わない。POST・PATCHについては、ヘッダーの `application/json` は確認済みだが、**JSON本文の具体的なフィールドや値は未検証**。また、テスト対象ID 20・21以外のレコードの状態はこのログだけでは判定しない。

### 4.3 Vercel・Neon設定確認（2026年11月18日）

- 指定Previewデプロイ `4WxqhdQiEtVcqoB5ep9QBYaXEP2m` は `READY`、対象ブランチは `feature/todo-app`、デプロイコミットは `29ccd7f` と確認した。
- VercelにPreviewブランチ用とProduction用それぞれの `DATABASE_URL` / `DATABASE_URL_POOLED` が登録されていることを確認した（**値は参照・記録しない**）。
- Neonプロジェクト `hidden-lab-27804034` に `production` ブランチ（ID `br-plain-hat-b3rc3a1c`）が存在することを確認した。
- **双方が同じDBを参照しているかは未確認**。変数名の存在とNeonブランチの存在だけでは同一性は証明できないため、P06は未確認とする。

### 5. Previewブラウザ統合・回帰確認

| ID | 確認項目 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| P22 | TODO画面とCSSの表示 | レイアウトが正常 | 正常動作（実施者報告） | PASS |
| P23 | ブラウザから登録 | POST成功・一覧更新 | 登録操作成功（実施者報告。Networkログなし） | PASS |
| P24 | ブラウザから完了切替 | PATCH成功・状態反映 | 更新操作成功（実施者報告。Networkログなし） | PASS |
| P25 | ブラウザから削除 | DELETE成功・一覧更新 | 削除操作成功（実施者報告。Networkログなし） | PASS |
| P26 | ブラウザConsole / Network | 想定外のエラーなし | Console / Networkの詳細結果は未報告 | 未確認 |
| P27 | 既存TOP・DBチェック・商品一覧 | 工程10時点と同様に動作 | いずれも正常動作（実施者報告） | PASS |

### 6. DB接続・データ保護の確認

- PreviewのDB接続：**PASS**（`/api/db-check` の正常動作を実施者が確認）
- Preview / ProductionのDB共有状況：**未確認**（設定値を公開せず、Vercel / Neonの設定画面で照合する）
- DB設定値や認証情報を本文に記録していないこと：**確認済み**（本書に接続文字列等は記載しない）
- テスト用レコードの削除：**操作成功の報告あり**（対象ID・DBでの残存確認は未記録）
- 他ユーザー・既存レコードを変更していないこと：**未確認**
- SQLでの確認結果：**未記録**

### 7. 不具合・対処

| 項目 | 記録 |
|---|---|
| 発生した不具合 | 今回報告された動作確認項目では不具合なし |
| 発生条件・HTTPステータス | 該当なし（詳細ログ未添付） |
| 原因 | 該当なし |
| 対処内容 | 追加の修正報告なし |
| 再テスト結果 | 該当なし |

### 8. 証跡

| 種類 | 記録 |
|---|---|
| ローカルのGit状態・ビルド結果 | PowerShell出力をチャット上で確認済み |
| Vercelデプロイの状態・コミット | 指定デプロイについてVercelのREADY・`29ccd7f`を確認。PRの最新コミットとは別 |
| Vercel Build Logs（機密情報を除く） | 未添付 |
| PreviewのHTTP・CRUD実行ログ | GET 200・成功JSON・data配列、POST 201、PATCH 200、DELETE 204（ID20・21）のNetwork情報を実施者がチャットで提示。POST/PATCHのResponse本文は未提示 |
| ブラウザNetwork / Console | GET/POST/PATCH/DELETEの関連Network情報を提示済み。Console全体の詳細確認は未記録 |
| TODO画面のスクリーンショット | 未添付 |
| NeonのDB確認結果（機密情報を除く） | 未添付 |

### 9. 工程11の最終判定

| 区分 | 判定 |
|---|---|
| Git・ローカルビルド | **PASS** |
| PreviewのTODO画面・静的ファイル | **PASS**（実施者報告） |
| PreviewのTODO API（GET / POST / PATCH / DELETE）の操作 | **PASS**（実施者報告） |
| GETのHTTPステータス・レスポンス仕様 | **PASS**（GET 200、成功JSON、`data` 配列を確認） |
| POST / PATCHのHTTPステータス | **PASS**（POST 201・PATCH 200） |
| POST / PATCHのJSON本文詳細 | 一部確認（JSONヘッダーのみ確認。本文フィールド未提示） |
| DELETEのHTTPステータス・本文なしの仕様 | **PASS**（ID20・21で204。Response欄の独立した0文字計測は未記録） |
| Neon PostgreSQL接続 | **PASS**（実施者報告） |
| 既存機能の回帰テスト | **PASS**（実施者報告） |
| 指定PreviewデプロイのReady・コミット照合 | **PASS**（READY、`29ccd7f`。PR最新コミットとの一致は対象外） |
| Preview / ProductionのDB接続先照合 | 未確認 |
| テストデータの後片付け・DB残存確認 | 一部確認（削除操作は成功報告あり） |
| 総合判定 | **PASS（報告された主要動作確認。未確認項目は上記のとおり）** |

**工程11の主要動作確認は完了。** GETは200と成功JSON・`data` 配列、POSTは201、PATCHは200、DELETEは204を実施者提示のNetwork記録から確認した。指定PreviewデプロイのREADYとコミット`29ccd7f`も照合済み。一方、POST/PATCHのResponse JSON詳細、Preview/ProductionのDB接続先の同一性、DBでの後片付けは確認が残っている。未確認事項はPASS扱いしない。

### 10. 次工程

工程12の内容は `docs/todo/03_implementation_plan.md` を確認してから着手する。Productionへの公開や既存DBへの変更は、本記録のPASS判定だけを根拠に実行しない。

## 工程13：Vercel Productionでの動作確認

### 1. 実施情報

| 項目 | 内容 |
|---|---|
| 実施日 | 2026年11月18日 |
| 実施環境 | Vercel Production |
| 対象ブランチ | `main` |
| PR | #5（マージ済み） |
| マージコミット | `330ae7fbbf5035e3b3d5cc52cac9a8db95361a40` |
| Vercelデプロイ | `READY` |
| Production URL | `https://ai-drive-project2026-8jgofblzy-hyosetsus-projects.vercel.app` |
| DB | Neon PostgreSQL |
| テストデータID | 未記録 |

### 2. Productionデプロイ確認（工程13-A）

| 確認項目 | 実測結果 | 判定 |
|---|---|---|
| PR #5のマージ | GitHubでマージ済みを確認 | PASS |
| Productionデプロイ | VercelでREADYを確認 | PASS |
| デプロイ対象ブランチ | `main` | PASS |
| デプロイコミット | `330ae7f`（PR #5のマージコミットと一致） | PASS |

### 3. 読み取り・既存機能確認（工程13-B）

| ID | 確認項目 | 実測結果 | 判定 |
|---|---|---|---|
| B01 | TOP画面 `/` | 正常表示（実施者報告） | PASS |
| B02 | `/api/db-check` | DB接続成功（実施者報告） | PASS |
| B03 | `/db-sample` | 商品一覧正常表示（実施者報告） | PASS |
| B04 | TODO画面 `/todo/` | 正常表示（実施者報告） | PASS |
| B05 | GET `/api/v1/todos` | TODO一覧取得成功（実施者報告） | PASS |

※ Productionでの個別HTTPステータス・レスポンス本文の詳細ログは未記録。

### 4. Preview・Production DB照合（工程13-C）

| 確認項目 | 確認結果 | 判定 |
|---|---|---|
| PreviewとProductionのDB接続先 | Vercel・Neonの設定照合で一致（実施者報告） | PASS |
| 両環境のTODO一覧 | 同じデータを確認（実施者報告） | PASS |
| DB接続 | 両環境で正常（実施者報告） | PASS |

判定：**PASS（実施者の設定照合・データ比較に基づく）**

※ 接続文字列・認証情報の値は記録しない。

工程11時点ではPreviewとProductionのDB接続先の同一性は未確認であったが、工程13-Cで実施者が設定とデータを照合し、一致を確認した。工程11の当時の判定は変更せず、工程13で追加確認した結果として記録する。

### 5. Production CRUD確認（工程13-D）

既存レコードへの影響を避け、実施者が新規登録したテストデータを対象に確認した。

| ID | テスト内容 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| D01 | POST：TODO登録 | テストデータを登録できる | 登録成功（実施者報告） | PASS |
| D02 | GET：一覧取得 | 登録したTODOが取得できる | 一覧取得成功（実施者報告） | PASS |
| D03 | PATCH：完了状態更新 | completedをtrueに変更できる | 更新成功（実施者報告） | PASS |
| D04 | PATCH：完了解除 | completedをfalseに変更できる | 更新成功（実施者報告） | PASS |
| D05 | DELETE：TODO削除 | 登録したテストデータを削除できる | 削除成功（実施者報告） | PASS |

補足：

- テストデータID：未記録
- テストデータのタイトル：未記録
- POST・PATCH・DELETEのProduction HTTPステータス：個別ログ未提示のため未確認
- ProductionのレスポンスJSON詳細：未確認
- DELETE後のDB残存確認：未確認
- 他レコードへの影響：未確認
- 認証Cookie・DB接続文字列は記録しない

### 6. 工程13の最終判定

| 区分 | 判定 |
|---|---|
| Productionデプロイ | PASS |
| 既存機能の回帰確認 | PASS（実施者報告） |
| TODO画面・一覧取得 | PASS（実施者報告） |
| Preview・ProductionのDB照合 | PASS（実施者報告） |
| TODO CRUD操作 | PASS（実施者報告） |
| Productionの個別HTTP仕様 | 未確認 |
| テストデータID・DB残存確認 | 未確認 |
| 総合判定 | **PASS（報告された主要動作確認）** |

**工程13の主要動作確認はPASS（実施者報告に基づく）。** Productionデプロイ、既存機能、TODOのCRUD操作、Preview・Production間のDB照合を確認した。一方、Productionの個別HTTPステータス・レスポンス本文、テストデータID、DB残存確認については未確認として記録する。これらの未確認項目をPASSに含めない。