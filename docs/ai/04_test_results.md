# AI質問機能 テスト結果記録

- 対象リポジトリ：`hyosetsu/Ai-drive-Project2026`
- 対象ブランチ：`feature/ai-app`
- 記録対象：**TASK-01〜TASK-03（各工程の実装と検証結果）**
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

## TASK-04：模擬回答生成・質問回答の同一行保存（実装記録）

- 対象ブランチ：`feature/ai-app`
- 対応：`REQ-AI-F002/F003/F005/F009/D001/D005/D006/N003`、`DES-AI-001/002/004/005/006/008`
- 対象：`src/apps/ai/aiService.ts`（新規）、`aiController.ts`、`aiRouter.ts`、`aiError.ts`（更新）。`aiModel.ts`はTASK-02の`insertAiHistory`（パラメータ付き単一行INSERT）を再利用し、変更していない。
- 状態：**コードのGitHub反映・再取得による静的確認済み。ローカルのビルド・HTTP試験・DBのINSERT実測は未実施。**

### 実装内容と設計上の注意

1. `POST /api/ai/ask`を、既存の停止ゲート→Content-Encoding/Content-Type検査→16KiBのJSON解析→Controllerの順に接続。既存TODOのRouterやDB接続設定は変更しない。
2. 模擬回答は`generateMockAnswer`に固定したテスト専用の日本語文。Gemini SDKのimport・初期化・外部AIアクセスを行わない。
3. 模擬回答の保存を許可するのは、`NODE_ENV=development`、`VERCEL_ENV`未設定、`AI_DEMO_ENABLED=true`、接続元ソケットのアドレスがループバックの場合のみ。既存のゲートも先に判定する。実際のホスティング保護が確証されない状態でPreview/Productionのデモを有効にしない。
4. JSON本文の型・`question`文字列・trim後の1〜2,000 Unicodeコードポイント・NULを検証し、失敗時は400 `INVALID_BODY`／422 `VALIDATION_ERROR`。検証不合格では模擬回答・DB INSERTを呼ばない。
5. 入力検証→模擬回答→`insertAiHistory`の1回INSERT→成功時だけ201 `{success:true,data:{id,prompt,response,createdAt}}`。TASK-02で採用した公開項目名を維持し、歴史APIも`items`を維持。
6. INSERT例外で、PostgreSQLが明示した`severity=ERROR`かつSQLSTATEクラス22/23/42/P0の拒否は500 `SAVE_FAILED`、それ以外は保存結果不明として503 `SAVE_RESULT_UNKNOWN`。成功に見せず、回答本文や秘密値をエラー応答に含めず、INSERTを自動再試行しない。分類は隔離DBでの故障注入で別途検証する。
7. 設計の旧例は`question/answer/created_at`と`data`を使用しているが、現行TASK-02/03の確定実装`prompt/response_text`と`items`に整合させた。POSTの送信フィールドは引き続き`question`。

### 試験予定（未実測）

| 試験ID | 期待結果 | 現状 |
| --- | --- | --- |
| TASK04-BUILD | `npm run build`が成功 | **未実施** |
| TASK04-01 | 隔離テスト用DBで有効な`question`をPOST→201、回答・ID・日時を受け取る | **未実施** |
| TASK04-02 | POSTの保存行とGET履歴・DB SELECTで質問と回答が一致し、1リクエストで1行だけ増える | **未実施** |
| TASK04-03 | 前後空白除去、Unicodeコードポイント境界（1/2000/2001）、入力型不正・空白のみを検証 | **未実施** |
| TASK04-04 | 無効入力時、模擬Service/DB INSERTは0回（スタブ・スパイ） | **未実施** |
| TASK04-05 | 停止ゲートの503、Production相当・非ローカルの模擬回答拒否 | **未実施** |
| TASK04-06 | DBの明示的INSERT拒否→500 `SAVE_FAILED`、接続断等→503 `SAVE_RESULT_UNKNOWN` | **未実施** |
| TASK04-07 | 保存失敗時の秘密情報・回答本文の非露出、AI外部通信なし | **静的確認のみ。実行時未検証** |
| TASK04-08 | TOP/TODOの一覧・登録・更新・削除、DBサンプル等の回帰 | **未実施** |

### 総合判定

**TASK-04：コード実装・GitHub反映済み、受入試験未完了。** 検証は既存データを保護する隔離DBでのみ行う。GitHub上のSQLや既存データの削除・TRUNCATE・テーブル再作成、Neonの接続資格情報変更、公開設定変更を今回の実装処理では行っていない。TASK-05の実AI接続は未着手。
