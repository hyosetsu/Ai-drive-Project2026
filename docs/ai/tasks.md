# AI質問機能 段階的実装計画（標準課題・発展課題）

- 配置先：`docs/ai/tasks.md`
- 作成日：2026-11-11
- 状態：**実装計画案（未着手）**
- 基準文書：`docs/ai/requirements.md`（2026-11-11確定版）、`docs/ai/spec.md`（2026-11-11設計確定版）
- 対象リポジトリ：`hyosetsu/Ai-drive-Project2026`（GitHub既定ブランチの確認可能なファイルを参照）
- **この文書の作成では、アプリのTypeScript・JavaScript・HTML・SQL・設定、DB、GitHub上のファイルを変更・実行しない。** 以下の「変更対象」は将来の実装で編集する予定のファイルを表す。

## 0. 計画の前提・進め方

### 0.1 確認済みの既存構成と維持対象

| 実際に確認したファイル | 現状と実装計画への影響 |
| --- | --- |
| `package.json` | `npm run dev`（`tsx watch ./index.ts`）、`npm run build`（`tsc`）、`npm start`（`node ./dist/index.js`）。Express 5系、`pg`、`dotenv`、EJS。**Gemini SDKは未導入**。|
| `tsconfig.json` | CommonJS・ES2022・`strict: true`・`outDir: ./dist`、`include: ["index.ts"]`。AIからのimportを含めてビルドで型検証する。 |
| `index.ts` | `express.urlencoded`→`express.static(public)`→既存TOP・DBサンプル→`app.use(todoRouter)`→`listen(3000)`。共通JSONパーサー・全体404・全体エラーハンドラーなし。**AI Routerは既存の本文解析より前に追加する。既存コードを移動しない**。 |
| `db.ts` | `dotenv/config`と`DATABASE_URL`を使う共有`pg.Pool`。既存DB接続を再利用し、接続情報はクライアントに出さない。`.env`は確認対象にしない。 |
| `src/apps/todo/todoRouter.ts` | TODO用JSON解析は`/api/v1/todos`限定、上限10KB。TODO専用404とエラー処理がある。AI側でこれらを変更しない。 |
| `src/apps/todo/todoController.ts`／`todoModel.ts` | 型検証・DBアクセス・パラメータ付きSQLの参考。既存の処理は改修しない。 |
| `public/todo/todo.js`、`views/todo/index.ejs`、`views/index.ejs` | 既存TODOの`textContent`による描画等を参考にする。TOP・TODOへの変更はAIへのリンク追加程度に限定。 |

**未確認・未決：** `local.ts`、`vercel.json`、`api/index.ts`は確認したGitHub既定ブランチのパスには存在しなかった。実デプロイ構成は別ブランチ・ホスティング設定も含めてTASK-12で確認する。Gemini SDK／モデル・APIキーの環境変数名・Preview保護方式・実行時間制限は、確認前に推測で固定しない。

### 0.2 共通の確定仕様（すべてのTASKの基準）

- 画面は`/ai`、静的ファイルは`public/ai/index.html`・`public/ai/app.js`（`ai.css`は必要に応じて追加）。
- `POST /api/ai/ask`は、**質問検証→Gemini単発回答取得→質問・回答1行INSERT成功後に201**。`GET /api/ai/history`は**200、0件なら`data: []`**。
- Productionおよびデモ未許可時は**質問・履歴の両APIとも503 `DEMO_DISABLED`**。デモ停止ゲートはAI解析・DB・Gemini呼出しより前に動作する。
- 質問は前後空白除去後1〜2,000 **Unicodeコードポイント**。JSON本文の受信上限は16,384**バイト**。API上の履歴は最新20件、`created_at DESC, id DESC`。
- AI SDKの自動再試行、ブラウザの自動再送は行わない。過去履歴をGeminiへの会話文脈に含めない。質問・回答・エラー・requestIdをHTMLとして描画しない。
- HTTPステータス・公開エラーコード・基本レスポンス形は`spec.md` §4.3の**採用済み設計**に従う。参考期限（AI30秒、ブラウザ45秒）は**未確定**。
- シークレットの**環境変数名だけ**を確認し、値を表示・文書化・Git管理しない。`DATABASE_URL`は既存利用名。Geminiキー名（`GEMINI_API_KEY`など）はOPEN-AI-01で確定。

### 0.3 進行ルール・受入記録

