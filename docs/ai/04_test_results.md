# AI質問機能 テスト結果記録

- 対象リポジトリ：`hyosetsu/Ai-drive-Project2026`
- 対象ブランチ：`feature/ai-app`
- 記録対象：**TASK-01 共通ひな型・デモ停止ゲートのみ**
- 実施日：2026-11-18（日本時間）
- 記録根拠：開発者が会話で提示したPowerShellのビルド結果、curl.exeのHTTP応答、画面・TODO操作の報告
- 判定方針：実測・操作報告・静的確認・未実施を区別する。未測定の値を補完しない。

## TASK-01：共通ひな型・デモ停止ゲート

### 対応要件・設計

- 要件：`REQ-AI-F011`, `F012`, `N001`, `N002`, `N004`, `N005`, `N006`
- 設計：`DES-AI-001`, `002`, `006`, `007`, `009`
- 作業目的：AI Routerを既存本文解析より前に登録し、デモ停止時は本文解析・AI/DBアクセスより先に質問・履歴APIを503 `DEMO_DISABLED`で拒否する。既存TOP・TODOを壊さない。

### 事前状態と変更内容

GitHubの`feature/ai-app`において、着手前の`index.ts`にはAI Router登録がなく、`src/apps/ai/`の対象3ファイルは存在しなかった（GitHubでの事前確認）。

| 変更対象 | TASK-01での変更 |
| --- | --- |
| `index.ts` | `aiRouter`をimportし、既存の`express.urlencoded`、`express.static`より前に`app.use('/api/ai', aiRouter)`を登録 |
| `src/apps/ai/aiRouter.ts`（新規） | AI専用Router、停止ゲート、ヘッダー検査、POST `/ask`の16,384バイトJSONパーサー、暫定404、AI専用エラー処理の順で登録 |
| `src/apps/ai/aiMiddleware.ts`（新規） | `requestId`、`Cache-Control: no-store`、デモ許可判定、Content-EncodingおよびContent-Type検査 |
| `src/apps/ai/aiError.ts`（新規） | `success:false`の公開用JSONエラー形式、JSON解析エラーの分類、安全な最終エラー応答 |

既存TOP・TODO・DB実装、DB設定、秘密ファイル、公開環境設定への変更はTASK-01の範囲に含めていない。質問・履歴の本処理、Gemini SDK、AI用DBモデルは未実装。

### 実行・実測結果

| 試験ID | 条件・実行コマンド等 | 期待結果 | 報告された実際の結果 | 判定 |
| --- | --- | --- | --- | --- |
| T01-01 | `npm run build` | `tsc`がエラーなく終了 | `> tsc`の後、エラーなしでPowerShellプロンプトに復帰 | **合格** |
| T01-02 | `GET /api/ai/history`（停止時、初回ブラウザ確認） | `DEMO_DISABLED`のJSON | `success:false`、`error.code: DEMO_DISABLED`を表示。初回はHTTPステータス未記録 | **応答JSON合格、初回HTTP未記録** |
| T01-03 | `POST /api/ai/ask`（停止時、PowerShell） | HTTP 503／`DEMO_DISABLED` | `StatusCode: 503`を開発者が報告 | **合格（ステータス）** |
| T01-04 | `GET /api/ai/unknown`（停止時、`curl.exe -i`） | 404より先に503／`DEMO_DISABLED` | **503**、`DEMO_DISABLED`、`no-store`、JSONレスポンス、requestIdあり | **合格** |
| T01-05 | `POST /api/ai/ask` に不正JSON `{invalid`（停止時） | JSON解析より先に503／`DEMO_DISABLED` | **503**、`DEMO_DISABLED`、`no-store`、JSONレスポンス | **合格** |
| T01-06 | Production相当（`NODE_ENV=production`、`AI_DEMO_ENABLED=true`で起動する手順を案内）で`POST /api/ai/ask` | 許可フラグにかかわらず503／`DEMO_DISABLED` | **503**、`DEMO_DISABLED`、`no-store`。2026-11-18 15:34:38 JST相当 | **合格（提示された設定で起動した前提）** |
| T01-07 | 同条件の`GET /api/ai/history` | 503／`DEMO_DISABLED` | **503**、`DEMO_DISABLED`、`no-store`。2026-11-18 15:34:44 JST相当 | **合格（提示された設定で起動した前提）** |
| T01-08 | `POST /api/ai/ask` に`application/x-www-form-urlencoded`、`question=test`を送信（停止時） | Content-Typeや本文解析より先に503／`DEMO_DISABLED` | **503**、`DEMO_DISABLED`、`no-store`。2026-11-18 15:35:25 JST相当 | **合格** |
| T01-09 | `GET /` | TOP画面が従来どおり表示 | 開発者からTOP画面正常表示との報告 | **合格（操作報告）** |
| T01-10 | `/todo`の一覧取得・登録・更新・削除 | 既存のTODO CRUDが従来どおり動作 | 開発者から4操作とも正常との報告 | **合格（操作報告）** |
| T01-11 | `src/apps/ai`内のファイル一覧および`pool.query`、`generateContent`、`aiService`、`aiModel`、DB import等の文字列検索 | TASK-01にAI用のGemini・DB呼出処理がない | `aiError.ts`、`aiMiddleware.ts`、`aiRouter.ts`の3件のみ。指定パターンの検索結果なし | **合格（静的確認のみ）** |

