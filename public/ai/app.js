'use strict';

// TASK-06: history read-only UI. Sending questions belongs to TASK-07.
document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('history-list');
  const status = document.getElementById('history-status');
  const error = document.getElementById('history-error');
  const reloadButton = document.getElementById('history-reload');

  if (!list || !status || !error || !reloadButton) return;

  let loadSequence = 0;

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
      setError(
        caught instanceof Error && !['INVALID_RESPONSE', 'Failed to fetch'].includes(caught.message)
          ? caught.message
          : '履歴の取得に失敗しました。接続状況を確認して再読み込みしてください。'
      );
    } finally {
      if (sequence === loadSequence) reloadButton.disabled = false;
    }
  }

  reloadButton.addEventListener('click', () => { void loadHistory(); });
  void loadHistory();
});
