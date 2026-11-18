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
