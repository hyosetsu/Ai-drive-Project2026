'use strict';

// TASK-07: one-shot question submission and existing TASK-06 history UI.
document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('history-list');
  const status = document.getElementById('history-status');
  const error = document.getElementById('history-error');
  const reloadButton = document.getElementById('history-reload');
  const askForm = document.getElementById('ask-form');
  const questionInput = document.getElementById('question-input');
  const askSubmit = document.getElementById('ask-submit');
  const askStatus = document.getElementById('ask-status');
  const askError = document.getElementById('ask-error');
  const answerSection = document.getElementById('answer-section');
  const answerText = document.getElementById('answer-text');

  if (!list || !status || !error || !reloadButton ||
      !askForm || !questionInput || !askSubmit || !askStatus ||
      !askError || !answerSection || !answerText) return;

  let loadSequence = 0;
  let sending = false;
  const ASK_WAIT_MS = 45000; // provisional browser deadline; revisit in TASK-09

  function setStatus(message) {
    status.textContent = message;
  }

  function setError(message) {
    error.textContent = message;
    error.hidden = !message;
  }

  function errorMessage(httpStatus, code) {
    if (code === 'DEMO_DISABLED' || httpStatus === 503 && code === 'DEMO_DISABLED') {
      return '現在、AI履歴機能は利用できません。';
    }
    if (code === 'HISTORY_UNAVAILABLE') {
      return '履歴を取得できませんでした。時間をおいて再読み込みしてください。';
    }
    return '履歴の取得に失敗しました。接続状況を確認して再読み込みしてください。';
  }

  function makeItem(item) {
    const li = document.createElement('li');
    li.className = 'history-item';

    const date = document.createElement('time');
    date.className = 'history-date';
    const parsed = new Date(item.createdAt);
    date.dateTime = item.createdAt;
    date.textContent = Number.isNaN(parsed.getTime())
      ? '日時不明'
      : parsed.toLocaleString('ja-JP');

    const questionHeading = document.createElement('h3');
    questionHeading.textContent = '質問';
    const question = document.createElement('p');
    question.className = 'history-text';
    question.textContent = item.prompt;

    const answerHeading = document.createElement('h3');
    answerHeading.textContent = '回答';
    const answer = document.createElement('p');
    answer.className = 'history-text';
    answer.textContent = item.response;

    // Never treat API data as markup. IDs remain strings (BIGINT precision).
    li.dataset.historyId = item.id;
    li.append(date, questionHeading, question, answerHeading, answer);
    return li;
  }

  async function loadHistory() {
    const sequence = ++loadSequence;
    reloadButton.disabled = true;
    setError('');
    setStatus('履歴を読み込み中...');
    list.replaceChildren();

    try {
      const response = await fetch('/api/ai/history', {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        redirect: 'error',
      });

      if (sequence !== loadSequence) return;

      const contentType = response.headers.get('content-type') || '';
      if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) {
        throw new Error('INVALID_RESPONSE');
      }

      let body;
      try {
        body = await response.json();
      } catch {
        throw new Error('INVALID_RESPONSE');
      }

      if (!response.ok) {
        throw new Error(errorMessage(response.status, body && body.error && body.error.code));
      }

      // The live TASK-03/05 API contract is { success: true, items: [] }.
      // Older design documents mention data[], but that is not the deployed shape.
      if (!body || body.success !== true || !Array.isArray(body.items)) {
        throw new Error('INVALID_RESPONSE');
      }

      const items = body.items;
      if (!items.every((item) =>
        item && typeof item === 'object' && !Array.isArray(item) &&
        typeof item.id === 'string' &&
        typeof item.prompt === 'string' &&
        typeof item.response === 'string' &&
        typeof item.createdAt === 'string'
      )) {
        throw new Error('INVALID_RESPONSE');
      }

      if (items.length === 0) {
        setStatus('履歴なし');
        return;
      }

      const fragment = document.createDocumentFragment();
      items.forEach((item) => fragment.appendChild(makeItem(item)));
      list.appendChild(fragment);
      setStatus(`履歴を${items.length}件表示しています。`);
    } catch (caught) {
      if (sequence !== loadSequence) return;
      list.replaceChildren();
      setStatus('');
      const safeMessages = [
        '現在、AI履歴機能は利用できません。',
        '履歴を取得できませんでした。時間をおいて再読み込みしてください。',
        '履歴の取得に失敗しました。接続状況を確認して再読み込みしてください。',
      ];
      const message = caught instanceof Error && safeMessages.includes(caught.message)
        ? caught.message
        : safeMessages[2];
      setError(message);
    } finally {
      if (sequence === loadSequence) reloadButton.disabled = false;
    }
  }


  function setAskError(message) {
    askError.textContent = message;
    askError.hidden = !message;
  }

  function askFailureMessage(httpStatus, code) {
    switch (code) {
      case 'DEMO_DISABLED':
        return '現在、AI質問機能は利用できません。';
      case 'INVALID_BODY':
      case 'INVALID_JSON':
      case 'VALIDATION_ERROR':
      case 'REQUEST_TOO_LARGE':
      case 'UNSUPPORTED_CONTENT_ENCODING':
        return '質問内容を確認してください。1〜2,000文字で入力してください。';
      case 'AI_TIMEOUT':
        return 'AIの応答が時間内に届きませんでした。自動再送はしません。';
      case 'AI_UNAVAILABLE':
        return 'AIの回答を取得できませんでした。時間をおいてお試しください。';
      case 'SAVE_FAILED':
        return '回答を保存できませんでした。';
      case 'SAVE_RESULT_UNKNOWN':
        return '保存結果を確認できませんでした。再送前に履歴をご確認ください。';
      default:
        return httpStatus === 503
          ? '処理を完了できませんでした。再送前に履歴をご確認ください。'
          : '質問の送信に失敗しました。再送前に履歴をご確認ください。';
    }
  }

  async function submitQuestion(event) {
    event.preventDefault();
    if (sending) return;

    const question = questionInput.value.trim();
    const count = Array.from(question).length;
    if (count < 1 || count > 2000 || question.includes('\\u0000')) {
      setAskError('質問は前後の空白を除いて1〜2,000文字で入力してください。');
      return;
    }

    // A failure must not erase the user's draft. Never retry POST automatically.
    sending = true;
    askSubmit.disabled = true;
    askStatus.textContent = '送信中...';
    setAskError('');
    answerText.textContent = '';
    answerSection.hidden = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ASK_WAIT_MS);

    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        cache: 'no-store',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      if (!/^application\\/json(?:\\s*;|\\s*$)/i.test(response.headers.get('content-type') || '')) {
        throw new Error('INVALID_RESPONSE');
      }

      let body;
      try {
        body = await response.json();
      } catch {
        throw new Error('INVALID_RESPONSE');
      }

      if (!response.ok) {
        const code = typeof body?.error?.code === 'string' ? body.error.code : '';
        throw new Error(askFailureMessage(response.status, code));
      }
      if (response.status !== 201 || body?.success !== true ||
          typeof body?.data?.id !== 'string' ||
          typeof body?.data?.prompt !== 'string' ||
          typeof body?.data?.response !== 'string' ||
          typeof body?.data?.createdAt !== 'string' ||
          body.data.response.trim().length === 0) {
        throw new Error('INVALID_RESPONSE');
      }

      answerText.textContent = body.data.response;
      answerSection.hidden = false;
      askStatus.textContent = '回答を取得し、保存しました。';
      questionInput.value = '';

      // Fetch history exactly once after a confirmed 201; failures are shown
      // in the separate history status and never trigger a new POST.
      void loadHistory();
    } catch (caught) {
      askStatus.textContent = '';
      const known = [
        '現在、AI質問機能は利用できません。',
        '質問内容を確認してください。1〜2,000文字で入力してください。',
        'AIの応答が時間内に届きませんでした。自動再送はしません。',
        'AIの回答を取得できませんでした。時間をおいてお試しください。',
        '回答を保存できませんでした。',
        '保存結果を確認できませんでした。再送前に履歴をご確認ください。',
        '処理を完了できませんでした。再送前に履歴をご確認ください。',
        '質問の送信に失敗しました。再送前に履歴をご確認ください。',
      ];
      if (caught && caught.name === 'AbortError') {
        setAskError('応答が確認できませんでした。保存済みの可能性があります。再送前に履歴をご確認ください。');
      } else {
        setAskError(caught instanceof Error && known.includes(caught.message)
          ? caught.message
          : '応答を確認できませんでした。保存済みの可能性があります。再送前に履歴をご確認ください。');
      }
    } finally {
      clearTimeout(timeoutId);
      sending = false;
      askSubmit.disabled = false;
    }
  }

  askForm.addEventListener('submit', (event) => { void submitQuestion(event); });

  reloadButton.addEventListener('click', () => { void loadHistory(); });
  void loadHistory();
});