1. **TASK-01→TASK-12を順番に実施**する。各TASKの「次へ進む条件」を満たすまでは次の実装へ進まない。関連する細分化テストIDは`TEST-AI-*`、作業IDは`TASK-*`と区別する。
2. 各TASKで**事前状態／変更内容／実行コマンド／期待値／実測値／合否／実施日時／未解決問題**を`docs/ai/04_test_results.md`へ記録する。必要なら`docs/ai/ai-log.md`へ採用判断を追記する。
3. 標準課題の進行中は、発展課題の実装を混在させない。模擬回答は**試験用差し替え**であり、Productionに残さない。
4. ローカルの`AI_DEMO_ENABLED`等の値は安全なテスト環境でのみ調整する。**Previewは実際の保護確認を完了するまで有効化しない**。Productionを許可フラグで上書きしない。
5. 失敗・境界試験でGemini・DBを呼んでいないと確認する場面では**スタブ／スパイの呼出回数**を使う。SQLSTATE別の故障注入は**隔離した試験専用DB**で行う。
6. 初回から`npm run build`を繰り返し実施し、追加したAI関連ファイルが型検査から漏れていないことを確認する。

### 0.4 授業時間内の優先度

**標準課題（必須）**：TASK-01〜TASK-12。授業内でまず完成させる中心は**TASK-01〜TASK-11（ローカル動作・正常／異常系・回帰）**。TASK-12のPreview／Production制御は**公開・提出前に必須**だが、ホスティング環境を利用できない場合は合格とせず「未実施・環境依存」と記録する。短時間では、各TASKの最小受入条件に集中する。

**発展課題（後回し）**：章4のEXT-*。これらは標準課題の受入条件を満たすための前提にはしない。OPEN-AI-04等の未決事項を勝手に発展課題で確定しない。

## 1. 作業一覧（指定順）

| 作業ID | 段階 | 区分 | 対応REQ | 対応DES | 主な変更対象ファイル | 次へ進む条件（要約） |
| --- | --- | --- | --- | --- | --- | --- |
| **TASK-01** | ①共通準備 | 標準 | F011,F012,N001,N002,N004,N005,N006 | 001,002,006,007,009 | `index.ts`, `src/apps/ai/aiRouter.ts`, `aiMiddleware.ts`, `aiError.ts` | **デモ無効で両API503**・Gemini/DB 0回、既存TOP/TODO正常 |
| **TASK-02** | ②DB | 標準 | D001,D002,D003,D005,N005 | 002,005 | `sql/ai/030_create_ai_qa_logs.sql`, `src/apps/ai/aiModel.ts` | 試験用DBに表・制約・索引ができ、既存表に影響なし |
| **TASK-03** | ③履歴API | 標準 | F007,F008,F009,D002,D003,D004,N001 | 001,002,004,005,006 | `aiRouter.ts`, `aiController.ts`, `aiModel.ts` | 許可したローカルで履歴200/空配列、21件でも最新20件 |
| **TASK-04** | ④模擬回答の保存 | 標準 | F002,F003,F005,F009,D001,D005,D006,N003 | 001,002,004,005,006,008 | `aiController.ts`, `aiService.ts`, `aiModel.ts`, `aiRouter.ts` | **外部AIを呼ばず**疑似回答を1行保存、201と履歴照会が一致 |
| **TASK-05** | ⑤実AI | 標準 | F004,F005,F010,D006,N002,N007 | 001,002,004,007,008 | `package.json`, `package-lock.json`（生成される場合）, `aiService.ts`, `aiController.ts` | 有効質問をGeminiへ1回送り、保存成功後だけ201 |
| **TASK-06** | ⑥履歴UI | 標準 | F007,F008,F009,D003,D004,N002 | 002,003,004,007 | `public/ai/index.html`, `public/ai/app.js`, `public/ai/ai.css`（任意）, `index.ts` | `/ai`初期表示で履歴、空配列は「履歴なし」、取得失敗はエラー |
| **TASK-07** | ⑦送信UI | 標準 | F001,F002,F003,F006,F009,F010,F012 | 001,002,003,004,007,008 | `public/ai/app.js`, `index.html`, `ai.css`（任意）, `views/index.ejs`, `views/todo/index.ejs` | 画面遷移なしで201表示、待機中の連打抑止、安全描画・失敗後復帰 |
| **TASK-08** | ⑧異常系：入力／JSON／画面 | 標準 | F003,F009,N002,N003,N004 | 003,004,006,007,010 | `aiRouter.ts`, `aiController.ts`, `aiError.ts`, `app.js` | 400/413/415/422、0回呼出、XSS・秘密値試験に合格 |
| **TASK-09** | ⑧異常系：外部AI／DB／期限 | 標準 | F005,F009,F010,D005,N007,N008 | 004,005,007,008,010 | `aiService.ts`, `aiController.ts`, `aiModel.ts`, `aiError.ts` | 502/504/500/503を分類、保存失敗確定と結果不明を別試験で検証 |
| **TASK-10** | ⑧異常系：履歴／既存回帰 | 標準 | F007,F008,F009,F012,N004,N005,N008 | 003,004,006,007,010 | `aiController.ts`, `app.js`, `docs/ai/04_test_results.md` | DB障害が0件表示にならず、TOP/TODO/DBサンプルが従来動作 |
| **TASK-11** | ⑧異常系：通し検証・記録 | 標準 | F001〜F012,N001〜N008,D001〜D006 | 001〜010 | `docs/ai/04_test_results.md`, `docs/ai/ai-log.md`（必要時） | 全26要件に試験ID・期待／実結果、未実施項目と理由が記録される |
| **TASK-12** | ⑨Preview確認・提出 | 標準（公開前必須） | F011,F012,N002,N005,N006,N007,N008 | 006,007,008,009,010 | `docs/ai/04_test_results.md`, `docs/ai/ai-log.md`; ホスティング設定は決定後 | 未認証の両API拒否・Production両API503・既存正常を実環境で確認 |

