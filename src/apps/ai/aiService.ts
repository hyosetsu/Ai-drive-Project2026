/**
 * TASK-04: ローカル検証専用の固定模擬回答。
 * TASK-05ではこの関数を本物のAI Serviceに置き換える。
 * SDKの初期化、外部HTTP通信、DBアクセスは行わない。
 */
export function generateMockAnswer(_question: string): string {
  return '【TASK-04 模擬回答】これはテスト用の固定回答です。Gemini APIには接続していません。';
}
