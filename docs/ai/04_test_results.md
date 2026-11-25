# AI質問機能 テスト結果記録

- 対象リポジトリ：`hyosetsu/Ai-drive-Project2026`
- 対象ブランチ：`feature/ai-app`
- 記録対象：**TASK-01〜TASK-04（各工程の実装と検証結果）**
- 実施日：2026-11-18、2026-11-25（日本時間）
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

### 実測結果（2026-11-25、日本時間）

開発者がNeonの隔離テスト用ブランチ`test-ai-history-task03`とローカルPowerShellで確認した内容。HTTP日時は応答ヘッダーのUTCをJSTへ換算した。DB接続文字列・認証情報・requestIdの値は転記しない。

| 試験ID | 条件・期待結果 | 報告された実測結果 | 判定 |
| --- | --- | --- | --- |
| TASK03-01 | デモ停止中の`GET /api/ai/history`は503 `DEMO_DISABLED` | HTTP **503**、`success:false`、`DEMO_DISABLED`、`no-store`。11/18 16:14:03 JST | **合格** |
| TASK03-02 | ローカル許可・履歴0件なら200 `{success:true,items:[]}` | HTTP **200**、`{"success":true,"items":[]}`、`no-store`。11/18 16:17:31 JST | **合格** |
| TASK03-03 | 隔離DBに25件の同時刻履歴を用意し、実APIから最新20件のみ取得 | Neon SQL Editorで`COUNT(*)=25`、接続設定修正後`success=True`、`Count=20` | **合格（実DB・HTTP統合）** |
| TASK03-04 | 同時刻の並びを`created_at DESC,id DESC`とする | `FirstId=25`、`LastId=6`、`IdDescending=True`。HTTP本文でも25→6の20件を確認 | **合格** |
| TASK03-05 | `id`を文字列として公開 | `IdIsString=True`、HTTP本文`"id":"25"`等 | **合格** |
| TASK03-06 | DB列`prompt/response_text/created_at`を`prompt/response/createdAt`へ変換 | `AllFieldsValid=True`、先頭`TASK03_TEST_25`／`TASK03_RESPONSE_25`／`2026-11-18T00:00:00.000Z`、HTTP本文と一致 | **合格** |
| TASK03-07 | DB接続不能時は履歴0件成功ではなく`HISTORY_UNAVAILABLE` | 無効なローカルDB接続先に切替後、HTTP **503**、`success:false`、`HISTORY_UNAVAILABLE`、`no-store`。11/25 13:41:44 JST | **合格** |
| TASK03-08 | 障害試験後にテスト用DBへ復旧し再び正常取得 | 環境復旧手順を実行、`DatabaseUrlConfigured=True`・`AI_DEMO_ENABLED=true`・`NODE_ENV=development`、HTTP **200**、20件（ID25→6）。11/25 13:43:46 JST | **合格（復旧先の動作）** |

補足：

- 25件のデータはNeon隔離テスト用DBに登録された。通常DBへの追加・削除はこの作業記録の対象外。SQL Editorで25件を確認してもAPIが0件だった時点では接続先未一致の可能性があり、その後`DATABASE_URL`を正しく設定した同じPowerShellからサーバーを起動して20件取得を実測した。
- `id`の具体値25→6はこのテストでの実測値。採番値が常に1〜25になるという一般仕様ではない。
- `createdAt`の先頭値`2026-11-18T00:00:00.000Z`は実際のAPI応答から転記。25件は同じ作成日時で、同時刻のID降順も確認できた。
- DB障害試験はNeonを停止せず、ローカルプロセスの接続先を一時的に到達不能なアドレスへ変えたもの。DB障害による`success:true,items:[]`への誤変換は起こらなかった。
- 復旧後の`DatabaseUrlConfigured=True`は設定有無の証跡で、接続先識別そのものの証明ではないが、同じ25件のテスト履歴を再び取得できたことを確認した。

### 未検証・保留事項（合格扱いにしない）