※ 一覧の`Fxxx/Nxxx/Dxxx`はそれぞれ`REQ-AI-Fxxx/Nxxx/Dxxx`、`001〜010`は`DES-AI-001〜010`を省略表示したもの。以下では正式IDを明記する。**この一覧の変更対象は予定であり、まだ編集していない。**

## 2. 各作業の詳細

### TASK-01 共通ひな型・デモ停止ゲート

- **区分／対応**：標準／`REQ-AI-F011,F012,N001,N002,N004,N005,N006`／`DES-AI-001,002,006,007,009`
- **変更対象**：`index.ts`、新規`src/apps/ai/aiRouter.ts`・`aiMiddleware.ts`・`aiError.ts`。`docs/ai/04_test_results.md`は記録用に後続で作成可。
- **作業内容**：`index.ts`の`express.urlencoded`と`express.static`より**前**に`app.use('/api/ai', aiRouter)`を追加。AI Router内ではrequestIdと`no-store`→デモゲート→Content-Encoding検査→POST限定のContent-Type検査→16KiB JSON解析→API→AI専用404→AI専用最終エラー処理の順とする。最初の段階ではask/historyの本処理を作らず、**停止環境でゲートの503を確認する**。Productionでは明示的な許可設定があっても必ず拒否する。ローカル許可状態での未実装APIは**暫定404**でよい。共通404・全体エラーハンドラーを追加しない。
- **確認方法**：`npm run dev`、`npm run build`。デモ無効・Production相当でPOST `/api/ai/ask`、GET `/api/ai/history`、未知AI URL、不正JSON、urlencodedを試し、503 `DEMO_DISABLED`、AI/DB呼出0回。`/`・`/todo`・既存TODO APIを表示・呼出し、変更前と比較。APIキーがなくてもデモ停止時にアプリが起動できることを確かめる。
- **期待結果／次へ進む条件**：両APIが安全な503 JSON、本文解析前に拒否、キー値やスタックを返さない。TOP/TODO正常。既存TODO用10KBパーサーが維持される。**この条件を満たしたらTASK-02**。

### TASK-02 DBテーブル・制約・モデルの土台

- **区分／対応**：標準／`REQ-AI-D001,D002,D003,D005,N005`／`DES-AI-002,005`
- **変更対象**：新規`sql/ai/030_create_ai_qa_logs.sql`、新規`src/apps/ai/aiModel.ts`。既存`db.ts`とTODOのSQLは原則変更しない。
- **作業内容**：設計書§5.2の`ai_qa_logs`（`id` BIGINT IDENTITY PK、`question` TEXT、`answer` TEXT、`created_at` TIMESTAMPTZ）および`created_at DESC,id DESC`の索引をSQL化。質問・回答は同一1行INSERTし、`$1,$2`でバインドするModelインターフェースを用意する。最新20件SELECTのSQL形も用意する。DBのCHECKはアプリ入力検証の**追加防御層**。隔離DBに適用する前にテーブル有無・既存データを照会し、必要な場合だけ実行する。
- **確認方法**：SQLのレビュー→テストDBでCREATE→テーブル定義・PK・CHECK・索引を照会。`question`空／2001字、`answer`空などの制約拒否を確認し、既存`todo_tasks`・`products`を変更していないか確認。`npm run build`。
- **期待結果／次へ進む条件**：指定4列と制約・索引が存在し、既存テーブルを破壊しない。Modelは共有Poolを利用し、SQL文字列への入力連結がない。**TASK-03へ**。