#### 応答の安全性に関する観察

- HTTP実測の503応答には`Content-Type: application/json; charset=utf-8`と`Cache-Control: no-store`が存在した。
- `requestId`は提示された複数リクエストで異なるUUID形式の値だった。値は本記録に転記しない。
- 提示されたAI API応答にスタックトレース、接続文字列、APIキー、質問全文は含まれていない。
- Gemini・AI用DB Modelはこの工程では未実装で、静的検索でもAI用の呼出処理は検出されなかった。ただし**スタブ・スパイによる実行時呼出0回の計測は未実施**。既存TOP/TODOのDBアクセスとは区別する。

### 未検証・条件付き事項

| 項目 | 状態・理由 |
| --- | --- |
| Production相当の起動環境値そのものの実測証跡 | **未記録**。コマンドで指定する手順を案内し、その後に503の実測結果が提出された。実際の環境値はログに表示・保存していない |
| 実際のProduction／Previewへのアクセス | **未実施**。ホスティングの設定・公開状態は変更していない。Previewの認証保護は未決 |
| Gemini・DBスタブ／スパイ呼出回数 | **未実施**。TASK-01では呼出処理未実装の静的確認のみ |
| 停止時の大容量JSON／Content-Encodingの直接試験 | **未実施**。ゲートの先行順は未知URL、不正JSON、urlencodedで確認 |
| デモ許可時の404・400・413・415等 | **未実施**。本処理未実装のため、別途試験する |
| TODOの10KB+1入力拒否、既存DBサンプル、既存404・異常系の詳細回帰 | **未実施**。TODO CRUDとTOP表示は確認済み |
| Production相当テスト後の環境変数復旧・通常起動の再確認 | **報告未取得**。元の値に復旧し、必要なら`npm run dev`を再起動して確認する |
| Gemini APIキーなしでの新規起動の実測 | **未実施**。ゲート外のSDK初期化はコード上未追加 |

### 総合判定と残事項

**TASK-01：コード反映済み、主要受入試験に合格。実際の公開環境・実行時計測など未検証事項を残す。**

- ビルドと停止ゲートの優先順位、Production相当での両API停止、TOP/TODOの主要回帰を確認した。
- AI用のGemini・DBアクセスが未実装であることは静的に確認した。これを実行時の呼出0回測定済みと表現しない。
- 検証記録は会話で報告された範囲に限定し、秘密ファイルの内容・環境変数の値・APIキー等を保存していない。
- **TASK-02以降の実装は行っていない**。


---

## TASK-02：AI履歴DB土台・履歴取得API（2026-11-18）

- 対応要件：REQ-AI-D001/D002/D003/D004/D005、REQ-AI-F007/F008/F009、REQ-AI-N001/N005
- 対応設計：DES-AI-002/004/005/006
- 実装範囲：DDL、共有Poolを使用するModel、GET /api/ai/history、公開項目の変換、履歴障害応答
- 注意：今回の依頼に従い、従来設計の `question/answer` 列・`data` 配列ではなく、`prompt/response_text` 列・`items` 配列を採用。後続UI/INSERT実装は新形式との整合確認が必要

### 変更内容と事前状態

- 事前：TASK-01で履歴GETは未実装、AI用SQLとModel/Controllerは存在しなかった
- 新規：`sql/ai/030_create_ai_qa_logs.sql`（CREATE TABLE IF NOT EXISTS、制約、降順複合索引）
- 新規：`src/apps/ai/aiModel.ts`（固定20件SELECT、DB列→API列変換、将来用パラメータ付き1行INSERT）
- 新規：`src/apps/ai/aiController.ts`（成功200/空配列、障害500/503）
- 更新：`src/apps/ai/aiRouter.ts`（デモゲートより後にGET履歴を追加）
- 更新：`src/apps/ai/aiError.ts`（HISTORY_UNAVAILABLEを追加）
- 変更していない：`db.ts`、`index.ts`、既存TODO、環境変数、デプロイ設定

### 試験結果（2026-11-18、開発者から提示された実測／操作報告）