| 項目 | 状態・理由 |
| --- | --- |
| ゲート停止時のDB SELECT実行回数 | **未実施**。ルート順序の静的確認と503応答はあるが、スパイによる呼出0回の計測なし |
| 64ビットBIGINTの安全整数範囲を超えるID | **未実施**。ID文字列での返却は実測済みだが境界値は未試験 |
| 追加のDB障害分類（SQLSTATE別） | **未実施**。今回の到達不能DBでの503のみ実測 |
| TASK-03変更取得後のビルド／TOP・TODO詳細回帰 | **今回の新たな実測報告なし**。以前のTASK-02合格結果を流用して新たな検証済みと扱わない |
| 実際の公開Production／Preview | **未実施**。公開設定は変更していない |
| Neonブランチの自動削除・DB接続資格情報のローテーション完了 | **未確認**。接続文字列が会話に露出したため、資格情報の無効化・再発行は別途必須 |

### 総合判定

**TASK-03：履歴API実装済み。デモ停止・空履歴・隔離DB25件からの最新20件・同時刻ID降順・公開JSON変換・DB接続障害・復旧の主要受入検証に合格。**

上表の未検証事項は保留として記録する。今回の検証記録更新ではDB実行・コード変更・公開設定変更を行っていない。TASK-04（模擬回答保存）・TASK-05（Gemini接続）は未着手。


---

## TASK-04：模擬回答生成・質問回答の同一行保存（実装・検証記録）

- 対象ブランチ：`feature/ai-app`
- 実施日：2026-11-25（日本時間）
- 対応：`REQ-AI-F002/F003/F005/F009/D001/D005/D006/N003`、`DES-AI-001/002/004/005/006/008`
- 実装変更：`src/apps/ai/aiService.ts`（新規）、`aiController.ts`・`aiRouter.ts`・`aiError.ts`（更新）、`aiModel.ts`の既存パラメータ付きINSERTを再利用。検証用`tests/ai/task04-call-count.test.cjs`を追加し、TypeScript変換部分を修正。
- 記録根拠：開発者から提示されたPowerShellでのビルド・HTTP結果、Neon SQL EditorのSQL実行結果、Nodeテストランナー出力、ブラウザ表示報告。未測定のHTTPコード、DB件数、呼出回数を推測で補わない。
- 仕様整合：POST本文は`question`、成功時は`{success:true,data:{id,prompt,response,createdAt}}`。保存テーブルは`prompt/response_text/created_at`、履歴GETは`items`を使用（設計書の旧例`question/answer`・`data`とは差分あり）。

### 実装内容

1. 既存デモ停止ゲート・Content-Encoding/Content-Type検査・16KiB JSON解析の後に`POST /api/ai/ask`を接続。ローカル`development`・`AI_DEMO_ENABLED=true`・`VERCEL_ENV`未設定・ループバック接続の場合だけ模擬回答保存を許可。
2. `question`の型、前後空白除去、1〜2,000 Unicodeコードポイント、NUL拒否を実装。無効入力で模擬Service/DBを実行しない。
3. Gemini SDK呼出しを持たない固定模擬Service→パラメータ化した同一行INSERT→保存成功時のみHTTP 201。保存失敗・結果不明は回答本文を返さず、INSERTを自動再試行しない。
4. 明示的なPostgreSQLエラー`severity=ERROR`かつSQLSTATEクラス22/23/42/P0を500 `SAVE_FAILED`、それ以外を503 `SAVE_RESULT_UNKNOWN`として分類。
5. `tests/ai/task04-call-count.test.cjs`でController/Middlewareをスタブ・スパイで隔離して検査。初版はTypeScript読み込みの`ts.ScriptTarget.ES2022`参照エラーで8件中1件合格・7件失敗（**テスト用ハーネスの不具合**）。`esbuild`による変換へ修正後、8件すべて成功。

### 実測結果：正常系・入力境界・デモ停止