### TASK-03 履歴取得API（AI生成に先行）

- **区分／対応**：標準／`REQ-AI-F007,F008,F009,D002,D003,D004,N001`／`DES-AI-001,002,004,005,006`
- **変更対象**：`src/apps/ai/aiRouter.ts`・`aiController.ts`（新規）・`aiModel.ts`。
- **作業内容**：ローカルの許可状態で`GET /api/ai/history`を登録し、`SELECT ... ORDER BY created_at DESC,id DESC LIMIT 20`の結果を`{success:true,data:[...]}`で200返却。0件は`[]`、DB失敗は`HISTORY_UNAVAILABLE`（500/503、設計書の原因分類）。`id`はJSONで10進文字列、`created_at`はISO 8601。初期データの準備・削除はテストDBだけで実施する。
- **確認方法**：0件→200/`[]`、1件→200/1件、21件以上・同日時→最新20件とID降順、DB接続エラー→非200かつ非空成功ではないこと。停止中は処理前503、SELECTスタブ呼出0回。`npm run build`。
- **期待結果／次へ進む条件**：履歴0件／正常件数／障害を明確に区別し、順序が安定。**TASK-04へ**。

### TASK-04 模擬回答で質問・回答を保存（外部AI呼出なし）

- **区分／対応**：標準／`REQ-AI-F002,F003,F005,F009,D001,D005,D006,N003`／`DES-AI-001,002,004,005,006,008`
- **変更対象**：新規`src/apps/ai/aiService.ts`、`aiController.ts`・`aiRouter.ts`・`aiModel.ts`。
- **作業内容**：`POST /api/ai/ask`を実装するが、**テスト限定の模擬回答Service**で回答を返しGeminiへは接続しない。Controllerは型・trim・Unicodeコードポイント長を検証後、模擬Service→Model INSERT→201を順に実行する。検証前にAIやDBは呼ばない。保存失敗時に201や回答全文を返さない。試験用の差し替えは安全な注入点を用い、公開環境で模擬回答に切り替え可能な抜け道を残さない。
- **確認方法**：有効な質問をPOST→201の`id/question/answer/created_at`→履歴GETおよびDB SELECTで同じ質問・回答が1行。前後空白除去を確認。質問0件相当・2001コードポイント・型不正でGeminiスタブ/DB呼出0回。外部通信が生じていないことを確認。
- **期待結果／次へ進む条件**：**Gemini API未接続でも**POST→INSERT→201→履歴GETの流れが完成し、失敗時に部分保存がない。**TASK-05へ**。

### TASK-05 実際のGemini API接続

- **区分／対応**：標準／`REQ-AI-F004,F005,F010,D006,N002,N007`／`DES-AI-001,002,004,007,008`
- **変更対象**：`package.json`とロックファイル（SDK追加が必要な場合）、`src/apps/ai/aiService.ts`・`aiController.ts`。環境変数の**値**はドキュメント・コードへ記載しない。
- **作業内容**：OPEN-AI-01に従い**Gemini提供元は確定**、SDK・モデルID・環境変数名・固定プロンプトの有無を検証して記録。SDKは**ゲート通過後の初回呼出時に遅延初期化**し、最大再試行0を実際のSDKの設定で保証する。Geminiへ渡すユーザー質問は**今回分のみ**。トリム後空白だけのAI回答は502`AI_UNAVAILABLE`としてINSERTしない。参考AI30秒はSDK/ホスティング条件を確認し、採用前に実測する。
- **確認方法**：ローカル許可状態で短い質問をPOST→Geminiを1回呼び→INSERTが完了して初めて201。履歴GETで回答保存。既存履歴を用意し、Geminiスタブで過去質問・回答が送られないことを検証。Production停止相当でキー未設定でも起動し、Gemini初期化・呼出0回。失敗時の自動再試行なし。
- **期待結果／次へ進む条件**：実AIとDBの正常な連携が成立し、秘密値非露出・1操作あたりのSDKリクエスト1回（スタブで検証）。**TASK-06へ**。

