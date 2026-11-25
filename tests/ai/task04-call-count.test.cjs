'use strict';

// TASK-05 isolated call-count regression tests: no Neon connection or Gemini SDK.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

const srcDir = path.resolve(__dirname, '../../src/apps/ai');
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  AI_DEMO_ENABLED: process.env.AI_DEMO_ENABLED,
  VERCEL_ENV: process.env.VERCEL_ENV,
};
process.env.NODE_ENV = 'development';
process.env.AI_DEMO_ENABLED = 'true';
delete process.env.VERCEL_ENV;

function loadTs(filename, imports) {
  const source = fs.readFileSync(path.join(srcDir, filename), 'utf8');
  const javascript = transformSync(source, {
    loader: 'ts',
    format: 'cjs',
    target: 'es2022',
    sourcefile: filename,
  }).code;
  const module = { exports: {} };
  vm.runInNewContext(
    '(function(require, module, exports, process) {\n' + javascript + '\n})',
    { },
    { filename },
  )((name) => {
    if (!Object.hasOwn(imports, name)) {
      throw new Error('Unexpected import in isolated test: ' + name);
    }
    return imports[name];
  }, module, module.exports, process);
  return module.exports;
}

function response() {
  return {
    statusCode: 200,
    payload: undefined,
    locals: { requestId: 'test-request-id' },
    status(n) { this.statusCode = n; return this; },
    json(body) { this.payload = body; return this; },
  };
}

function setup() {
  const calls = { service: 0, insert: 0, select: 0 };
  const values = [];
  let serviceFailure = null;
  const fakeModel = {
    selectLatestAiHistory: async () => { calls.select++; return []; },
    insertAiHistory: async (prompt, answer) => {
      calls.insert++;
      values.push({ prompt, answer });
      return { id: '101', prompt, response: answer, createdAt: '2026-11-25T00:00:00.000Z' };
    },
  };
  const sendAiError = (res, status, code, message) => {
    res.status(status).json({
      success: false, error: { code, message, requestId: res.locals.requestId },
    });
  };
  class AiGenerationError extends Error { constructor(kind) { super(kind); this.kind = kind; } }
  const fakeService = {
    AiGenerationError,
    generateAiAnswer: async (_question) => {
      calls.service++;
      if (serviceFailure) throw serviceFailure;
      return 'スタブ回答';
    },
  };
  const controller = loadTs('aiController.ts', {
    './aiModel': fakeModel,
    './aiError': { sendAiError },
    './aiService': fakeService,
  });
  const middleware = loadTs('aiMiddleware.ts', {
    crypto: require('node:crypto'),
    './aiError': { sendAiError },
  });
  const request = (body) => ({ body, socket: { remoteAddress: '127.0.0.1' } });
  return { calls, values, controller, middleware, request, failGemini: (error) => { serviceFailure = error; }, AiGenerationError };
}

test.after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('valid input calls Gemini service and INSERT once, no SELECT, responds 201', async () => {
  const { calls, values, controller, request } = setup();
  const res = response();
  await controller.askAi(request({ question: '  TASK04_SPY  ' }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.success, true);
  assert.deepEqual(calls, { service: 1, insert: 1, select: 0 });
  assert.equal(values[0].prompt, 'TASK04_SPY');
  assert.equal(values[0].answer, res.payload.data.response);
});

for (const [label, question, expectedStatus] of [
  ['empty', '', 422],
  ['whitespace', '   ', 422],
  ['2001 code points', '😀'.repeat(2001), 422],
  ['wrong type', 123, 400],
  ['missing field', undefined, 400],
]) {
  test('invalid input ' + label + ': no service or DB calls', async () => {
    const { calls, controller, request } = setup();
    const res = response();
    await controller.askAi(request({ question }), res);
    assert.equal(res.statusCode, expectedStatus);
    assert.deepEqual(calls, { service: 0, insert: 0, select: 0 });
  });
}

test('disabled gate blocks handler before service or DB call', async () => {
  const { calls, controller, middleware, request } = setup();
  const res = response();
  process.env.AI_DEMO_ENABLED = 'false';
  try {
    let passed = false;
    middleware.aiDemoGate(request({ question: 'test' }), res, () => { passed = true; });
    if (passed) await controller.askAi(request({ question: 'test' }), res);
    assert.equal(passed, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.payload.error.code, 'DEMO_DISABLED');
    assert.deepEqual(calls, { service: 0, insert: 0, select: 0 });
  } finally {
    process.env.AI_DEMO_ENABLED = 'true';
  }
});

test('Gemini service sets one attempt, disables continuation, and lazily imports SDK', () => {
  const source = fs.readFileSync(path.join(srcDir, 'aiService.ts'), 'utf8');
  assert.match(source, /retryOptions:\s*\{\s*attempts:\s*1\s*\}/);
  assert.match(source, /automaticContinuation:\s*false/);
  assert.match(source, /await import\('@google\/genai'\)/);
});

test('Gemini failure sends 502 and does not INSERT', async () => {
  const { calls, controller, request, failGemini, AiGenerationError } = setup();
  failGemini(new AiGenerationError('unavailable'));
  const res = response();
  await controller.askAi(request({ question: 'test' }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.payload.error.code, 'AI_UNAVAILABLE');
  assert.deepEqual(calls, { service: 1, insert: 0, select: 0 });
});

test('Gemini timeout sends 504 and does not INSERT', async () => {
  const { calls, controller, request, failGemini, AiGenerationError } = setup();
  failGemini(new AiGenerationError('timeout'));
  const res = response();
  await controller.askAi(request({ question: 'test' }), res);
  assert.equal(res.statusCode, 504);
  assert.equal(res.payload.error.code, 'AI_TIMEOUT');
  assert.deepEqual(calls, { service: 1, insert: 0, select: 0 });
});