| 試験ID | 条件・期待結果 | 実際に報告された結果 | 判定 |
| --- | --- | --- | --- |
| TASK04-BUILD | `npm run build`のTypeScript検査 | `> tsc`の後エラーなくPowerShellプロンプトに復帰 | **合格** |
| TASK04-01 | `POST /api/ai/ask`有効質問→201・模擬回答・保存ID | `question="  TASK04_SAVE_TEST_001  "`を送信→**201**、`success:true`、`id:"4"`、`prompt:"TASK04_SAVE_TEST_001"`、固定の模擬回答、`createdAt:"2026-11-25T04:53:44.992Z"` | **合格** |
| TASK04-02 | 保存後の`GET /api/ai/history`で同じ質問・回答を取得 | ID 4・質問`TASK04_SAVE_TEST_001`と同じ模擬回答が履歴一覧に表示された | **合格（履歴照合）** |
| TASK04-03A | 空文字・空白のみは422、数値・項目なしは400 | 空文字**422**、空白のみ**422**、数値**400**、項目なし**400** | **4件合格（ステータス）** |
| TASK04-03B | 日本語「あ」1/2,000/2,001文字→201/201/422 | **201／201／422**、すべて`PASS` | **3件合格** |
| TASK04-03C | 絵文字😀1,500/2,000/2,001個→201/201/422 | **201／201／422**、すべて`PASS` | **3件合格** |
| TASK04-05A | デモ停止時のPOSTは503 `DEMO_DISABLED` | **HTTP 503**、`success:false`、`DEMO_DISABLED`、`Cache-Control:no-store`、UUID形式requestId。2026-11-25 **14:00:47 JST** | **合格** |
| TASK04-05B | デモ停止時のGET履歴は503 `DEMO_DISABLED` | **HTTP 503**、同様の安全なエラーJSON。2026-11-25 **14:00:48 JST** | **合格** |

### 実測結果：DB保存失敗・安全な後片付け

| 試験ID | 条件・期待結果 | 実際に報告された結果 | 判定 |
| --- | --- | --- | --- |
| TASK04-06A | DB接続不能→503 `SAVE_RESULT_UNKNOWN` | 接続先をローカルの到達不能なDBへ一時変更してPOST→**503**、`success:false`、`SAVE_RESULT_UNKNOWN`、保存結果の再確認を促すメッセージ、requestIdあり。回答本文・DB接続情報なし | **合格（接続不能ケース）** |
| TASK04-06B | 隔離DBで確定的なINSERT拒否→500 `SAVE_FAILED` | 隔離Neonで指定テスト質問だけ拒否する一時CHECK制約を追加。`TASK04_SAVE_FAILED_TEST`のPOST→**HTTP 500**、`success:false`、`SAVE_FAILED`、回答本文なし | **合格（CHECK拒否ケース）** |
| TASK04-06C | 失敗した質問はDBに保存されず、一時制約は残らない | Neon SQL Editorで`failed_test_rows=0`、`remaining_constraints=0`を照会 | **合格（事後照会・制約削除確認）** |
| TASK04-06D | DB接続不能試験後に通常の履歴APIへ復旧 | `DATABASE_URL`未設定のPowerShellがあったが、起動中のAPIでGET履歴**200**・`success:true`・テスト履歴ID 4〜8等を取得 | **合格（履歴APIの動作復旧）／接続ブランチ識別は別途注意** |

補足：

- **接続先食い違いを実測**：SQL Editorで`history_count=25`、テスト質問0件、制約存在を確認した一方、当初のPOSTは**201**・`id:"9"`で保存された。接続先が一致していない可能性が高く、この最初の201は`SAVE_FAILED`の合格判定に使っていない。接続環境変数を適切に設定後、同じ質問で500を再現した。
- `database_name=neondb`と`schema_name=public`だけではNeonブランチを一意に特定できない。DB操作前の隔離ブランチ確認と、サーバーを起動するPowerShellの接続設定一致を重視する。
- 500試験では既存の共有DBの権限・トリガーを変更せず、隔離DBに限定した一時CHECK制約を利用。制約追加・削除と0件照会は開発者がNeon SQL Editorで実施した。DBの削除・TRUNCATEは行っていない。
- 503は接続不能を使った結果不明応答の再現であり、**INSERT送信後・応答喪失**の実故障は未再現。500試験でドライバが返したSQLSTATEコードそのものはHTTP応答に記載されず、今回は既知のCHECK違反からエラー分類を確認した。

### 実測結果：スタブ・スパイおよびTOP・TODO回帰