### TASK-06 履歴UI（先に初期履歴・0件を完成）

- **区分／対応**：標準／`REQ-AI-F007,F008,F009,D003,D004,N002`／`DES-AI-002,003,004,007`
- **変更対象**：新規`public/ai/index.html`・`public/ai/app.js`、必要なら`public/ai/ai.css`、`index.ts`の明示的な`GET /ai`。
- **作業内容**：`GET /ai`は既存`express.static`より前にHTMLを送る（設計書採用方式）。静的JS/CSSは`/ai/app.js`等の**絶対パス**。初期表示時の履歴GETは1回、読み込み状態・履歴0件・成功・失敗・手動再取得を区別。**200、`body.success === true`、`Array.isArray(body.data)`の場合だけ履歴表示**し、長さ0で初めて「履歴なし」。HTMLログイン画面、非JSON、`data`欠落、502、停止503は失敗／利用不可にする。`id`をNumberに変換しない。
- **確認方法**：ブラウザを再読込して履歴が残る、0件なら「履歴なし」、非JSON/不正JSON/503なら「履歴なし」に見えない。質問・回答をHTML風文字列にしてもDOMで実行されない。`/ai`と`/ai/`・JS/CSSの取得を確認。
- **期待結果／次へ進む条件**：履歴を安全なテキストで表示し、0件と障害を誤判定しない。**TASK-07へ**。

### TASK-07 送信UI・待機・安全描画

- **区分／対応**：標準／`REQ-AI-F001,F002,F003,F006,F009,F010,F012`／`DES-AI-001,002,003,004,007,008`
- **変更対象**：`public/ai/index.html`・`app.js`・任意の`ai.css`、`views/index.ejs`・`views/todo/index.ejs`（AI画面へのリンク追加のみ）。
- **作業内容**：フォーム送信を`preventDefault()`して画面遷移なしでPOST。送信中は状態表示、ボタン無効化・内部送信中フラグで連打抑止。201後は回答を平文で表示し履歴を**1回**再取得。失敗・ブラウザ期限ではボタンを復帰させ、**自動再送せず**手動での履歴確認を案内。`SAVE_RESULT_UNKNOWN`は「保存結果を確認できませんでした。再送前に履歴をご確認ください」。質問・回答・履歴・エラー文・requestIdは`textContent`またはテキストノード。OPEN-AI-04の入力保持・待機終了後再送判断を送信UI着手前に決定してログに記録。
- **確認方法**：有効質問で画面遷移なし→201回答→再取得。連続クリックでPOST1回、失敗後ボタン再有効化。`<img onerror=...>`等の文字列が実行されない。AIが遅い場合とブラウザ待機終了時も自動再送0回。TOP/TODO→`/ai`移動・戻りを確認。
- **期待結果／次へ進む条件**：入力→送信中→回答→履歴再取得、失敗復帰の状態遷移が成立し既存フォームは不変。**TASK-08へ**。

### TASK-08 異常系①：JSON・入力境界・秘密値・XSS

- **区分／対応**：標準／`REQ-AI-F003,F009,N002,N003,N004`／`DES-AI-003,004,006,007,010`
- **変更対象**：`src/apps/ai/aiRouter.ts`・`aiController.ts`・`aiError.ts`、`public/ai/app.js`（必要な不備修正）、`docs/ai/04_test_results.md`。
- **作業内容**：設計§4.3/4.4を固定期待値として境界試験を行う。本文が空→400`INVALID_BODY`、`null`/`"text"`→400`INVALID_JSON`、`[]`/`{}`/`{"question":123}`→400`INVALID_BODY`、不正JSON→400`INVALID_JSON`、本文16,385B→413`REQUEST_TOO_LARGE`、圧縮Content-Encoding→415`UNSUPPORTED_CONTENT_ENCODING`、質問0/2,001cp→422`VALIDATION_ERROR`。Unicode絵文字の1,500／2,000／2,001cpを**生UTF-8 JSON**で検証。正常本文16,384Bを通す。拒否時のGemini/DB呼出0回を確認。
- **確認方法**：PowerShellやHTTPクライアントで**送信したバイト列を確実に把握**して試験。16KiBは有効質問の前後半角空白で調整。`TEST-SENTINEL`等の**無害なテスト識別子**のHTML・JS・API全応答・限定ログでの露出0件。`app.js`の危険なHTML挿入API使用0件（静的検査）、HTML風文字列を含む画面試験。ログへAPIキー・回答全文を残さない。
- **期待結果／次へ進む条件**：仕様通りのHTTP/コードと0回呼出。XSS・秘密値の漏えいなし。TODOの10KB+1拒否（既存400）も維持。**TASK-09へ**。