| 試験ID | 条件・確認方法 | 期待結果 | 報告された実結果 | 判定 |
| --- | --- | --- | --- | --- |
| TASK02-STATIC-01 | GitHubでTASK-02の変更5ファイルを再取得 | SQL、Model、Controller、Router、Errorの反映を確認 | 5ファイルをGitHubから取得・内容確認 | **合格（静的確認）** |
| TASK02-BUILD | `npm run build` | `tsc`がエラーなく終了 | `> tsc`後、エラーなしでPowerShellプロンプトに戻った | **合格** |
| TASK02-DB-01 | `information_schema.columns`から表定義を確認 | id BIGINT IDENTITY ALWAYS、prompt・response_text TEXT、created_at TIMESTAMPTZ、全列NOT NULL | 指定4列・データ型・IDENTITY・DEFAULT CURRENT_TIMESTAMP・NOT NULLを確認 | **合格（DB定義照会）** |
| TASK02-DB-INDEX | `pg_constraint`／`pg_indexes`を確認 | PK、prompt/response_text CHECK、複合降順インデックス | `ai_qa_logs_pkey`、2件のCHECK、`idx_ai_qa_logs_created_id`（created_at DESC, id DESC）を確認 | **合格（DB定義照会）** |
| TASK02-API-01 | `curl.exe -i http://localhost:3000/api/ai/history`（デモ許可時） | HTTP 200、`success:true`、`items:[]` | **HTTP 200 OK**、`{"success":true,"items":[]}`、`Cache-Control: no-store`。応答日時 2026-11-18 15:46:09 JST | **合格** |
| TASK02-SQL-ORDER | `generate_series(1,25)`を使うWITH句の模擬履歴（同一created_at）に対して`ORDER BY created_at DESC, id DESC LIMIT 20` | 20件、ID 25→6 | 20件、ID 25から6まで1ずつ降順 | **合格（SQLロジックのみ）** |
| TASK02-CHECK-A | `INSERT (prompt='', response_text='test response')` | prompt CHECK違反 | SQLSTATE `23514`、`ai_qa_logs_prompt_length_chk` | **合格（制約違反を確認）** |
| TASK02-CHECK-B | `INSERT (prompt=repeat('A',2001), response_text='test response')` | prompt CHECK違反 | SQLSTATE `23514`、`ai_qa_logs_prompt_length_chk` | **合格（制約違反を確認）** |
| TASK02-CHECK-C | `INSERT (prompt='test prompt', response_text='')` | response CHECK違反 | SQLSTATE `23514`、`ai_qa_logs_response_nonempty_chk` | **合格（制約違反を確認）** |
| TASK02-API-03A | 停止時`POST /api/ai/ask` | HTTP 503、`DEMO_DISABLED` | HTTP 503、`DEMO_DISABLED`、`no-store`。応答日時 2026-11-18 15:51:29 JST | **合格** |
| TASK02-API-03B | 停止時`GET /api/ai/history` | HTTP 503、`DEMO_DISABLED` | HTTP 503、`DEMO_DISABLED`、`no-store`。応答日時 2026-11-18 15:51:35 JST | **合格** |
| TASK02-REG-01 | `/`、`/todo`、TODO一覧・登録・完了更新・削除 | 既存動作を維持 | TOP/TODO表示、TODO一覧・登録・更新・削除すべて正常との操作報告 | **合格（操作報告）** |
| TASK02-REG-02 | `/api/v1/todos/unknown` | 既存仕様の404 `NOT_FOUND` | `success:false`、`error.code: NOT_FOUND`を確認。HTTPステータスそのものは提示されていない | **JSON確認済み／HTTPステータス未記録** |

#### CHECK制約試験の実行状態・注意

- Aでは`BEGIN`、`SAVEPOINT test_case`の成功が報告された。B/CもSAVEPOINTまで同様との報告。
- 3ケースともINSERTは制約違反（SQLSTATE `23514`）で拒否された。エラーに表示されたID 1、2、3はIDENTITYシーケンスの採番結果を示し、挿入成功の証拠ではない。
- SQL Editorが失敗後の`ROLLBACK TO SAVEPOINT`／`ROLLBACK`を実行したか、および試験後のトランザクション状態は**未確認**。必要なら同一セッションで`ROLLBACK;`を単独実行して確認する。
- WHEN句で模擬した25件は`ai_qa_logs`へINSERTしていない。この結果は**実テーブルを通るModel/APIの21件以上の試験ではない**。
- CHECKのエラー出力にはテスト用の入力断片が含まれたが、APIキー・DB接続情報は提示されていない。本記録では長文のテスト入力やrequestIdの具体値を転載しない。

### 未検証・保留事項（合格として数えない）