| 試験ID | 条件・期待結果 | 実際に報告された結果 | 判定 |
| --- | --- | --- | --- |
| TASK04-SPY | `node --test tests/ai/task04-call-count.test.cjs` | 初版は**pass 1/fail 7**（テストハーネスのTypeScript変換エラー）。修正後は**tests 8、pass 8、fail 0**、約930 ms | **合格（修正版）** |
| TASK04-SPY-VALID | 有効入力で模擬Service 1回、INSERT 1回、SELECT 0回・HTTP 201 | スタブの計測と応答アサーションが成功 | **合格（隔離単体試験）** |
| TASK04-SPY-INVALID | 空文字・空白・2,001コードポイント・数値・項目なしでService/INSERT/SELECT全0回 | 5ケースのアサーションが成功 | **合格（隔離単体試験）** |
| TASK04-SPY-GATE | 停止ゲート時にControllerへ進まずService/DB 0回・503 | アサーションが成功 | **合格（隔離単体試験）** |
| TASK04-SPY-STATIC | 模擬ServiceコードにGemini SDK importや外部通信処理なし | 静的検査1件が成功 | **合格（静的検査）** |
| TASK04-REG-01 | TOP `/`が200、TODO画面が表示される | HEAD `/`は**200**、HEAD `/todo`は**301 Location:/todo/**、`curl -L -I`で最終**200**、ブラウザで`/todo/`正常表示 | **合格（応答・操作報告）** |
| TASK04-REG-02 | TODO一覧が取得できる | GET `/api/v1/todos` → **200**、`{"success":true,"data":[]}` | **合格** |
| TASK04-REG-03 | TODOの登録・完了更新・削除 | テスト用TODO `TASK04_REGRESSION_TEST`を登録、`id=1`、PATCH後`completed=True`、DELETEがエラーなく終了。各操作のHTTPコードそのものは未記録 | **合格（操作結果）／HTTPコード未記録** |
| TASK04-REG-04 | テストTODOの削除後に一覧が元の0件へ戻る | GETの`success=True`、`Count=0` | **合格** |
| TASK04-REG-05 | TODOテーブル存在 | `to_regclass('public.todo_tasks')` → `todo_tasks` | **合格（DB照会）** |

### 残る未検証・条件付き事項

| 項目 | 状態・理由 |
| --- | --- |
| 1件のHTTP POSTに対する実DBの増分を前後COUNTで厳密確認 | **未測定**。201成功と履歴上の同一記録確認、およびスタブでのINSERT1回は実施済み。実DBの行数増分比較は別 |
| ゲート停止時のDB SELECT/Gemini通信の実プロセス計測 | **未実施**。Middlewareスタブによる0回・模擬Service静的検査は成功したが、実Gemini/DBネットワーク通信計測ではない |
| Gemini APIへの実通信 | **未実施（TASK-04の対象外）**。TASK-05にて実装する |
| INSERT結果不明の送信後障害、SQLSTATE 42501/P0001、他クラス | **未実施**。接続不能とCHECK制約拒否のみ |
| Production・保護済みPreviewでの動作、非ループバックの模擬機能拒否 | **未実施**。コード上の条件は確認済み。公開環境の検証は後続 |
| AIリクエストのJSON構文不正、16KiB超、未対応Content-Encodingなどの全境界 | **TASK-04としては実測未報告**。パーサーとエラーハンドラは実装済みだが、後続の異常系工程で確認 |
| TOPブラウザの表示細部、TODO既存404や10KB超、DBサンプル等の詳細回帰 | **未実施／今回の報告なし**。TOP HEAD200とTODOの画面/CRUDは確認済み |
| NeonのDB接続資格情報のローテーション完了 | **未確認**。過去に接続文字列が会話へ露出しているため、無効化・再発行の確認が必要 |

### 総合判定

**TASK-04：実装済み。模擬回答のPOST→201→履歴GET、入力不正・Unicode文字数境界、デモ停止、DB保存異常（500/503）、隔離DBの後片付け、スタブ・スパイ8件、TOP/TODO主要回帰の受入試験に合格。**

未測定項目を上表に留保し、**TASK-05の実Gemini接続は未着手**とする。今回の記録更新ではソースコード・DB・環境変数・デプロイ設定を変更しない。


---

## TASK-05：実Gemini API接続（実装記録・検証待ち）

- 対象ブランチ：`feature/ai-app`、実装日：2026-11-25（日本時間）
- 対応：`REQ-AI-F004/F005/F010/D006/N002/N007`、`DES-AI-001/002/004/007/008`
- 対象：`package.json`、`src/apps/ai/aiService.ts`、`aiController.ts`、`aiRouter.ts`、`aiError.ts`、隔離テストファイル。既存`aiModel.ts`・TODO・共通DB設定は変更しない。
- SDK：公式`@google/genai` 3.6.1（Node.js 22以上が必要）。環境変数名`GEMINI_API_KEY`、モデルID`gemini-2.5-flash`を採用。固定システムプロンプトなし。質問は当該1件のみ送信し、過去履歴は渡さない。
- `package-lock.json`：**未更新**。外部レジストリへのアクセスが可能なローカル環境で`npm install`を実行して正式なlockfileを生成し、同じブランチにコミットする必要がある。lockfile不一致の状態で`npm ci`を実行しない。

### 実装内容

1. デモゲート・入力検証を通過した場合だけServiceを呼び、SDKを遅延import・初期化。環境変数にキーがなければAI呼出せず502を返す。キー値は記録・応答しない。
2. `generateContent`を1回呼び出す。SDKリトライ設定`retryOptions.attempts=1`（初回呼出を含む1回、再試行0回）、`automaticContinuation=false`（暗黙の追加呼出を抑止）。
3. 暫定SDKタイムアウト`30,000ms`。SDKのタイムアウト分類は504 `AI_TIMEOUT`、その他の取得失敗・空白回答は502 `AI_UNAVAILABLE`。タイムアウト30秒は未確定で、TASK-09で実環境と照合する。
4. Gemini回答取得・trim成功後に既存`insertAiHistory(question, answer)`を1回だけ呼ぶ。INSERT成功後のみ201・保存された回答を返す。確定的DB拒否は500 `SAVE_FAILED`、保存結果不明は503 `SAVE_RESULT_UNKNOWN`。自動再送・自動INSERT再試行は行わない。
5. Production・Preview未認証を許可しない既存のゲートを維持。ローカルdevelopment/ループバック以外では実AI呼出を拒否する。
6. スパイテストは新しいService名に対応し、正常時Gemini1回/INSERT1回、無効入力とゲート停止時0回、AI失敗時INSERT0回などを検査するよう更新。

### 予定試験（実測が提出されるまで合格扱いにしない）

| 試験ID | 期待結果 | 現状 |
| --- | --- | --- |
| TASK05-DEPS | `npm install`によりSDKとlockfileの依存整合 | **未実施、lockfile更新待ち** |
| TASK05-BUILD | `npm run build`がエラーなく完了 | **未実測** |
| TASK05-SPY | `node --test tests/ai/task04-call-count.test.cjs`の全件合格、正常1回、無効入力0回、AI失敗時INSERT0回 | **未実測**（既存のTASK-04テスト結果を流用しない） |
| TASK05-REAL | 隔離DB＋ローカル開発環境で有効な1質問→実Gemini応答・1行保存・201 | **未実測。キー値・回答全文は記録しない** |
| TASK05-HISTORY | 成功直後の履歴GETで質問・回答一致 | **未実測** |
| TASK05-STOP | 停止時／キーなし時のAPI応答と起動、SDK/DB呼出抑止 | **未実測** |
| TASK05-REG | TOP/TODO画面とTODO CRUD正常 | **未実測** |
| TASK05-DEPLOY | 保護済みPreviewおよびProduction拒否 | **未実施（後続のTASK-12）** |

### 総合判定

**TASK-05：ソースコード実装をGitHubに反映済み、依存lockfileとローカル・実Gemini・DB・回帰試験は未完了。次工程への受入合格は保留。**

実際のGemini通信やNeon書込み、機密情報・デプロイ設定の変更は、今回のGitHubコード反映では行っていない。