### TASK-09 異常系②：Gemini障害・保存失敗確定／結果不明・タイムアウト

- **区分／対応**：標準／`REQ-AI-F005,F009,F010,D005,N007,N008`／`DES-AI-004,005,007,008,010`
- **変更対象**：`aiService.ts`・`aiController.ts`・`aiModel.ts`・`aiError.ts`（不備があれば修正）、`docs/ai/04_test_results.md`。
- **作業内容**：AI未応答→502`AI_UNAVAILABLE`、AI期限超過→504`AI_TIMEOUT`、DB INSERTに対する明示的なSQLSTATE許可リスト（22/23/42/P0）→500`SAVE_FAILED`、それ以外・接続断など→503`SAVE_RESULT_UNKNOWN`。`HISTORY_UNAVAILABLE`とは区別する。**INSERTの自動再試行は禁止**。DB状態が不明でも未保存とは表示しない。参考30/45秒とホスティング実期限の差を記録。
- **確認方法**：`TEST-AI-D005-01`＝隔離DBの42501/P0001（SQLSTATEの実挙動確認）、`TEST-AI-D005-02a`＝送信前遮断、`TEST-AI-D005-02b`＝送信後応答喪失（可能なら故障注入プロキシ、難しければスタブと実DB試験を別記）、`TEST-AI-N007-02`＝INSERT成功後のHTTP応答未達。回復後に別接続で一意なテスト質問を照会し、保存有無・重複数を記録。AI回答全文がエラー応答／ログに含まれないことを検証。通信エラー後の自動再試行0回。
- **期待結果／次へ進む条件**：確定失敗／結果不明／成功後応答未達を**異なるテストID**で判定でき、確定失敗では対応レコードなし・部分行なし。不明ケースでは断定せず履歴確認へ導く。実障害を再現できない試験は「未実施」を明示。**TASK-10へ**。

### TASK-10 異常系③：履歴障害と既存機能の回帰

- **区分／対応**：標準／`REQ-AI-F007,F008,F009,F012,N004,N005,N008`／`DES-AI-003,004,006,007,010`
- **変更対象**：`aiController.ts`・`public/ai/app.js`（必要な不備修正）、`docs/ai/04_test_results.md`。
- **作業内容**：履歴SELECT失敗は500/503`HISTORY_UNAVAILABLE`、空配列成功とは区別。履歴HTML/非JSON/不正`data`をフロントで失敗表示。既存Expressの404・例外動作を変更しない。安全なダミー識別値で既存DBサンプルのHTTP応答も点検する。
- **確認方法**：履歴DB停止・非JSON応答・成功形欠落などをスタブで再現し、0件にならないことを検証。`/`、`/todo`、TODO GET/POST/PATCH/DELETE、TODOの不正JSON・10KB+1、未知TODO APIの404、未知の一般URL404、`/api/db-check`、`/db-sample`、登録・削除（安全なテストデータのみ）を変更前と比較。AIエラー後も同じ結果となることを確認。
- **期待結果／次へ進む条件**：履歴障害はエラー表示、既存機能・既存エラー応答に回帰なし。**TASK-11へ**。

### TASK-11 標準課題の通し検証・証跡の確定

- **区分／対応**：標準／`REQ-AI-F001〜F012,N001〜N008,D001〜D006`（全26件）／`DES-AI-001〜010`（全10件）
- **変更対象**：新規`docs/ai/04_test_results.md`、判断変更があれば`docs/ai/ai-log.md`。アプリの不具合修正が必要な場合は**該当TASKに戻って修正**し再試験。
- **作業内容**：`spec.md`§10の全26要件と`TEST-AI-F001〜F012`／`N001〜N008`／`D001〜D006`を対応させる。枝番テスト（JSON形状、D005障害、N006保護等）を整理し、**未実施・ブロック・不合格を合格にしない**。授業提出に必要な起動・環境変数名・API・注意点を記載する。Preview未実施はTASK-12のゲートとして残す。
- **確認方法**：`npm run build`、ローカルで正常系と主要異常系の再実行、IDの重複・欠番・試験証跡を照合。秘密値をテスト記録に記載しない。
- **期待結果／次へ進む条件**：全REQ/DESの確認計画と結果・未実施理由が追跡可能。**ローカル標準課題を完了した状態でTASK-12へ**（Preview完了はまだ主張しない）。