| 項目 | 状態と理由 |
| --- | --- |
| 実テーブルに21件以上存在する場合の`GET /api/ai/history` | **未実施**。SQL WITH句での20件確認のみ。実APIでの最大20件・同時刻ID降順は未測定 |
| DB列→公開JSONの`id`文字列、`prompt`、`response`、`createdAt`への変換 | **未実測**。0件応答しか確認されていない |
| DB障害時のHTTP 500/503 `HISTORY_UNAVAILABLE` | **未実施**。安全な故障注入を実施していない |
| 停止ゲート通過前のDB SELECT呼出回数 | **実行時計測未実施**。Middleware/Routerの先行順は静的確認済み |
| CHECK拒否後のトランザクション終了・行の不存在照会 | **未確認**。SQLSTATE 23514の拒否は確認済み、ROLLBACK実行完了の証跡なし |
| 実デプロイProduction／保護済みPreviewでの確認 | **未実施**。ローカルで停止応答を確認 |
| TODOの10KB+1リクエスト拒否、既存DBサンプル、その他既存エラー応答の回帰 | **未実施**。TOP/TODO通常操作と未知TODO APIのJSONは確認済み |
| SQL DDL実行の完全な履歴・接続先識別 | **未記録**。対象表の構造が存在することは照会で確認したが、実行時のDB名・ブランチとDDL適用ログは提示されていない |

### 総合判定

**TASK-02：実装済み。ビルド・テーブル定義・空履歴API・SQL並び順・CHECK拒否・停止ゲート・TOP/TODOの主要回帰は合格。上記未検証事項があるため、全受入条件の完全合格とは記録しない。**

- 既存データ削除、TRUNCATE、DROP、表の再作成を本記録作成時には行っていない。
- 記録作成に伴うDB操作、環境変数変更、デプロイ操作は実施していない。
- TASK-03以降の実装は行っていない。


---

## TASK-03：履歴取得API（実装状態の確認・記録）

- 対象ブランチ：`feature/ai-app`
- 対応要件：`REQ-AI-F007`／`F008`／`F009`／`D002`／`D003`／`D004`／`N001`
- 対応設計：`DES-AI-001`／`002`／`004`／`005`／`006`
- 実装状況：**TASK-02で実装済みだった履歴取得処理を再利用**。本工程では重複実装・新しいAPI・DB更新を行わず、`aiRouter.ts`の工程説明コメントだけを更新した。
- 仕様差分：現行のHTTP成功形は、この開発で後から指定された`{ "success": true, "items": [] }`を採用。古い`spec.md`や`tasks.md`に残る`data: []`とは異なる。Modelの公開項目は`id`（文字列）、`prompt`、`response`、`createdAt`。
- `@google/genai`：開発者からローカルで`npm install @google/genai`実施済みと報告あり。ただし、この工程ではGemini APIを呼び出さない。GitHub側の`package.json`では、確認時点で同SDKの依存記載は未確認。インストール後のローカル差分やビルドは本工程で実測していない。

### 現状のコード確認

| 項目 | 実装と確認内容 | 判定 |
| --- | --- | --- |
| デモ停止を優先 | `aiRouter`がゲートの後で`GET /history`を登録 | **静的確認済み** |
| 固定SELECT | `ORDER BY created_at DESC, id DESC LIMIT 20` | **静的確認済み** |
| 0件の成功応答 | `200`、`success:true`、`items:[]` | **TASK-02でHTTP実測済み** |
| DB→公開項目 | `id/prompt/response/createdAt`への変換、日時はISO、IDは文字列 | **コード静的確認済み／非空のHTTP応答は未検証** |
| DB障害時 | 500/503 `HISTORY_UNAVAILABLE`、0件成功へフォールバックしない | **コード静的確認済み／故障試験未実施** |
| 停止時 | HTTP 503 `DEMO_DISABLED` | **TASK-02でHTTP実測済み** |
| TOP・TODO回帰 | 画面・CRUDの正常動作 | **TASK-02で操作報告済み** |

### TASK-03で未実施の試験

1. 実DBに21件以上のテスト履歴を用意し、HTTP経由で最新20件・同時刻ID降順を確認する試験。TASK-02でのWITH句25件はSQL順序確認のみであり、HTTP統合試験とは区別する。
2. 非空履歴に対する公開JSONの`id`文字列、`prompt`、`response`、`createdAt`の実測。安全整数上限を超えるIDも未試験。
3. DBが利用不能な場合に`HISTORY_UNAVAILABLE`を返し、`items: []`で成功させない故障試験。
4. 停止ゲートでDB SELECTが0回であることのスパイ計測。
5. 本工程の変更取得後の`npm run build`、TODOを含む追加回帰。

**判定：TASK-03の機能は実装済み。既存のTASK-02で確認した空履歴・停止時応答は合格。非空履歴の順序、公開項目変換、DB障害などのTASK-03受入試験は未完了。**

DBへのSQL実行、データ追加・削除、環境変数登録、公開設定の変更は行っていない。TASK-04（模擬回答保存）・TASK-05（Gemini接続）は未着手。
