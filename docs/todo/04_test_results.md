
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
| Vercelで実際にデプロイされたコミット | 未照合 |
| Vercelプロジェクト | 未記録 |
| Preview URL | 未記録 |
| デプロイステータス | 未記録（画面・APIの正常動作は報告あり） |
| Neon接続先 | 接続成功を確認。Preview / Production間の接続先照合は未確認（接続文字列は記録しない） |

### 2. デプロイ前の確認

| ID | 確認項目 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| P01 | `npm run build` | ビルド成功 | `tsc` がエラーなく終了 | PASS |
| P02 | `git diff --check` | エラーなし | 出力なし、エラーなし | PASS |
| P03 | Gitのブランチ・コミット | Preview対象が明確で、Productionブランチへの直接pushではない | `feature/todo-app`、`29ccd7f`、`origin/feature/todo-app` と一致。`git status --short` は出力なし | PASS |
| P04 | VercelのGit連携・Root Directory | 正しいリポジトリ・ディレクトリを参照 | 設定の直接確認記録なし | 未確認 |
| P05 | Previewの環境変数 | `DATABASE_URL` 等の必要な変数名が設定済み | DB接続の成功は確認。設定画面での変数名確認記録なし | 一部確認 |
| P06 | PreviewとProductionのDB接続先 | 設定方針を照合し、共有DBなら影響範囲を把握 | 接続先の照合結果未記録 | 未確認 |
| P07 | Previewデプロイ | 対象コミットのデプロイが `Ready` | 稼働中のPreview画面・APIで正常動作報告あり。`Ready`表示とコミットの一致は未記録 | 一部確認 |

### 3. Preview画面・API・静的ファイル確認

| ID | パス | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| P08 | `/` | HTTP 200・TOPページ表示 | 正常動作（実施者報告） | PASS |
| P09 | `/api/db-check` | HTTP 200・DB接続成功 | 正常動作・DB接続成功（実施者報告） | PASS |
| P10 | `/api/v1/todos` | HTTP 200・JSONの一覧取得 | 正常動作・TODO一覧取得（実施者報告） | PASS |
| P11 | `/todo` | 想定どおりのリダイレクトまたは画面表示 | このパス単独の結果は未報告 | 未確認 |
| P12 | `/todo/` | HTTP 200・TODO画面表示 | HTTP 200・画面正常表示（実施者報告） | PASS |
| P13 | `/todo/todo.js` | HTTP 200・JavaScript配信 | HTTP 200（実施者報告） | PASS |
| P14 | `/todo/todo.css` | HTTP 200・CSS配信 | HTTP 200（実施者報告） | PASS |
| P15 | `/db-sample` | HTTP 200・既存商品一覧表示 | 正常動作（実施者報告） | PASS |

### 4. PreviewでのTODO CRUDテスト

テストデータは `[TEST]` を付けた架空データに限定し、既存レコードの更新・削除を避ける。実測詳細が報告されていない項目については、成功した操作と区別して記録する。

| ID | 操作・確認内容 | 期待結果 | 実測結果 | 判定 |
|---|---|---|---|---|
| P16 | GET `/api/v1/todos` | HTTP 200・`data` が配列 | 一覧取得成功（実施者報告） | PASS |
| P17 | POST `/api/v1/todos` | HTTP 201・テストデータ登録 | 登録成功（実施者報告） | PASS |
| P18 | PATCH `/api/v1/todos/:id` | HTTP 200・`completed` が変更される | 更新成功（実施者報告） | PASS |
| P19 | PATCH後の他列確認 | `title`・`created_at` が変化しない | Previewでの他列比較結果は未報告 | 未確認 |
| P20 | DELETE `/api/v1/todos/:id` | HTTP 204・レスポンス本文なし | 削除成功（実施者報告） | PASS |
| P21 | DELETE後のGET | 対象IDが取得結果に存在しない | Previewでの削除後の一覧比較結果は未報告 | 未確認 |

- 使用したテストタイトル：未記録
- 登録されたテストID：未記録
- テスト開始前の対象状態：未記録
- テスト終了後の対象状態：未記録
- 他レコードへの影響：未確認
- HTTPステータス・レスポンス詳細：画面・API全体は正常との報告あり。POST/PATCH/DELETE個別の生ログは未添付

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
| Vercelデプロイの状態・コミット | 未添付 |
| Vercel Build Logs（機密情報を除く） | 未添付 |
| PreviewのHTTP・CRUD実行ログ | 実施者から正常動作の報告あり。ログ未添付 |
| ブラウザNetwork / Console | 未添付 |
| TODO画面のスクリーンショット | 未添付 |
| NeonのDB確認結果（機密情報を除く） | 未添付 |

### 9. 工程11の最終判定

| 区分 | 判定 |
|---|---|
| Git・ローカルビルド | **PASS** |
| PreviewのTODO画面・静的ファイル | **PASS**（実施者報告） |
| PreviewのTODO API（GET / POST / PATCH / DELETE） | **PASS**（実施者報告） |
| Neon PostgreSQL接続 | **PASS**（実施者報告） |
| 既存機能の回帰テスト | **PASS**（実施者報告） |
| PreviewデプロイのReady・コミット照合 | 未確認 |
| Preview / ProductionのDB接続先照合 | 未確認 |
| テストデータの後片付け・DB残存確認 | 一部確認（削除操作は成功報告あり） |
| 総合判定 | **PASS（報告された主要動作確認。未確認項目は上記のとおり）** |

**工程11の主要動作確認は完了。** Vercel Preview上でTODO画面・静的ファイル・DB接続・CRUD操作・既存機能が正常に動作したとの報告を確認した。一方、PreviewデプロイのReady表示とコミットの照合、Preview/ProductionのDB接続先、操作ログやDBでの後片付けについては詳細を未記録として残す。未確認事項をPASS扱いしない。

### 10. 次工程

工程12の内容は `docs/todo/03_implementation_plan.md` を確認してから着手する。Productionへの公開や既存DBへの変更は、本記録のPASS判定だけを根拠に実行しない。