### TASK-12 保護済みPreview・Production停止・提出

- **区分／対応**：標準（公開前必須）／`REQ-AI-F011,F012,N002,N005,N006,N007,N008`／`DES-AI-006,007,008,009,010`
- **変更対象**：`docs/ai/04_test_results.md`・`ai-log.md`。デプロイ設定ファイルは**採用ホスティング方式を確認した場合のみ**必要箇所を特定・変更（現時点で`vercel.json`等の存在を前提としない）。
- **作業内容**：実デプロイの起動入口・ビルド・期限・環境変数**名**・認証方式・すべての公開URLを確認。ホスティング側で保護設定を実際に有効化してからだけPreviewデモを許可。Productionは必ず質問・履歴とも503、Gemini/DB呼出0回。デプロイ設定だけで完了とせず、無権限の別ブラウザ／HTTPクライアントから質問・履歴の両APIを試験する。API乱用・費用対策（OPEN-AI-08）を公開前に決定またはリスク記録。
- **確認方法**：`TEST-AI-N006-01`：未認証POSTが201にならずGemini・INSERT 0回。`TEST-AI-N006-02`：未認証GETが履歴200にならず、応答本文・リダイレクト・キャッシュに共有履歴が漏れない。全到達URLと別名URLで実施。認証済みPreviewのみ両API動作。Productionは許可フラグにかかわらず両API503`DEMO_DISABLED`。既存`/`・`/todo`の回帰。証跡は秘密値を除いて保存。
- **期待結果／次へ進む条件**：保護済みPreviewでのみデモ可能、未認証者は質問も履歴も利用不可、Production両API停止、既存正常。**保護方式未決・いずれか未試験・漏えいの疑いがある場合はfail-closedで公開デモ不可**。最終試験結果・未決リスクを記録して提出。

## 3. 確認用の共通API・エラー期待値

| 対象 | 条件 | 期待HTTP | 公開コード／データ |
| --- | --- | --- | --- |
| POST `/api/ai/ask` | AI取得とDB保存成功 | 201 | `success:true`＋保存済み`data` |
| GET `/api/ai/history` | 0件 | 200 | `success:true,data:[]` |
| GET `/api/ai/history` | 21件以上 | 200 | 最新20件、降順 |
| 両API | デモ停止 | 503 | `DEMO_DISABLED`、AI/DB 0回 |
| POST | 不正JSON／JSONトップレベル文字列等 | 400 | `INVALID_JSON` |
| POST | 空本文／本文配列／質問型不正 | 400 | `INVALID_BODY` |
| POST | JSON本文16,385バイト | 413 | `REQUEST_TOO_LARGE` |
| POST | 非対応Content-Encoding | 415 | `UNSUPPORTED_CONTENT_ENCODING` |
| POST | 質問0／2,001コードポイント | 422 | `VALIDATION_ERROR` |
| POST | Gemini到達・応答異常 | 502 | `AI_UNAVAILABLE` |
| POST | Geminiタイムアウト | 504 | `AI_TIMEOUT` |
| POST | INSERT確定拒否（許可リスト） | 500 | `SAVE_FAILED` |
| POST | INSERT結果不明 | 503 | `SAVE_RESULT_UNKNOWN` |
| GET | 履歴SELECT失敗 | 500/503（原因別） | `HISTORY_UNAVAILABLE` |
| AI未定義URL | デモ許可時 | 404 | `NOT_FOUND`（停止時は503） |

**F009の7区分との対応**：入力不正＝`INVALID_BODY/INVALID_JSON/VALIDATION_ERROR/UNSUPPORTED_CONTENT_ENCODING`、JSON超過＝`REQUEST_TOO_LARGE`、AI障害＝`AI_UNAVAILABLE`、期限＝`AI_TIMEOUT`＋ブラウザ待機終了、DB保存障害＝`SAVE_FAILED/SAVE_RESULT_UNKNOWN`、履歴障害＝`HISTORY_UNAVAILABLE`、停止＝`DEMO_DISABLED`。ただし`SAVE_RESULT_UNKNOWN`は**保存失敗確定ではない**ため画面文言を区別する。

## 4. 発展課題（標準課題完了後・現段階では実装しない）

