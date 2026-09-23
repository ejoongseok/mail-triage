/*
 * 확장 밖에서 content script 를 돌리기 위한 chrome API 흉내.
 *
 * content script 가 쓰는 것은 i18n, runtime 의 id 와 getURL 과 sendMessage, storage 의
 * local 과 sync 뿐이다. 판정 호출은 가짜 메일의 judge 값을 돌려주고 횟수를 센다.
 * 문구는 실제 번역 파일을 읽어, 화면에 나오는 문장과 같은 것으로 비교한다.
 */
(() => {
  const messages = (() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '../../_locales/ko/messages.json', false);
    xhr.send();
    return JSON.parse(xhr.responseText);
  })();

  /** chrome.i18n.getMessage 와 같은 규칙. 자리표시자의 $1 $2 를 인자 순서로 채운다 */
  function getMessage(key, subs) {
    const entry = messages[key];
    if (!entry) return '';
    const list = subs === undefined ? [] : [].concat(subs);
    let out = entry.message;
    for (const [name, ph] of Object.entries(entry.placeholders ?? {})) {
      const m = /^\$(\d+)$/.exec(ph.content ?? '');
      const value = m ? list[Number(m[1]) - 1] : ph.content;
      out = out.split('$' + name.toUpperCase() + '$').join(String(value ?? ''));
    }
    return out;
  }

  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const listeners = [];

  function notify(name, store, keys, before) {
    const changes = {};
    for (const k of keys) changes[k] = { oldValue: before[k], newValue: clone(store[k]) };
    for (const fn of listeners) fn(changes, name);
  }

  function area(name, store) {
    const snapshot = (keys) => Object.fromEntries(keys.map((k) => [k, clone(store[k])]));
    return {
      async get(query) {
        if (query === null || query === undefined) return clone(store);
        if (typeof query === 'string') return query in store ? { [query]: clone(store[query]) } : {};
        const out = {};
        if (Array.isArray(query)) {
          for (const k of query) if (k in store) out[k] = clone(store[k]);
          return out;
        }
        for (const [k, fallback] of Object.entries(query)) out[k] = k in store ? clone(store[k]) : fallback;
        return out;
      },
      async set(values) {
        const keys = Object.keys(values);
        const before = snapshot(keys);
        for (const [k, v] of Object.entries(values)) store[k] = clone(v);
        notify(name, store, keys, before);
      },
      async remove(keys) {
        const list = [].concat(keys);
        const before = snapshot(list);
        for (const k of list) delete store[k];
        notify(name, store, list, before);
      },
      async clear() {
        const list = Object.keys(store);
        const before = snapshot(list);
        for (const k of list) delete store[k];
        notify(name, store, list, before);
      },
    };
  }

  const local = {};
  const sync = {
    persona: '백엔드 개발자. 코드 리뷰와 배포 일정과 결재 요청을 챙긴다.',
    myIdentity: '나 <me@company.example.com>',
  };

  const test = {
    /** 판정 호출 횟수. 페이지를 넘기거나 돌아올 때 늘면 안 된다 */
    calls: 0,
    /** 판정 한 건에 걸리는 시간. 분류 도중에 화면을 바꾸는 시험에서 늘린다 */
    delay: 0,
    local,
    sync,
    async judge(body) {
      test.calls += 1;
      if (test.delay) await new Promise((r) => setTimeout(r, test.delay));
      const subject = (/\[제목\] (.*)/.exec(body.state) || [])[1] ?? '';
      let mail = null;
      for (const list of NMT_FIXTURE_PAGES) for (const m of list) if (m.subject === subject) mail = m;
      const j = mail?.judge ?? { action: 0, kind: 'other' };
      return {
        json: {
          answers: { action: { noul: j.action }, kind: { choice: j.kind }, deadline: { noul: 0 } },
          usage: { input_tokens: 1000 },
        },
      };
    },
  };
  window.NMT_TEST = test;

  const stub = {
    i18n: { getMessage, getUILanguage: () => 'ko' },
    runtime: {
      id: 'scenario',
      getURL: (p) => '../../' + String(p).replace(/^\//, ''),
      async sendMessage(msg) {
        if (msg?.type === 'jev-call') return test.judge(msg.body);
        return undefined;
      },
    },
    storage: {
      local: area('local', local),
      sync: area('sync', sync),
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };

  try {
    window.chrome = stub;
  } catch (_) {
    // 브라우저가 이미 둔 chrome 이 쓰기 금지면 아래에서 덮는다
  }
  if (window.chrome !== stub) {
    Object.defineProperty(window, 'chrome', { value: stub, configurable: true, writable: true });
  }
})();
