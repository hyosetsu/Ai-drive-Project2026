/**
 * TASK-05: Gemini single-request service.
 * No SDK load, client creation, or API access occurs until this function is called.
 * Only the current validated question is sent; stored history is never sent.
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 30_000; // provisional; verify with the deployment runtime in TASK-09

export class AiGenerationError extends Error {
  constructor(public readonly kind: 'unavailable' | 'timeout') {
    super(kind);
    this.name = 'AiGenerationError';
  }
}

export async function generateAiAnswer(question: string): Promise<string> {
  // Never instantiate with an undefined key: it may cause the SDK to pick up
  // alternate environment credentials unexpectedly.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new AiGenerationError('unavailable');
  }

  try {
    // Dynamic import is deliberately inside the service call. The disabled
    // gate and invalid input must never load the SDK or call Gemini.
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: GEMINI_TIMEOUT_MS,
        retryOptions: { attempts: 1 }, // includes the first attempt: zero retries
      },
    });

    const result = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: question,
      config: {
        automaticContinuation: false, // no implicit follow-up network requests
      },
    });

    const answer = typeof result.text === 'string' ? result.text.trim() : '';
    if (!answer) throw new AiGenerationError('unavailable');
    return answer;
  } catch (error: unknown) {
    if (error instanceof AiGenerationError) throw error;

    // Only the classification leaves the Service; raw SDK errors (which may
    // contain request data or credentials) are never logged or returned.
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status : undefined;
    const name = typeof error === 'object' && error !== null && 'name' in error
      ? (error as { name?: unknown }).name : undefined;
    if (status === 408 || status === 504 || name === 'AbortError' || name === 'TimeoutError') {
      throw new AiGenerationError('timeout');
    }
    throw new AiGenerationError('unavailable');
  }
}