| 発展ID | 候補機能・改善 | 関係する未決事項 | 標準課題からの分離・導入条件 |
| --- | --- | --- | --- |
| `EXT-AI-01` | 再送時の冪等性キーによる重複保存防止 | OPEN-AI-04/07 | 採用する場合はリクエストIDとDB一意制約を別設計。現行標準の1行INSERTを無断変更しない。 |
| `EXT-AI-02` | 履歴のページング・検索・件数指定 | OPEN-AI-03 | 現行の`GET history`最新20件を維持し、別APIまたは後方互換設計を先に承認。 |
| `EXT-AI-03` | 履歴の保持期限・一括削除・自動クリーンアップ | OPEN-AI-03 | デモの共有データの保管方針を決め、破壊的DB変更は別審査。保存期間の決定そのものは公開前の運用課題。 |
| `EXT-AI-04` | ユーザー認証・ユーザー別履歴 | 標準対象外 | 現行のログイン不要・共有履歴仕様からの大幅変更として独立要件化。 |
| `EXT-AI-05` | Markdown表示・ストリーミング／会話履歴連携 | 標準対象外 | XSS・複数リクエスト・会話文脈の設計を別途実施。現行標準はプレーンテキスト・単発質問。 |
| `EXT-AI-06` | 管理用のコスト可視化・利用統計ダッシュボード | OPEN-AI-08 | 乱用防止・費用上限の**必要最低限の判断は公開前標準**で行い、ダッシュボード自体を発展課題とする。 |
| `EXT-AI-07` | 自動テストCI・負荷試験・高度な監視 | N008の拡張 | 標準の手動・スタブ・故障注入の合否を取得してから追加。秘密値をCIログに出さない。 |

## 5. 未決事項の決定ゲート（要件・設計のIDを維持）

| OPEN-ID | 決定・確認する内容 | 必要となる時点 | 未決のままの扱い |
| --- | --- | --- | --- |
| OPEN-AI-01 | GeminiのSDK、モデル、APIキー環境変数**名**、固定プロンプトの有無 | **TASK-05着手前** | 実AIへ接続せず模擬回答までで停止 |
| OPEN-AI-02 | `/ai`・静的HTML/JSは確定。TOP/TODOのリンクの見た目 | TASK-06〜07 | 機能を優先し単純リンクで実装可能。既存画面破壊は禁止 |
| OPEN-AI-03 | DB保持期間・削除方針・共有履歴の管理 | TASK-02で最低限の前提を整理し**TASK-12公開前に決定** | 最新20件取得だけ実装。削除処理を勝手に足さない |
| OPEN-AI-04 | HTTP仕様は確定済み。入力保持・待機終了後の手動再送と重複への扱い | **TASK-07着手前** | 自動再試行を追加せず、結果不明の注意文を優先 |
| OPEN-AI-05 | AI30秒／ブラウザ45秒を最終採用するか | TASK-05、07で仮動作、TASK-09/12で実測・確定 | 参考値を最終設定と呼ばない |
| OPEN-AI-06 | Production両API停止は確定。Preview保護方式・許可判定・全URL検査 | **TASK-12でデモ有効化する前** | Previewはゲートを閉じたまま、公開デモ不可 |
| OPEN-AI-07 | SQLSTATEの実ドライバ挙動、保存結果不明、事後照会・重複の扱い | TASK-04で方針確認、**TASK-09で故障注入** | 自動再試行や失敗断定をしない。未再現は未実施と明記 |
| OPEN-AI-08 | API乱用・費用上限の要否と方法／残余リスク | **TASK-12公開前** | 無制限公開しない |
| OPEN-AI-09 | U+200B等の空白集合 | **TASK-04の入力検証着手前** | 未決を黙って受入条件へ書き換えない |

## 6. 最終チェック（実装開始前に使用）

- [ ] `requirements.md`全26件・`spec.md`全10設計ID・本計画TASK-01〜12の対応を確認した
- [ ] TODO（10KB JSON解析）・TOP・DBサンプル・既存404の**変更前の期待動作**を記録した
- [ ] テスト用DBとシークレット非露出の記録方式を用意した（`.env`を文書に添付しない）
- [ ] TASK-01の**両API停止503**を最初の安全基準に設定した
- [ ] 実AI接続・Preview公開に関する未決事項の**決定期限**を担当者と共有した
- [ ] 授業標準課題と発展課題を別管理し、現段階でコードを変更していない

---

**本書は実装順と合格条件を定める計画書であり、実装・SQL実行・外部AI通信・Previewデプロイ・試験実施の記録ではない。**
