'use strict';

// TASK-08: isolated HTTP boundary tests. No Gemini API or Neon connection.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const express = require('express');

const srcDir = path.resolve(__dirname, '../../src/apps/ai');
const initialEnv = Object.fromEntries(
  ['NODE_ENV', 'AI_DEMO_ENABLED', 'VERCEL_ENV'].map((key) => [key, process.env[key]])
);

function loadTs(file, imports) {
  const source = fs.readFileSync(path.join(srcDir, file), 'utf8');
  const compiled = transformSync(source, {
    loader: 'ts', format: 'cjs', target: 'es2022', sourcefile: file,
  }).code;
  const module = { exports: {} };
  const fn = vm.runInNewContext(
    '(function(require,module,exports,process){\n' + compiled + '\n})', {},
    { filename: file },
  );
  fn((name) => {
    if (!Object.hasOwn(imports, name)) {
      throw new Error('Unexpected import from ' + file + ': ' + name);
    }
    return imports[name];
  }, module, module.exports, process);
  return module.exports;
}

function createTestApp() {
  const calls = { gemini: 0, insert: 0, select: 0 };
  const aiError = loadTs('aiError.ts', {});
  const middleware = loadTs('aiMiddleware.ts', {
    crypto: require('node:crypto'),
    './aiError': aiError,
  });
  const controller = loadTs('aiController.ts', {
    './aiError': aiError,
    './aiModel': {
      insertAiHistory: async (prompt, response) => {
        calls.insert++;
        return { id: '9007199254740993', prompt, response, createdAt: new Date().toISOString() };
      },
      selectLatestAiHistory: async () => {
        calls.select++;
        return [];
      },
    },
    './aiService': {
      AiGenerationError: class AiGenerationError extends Error {},
      generateAiAnswer: async () => {
        calls.gemini++;
        return 'テスト回答';
      },
    },
  });
  const { aiRouter } = loadTs('aiRouter.ts', {
    express,
    './aiError': aiError,
    './aiController': controller,
    './aiMiddleware': middleware,
  });
  const app = express();
  app.use('/api/ai', aiRouter);
  return { app, calls };
}

let server;
let url;
let calls;

test.before(async () => {
  process.env.NODE_ENV = 'development';
  process.env.AI_DEMO_ENABLED = 'true';
  delete process.env.VERCEL_ENV;

  const setup = createTestApp();
  calls = setup.calls;
  server = await new Promise((resolve, reject) => {
    const listener = setup.app.listen(0, '127.0.0.1');
    listener.once('listening', () => resolve(listener));
    listener.once('error', reject);
  });
  url = 'http://127.0.0.1:' + server.address().port + '/api/ai/ask';
});

test.after(async () => {
  if (server) await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
  for (const [key, value] of Object.entries(initialEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function request(raw, contentType = 'application/json', extraHeaders = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType, ...extraHeaders },
    body: raw,
    redirect: 'manual',
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

function expectRejected(result, status, code, before) {
  assert.equal(result.status, status);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.code, code);
  assert.match(result.body.error.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(calls, before, 'Gemini / INSERT / history SELECT must not be called');
}

const invalidCases = [
  ['empty body', '', 400, 'INVALID_BODY'],
  ['top-level null', 'null', 400, 'INVALID_JSON'],
  ['top-level string', '"text"', 400, 'INVALID_JSON'],
  ['top-level array', '[]', 400, 'INVALID_BODY'],
  ['missing question', '{}', 400, 'INVALID_BODY'],
  ['wrong type', '{"question":123}', 400, 'INVALID_BODY'],
  ['malformed JSON', '{invalid', 400, 'INVALID_JSON'],
  ['empty question', '{"question":""}', 422, 'VALIDATION_ERROR'],
  ['whitespace question', '{"question":"   "}', 422, 'VALIDATION_ERROR'],
  ['2001 code points', JSON.stringify({ question: '😀'.repeat(2001) }), 422, 'VALIDATION_ERROR'],
  ['NUL', JSON.stringify({ question: 'a\u0000b' }), 422, 'VALIDATION_ERROR'],
];

for (const [label, raw, status, code] of invalidCases) {
  test('reject ' + label + ' without Gemini/DB', async () => {
    const before = { ...calls };
    expectRejected(await request(raw), status, code, before);
  });
}

test('reject urlencoded content type', async () => {
  const before = { ...calls };
  expectRejected(await request('question=test', 'application/x-www-form-urlencoded'),
    400, 'INVALID_BODY', before);
});

test('reject compressed requests before JSON parser', async () => {
  const before = { ...calls };
  expectRejected(await request('{"question":"test"}', 'application/json', {
    'Content-Encoding': 'gzip',
  }), 415, 'UNSUPPORTED_CONTENT_ENCODING', before);
});

test('UTF-8 JSON 16385 bytes is rejected without Gemini/DB', async () => {
  const base = Buffer.byteLength(JSON.stringify({ question: 'a' }), 'utf8');
  const raw = JSON.stringify({ question: 'a' + ' '.repeat(16385 - base) });
  assert.equal(Buffer.byteLength(raw, 'utf8'), 16385);
  const before = { ...calls };
  expectRejected(await request(raw), 413, 'REQUEST_TOO_LARGE', before);
});

test('UTF-8 JSON exactly 16384 bytes reaches service and INSERT once', async () => {
  const base = Buffer.byteLength(JSON.stringify({ question: 'a' }), 'utf8');
  const raw = JSON.stringify({ question: 'a' + ' '.repeat(16384 - base) });
  assert.equal(Buffer.byteLength(raw, 'utf8'), 16384);
  const before = { ...calls };
  const result = await request(raw);
  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.id, '9007199254740993');
  assert.equal(calls.gemini, before.gemini + 1);
  assert.equal(calls.insert, before.insert + 1);
  assert.equal(calls.select, before.select);
});

test('Unicode emoji 1500 / 2000 code points are accepted without real API', async () => {
  for (const count of [1500, 2000]) {
    const raw = JSON.stringify({ question: '😀'.repeat(count) });
    assert.ok(Buffer.byteLength(raw, 'utf8') <= 16384);
    const before = { ...calls };
    const result = await request(raw);
    assert.equal(result.status, 201);
    assert.equal(calls.gemini, before.gemini + 1);
    assert.equal(calls.insert, before.insert + 1);
  }
});

test('error response never echoes malformed request or secret sentinel', async () => {
  const sentinel = 'TEST-SENTINEL-DO-NOT-EXPOSE';
  const before = { ...calls };
  const result = await request('{"question":"' + sentinel + '",invalid}');
  expectRejected(result, 400, 'INVALID_JSON', before);
  assert.ok(!JSON.stringify(result.body).includes(sentinel));
  assert.ok(!JSON.stringify(result.body).includes('DATABASE_URL'));
  assert.ok(!JSON.stringify(result.body).includes('GEMINI_API_KEY'));
});

test('client UI uses text nodes and never injects API strings as HTML', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../public/ai/app.js'), 'utf8'
  );
  assert.match(source, /question\.textContent\s*=\s*item\.prompt/);
  assert.match(source, /answer\.textContent\s*=\s*item\.response/);
  assert.match(source, /answerText\.textContent\s*=\s*body\.data\.response/);
  assert.match(source, /askError\.textContent\s*=\s*message/);
  assert.match(source, /error\.textContent\s*=\s*message/);
  assert.doesNotMatch(source, /\.(?:innerHTML|outerHTML)\s*=/);
  assert.doesNotMatch(source, /insertAdjacentHTML\s*\(/);
  assert.doesNotMatch(source, /document\.write\s*\(/);
});
