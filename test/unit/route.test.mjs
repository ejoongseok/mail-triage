/**
 * 요청이 어디로 가고 무엇을 싣는가.
 *
 * 경로는 사용자가 고른 것이어야 하고, 고른 대로 갈 수 없으면 다른 곳으로 대신 보내지
 * 않는다. 싣는 내용은 중계가 받는 크기를 넘지 않는다. 응답도 이 확장 밖에서 온 값이라
 * 정해 둔 모양만 받는다.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { ROOT, loadExtension } from '../harness.mjs';

/**
 * background.js 를 저장소 흉내와 함께 올린다.
 *
 * local 은 이 기기 저장소의 내용이다. failWhen 이 참을 돌려주는 조회는 예외를 던진다.
 * status 가 배열이면 호출 순서대로 쓰고, 다 쓰면 마지막 값을 되풀이한다. hang 이면 응답이
 * 오지 않아 시간 제한이 끊어야 끝난다.
 */
function loadBackground({
  local = {},
  failWhen = () => false,
  status = 200,
  reply = { answers: {} },
  headers = {},
  hang = false,
  offline = false,
} = {}) {
  const calls = [];
  const listeners = [];
  const opened = [];
  const storage = {
    local: {
      async get(query) {
        if (failWhen(query)) throw new Error('storage down');
        if (typeof query === 'string') return query in local ? { [query]: local[query] } : {};
        const out = { ...query };
        for (const k of Object.keys(query)) if (k in local) out[k] = local[k];
        return out;
      },
      async set(values) {
        Object.assign(local, values);
      },
    },
    sync: {
      async get() {
        return {};
      },
      async remove() {},
    },
  };

  const statusAt = (i) => (Array.isArray(status) ? status[Math.min(i, status.length - 1)] : status);
  // 확장이 요청한 대기 시간. 실제로는 짧게 줄여 기다리지만 얼마를 기다리려 했는지는 남긴다
  const delays = [];
  const ctx = vm.createContext({
    console,
    crypto: globalThis.crypto,
    AbortController,
    Response,
    setTimeout: (fn, ms) => {
      delays.push(ms);
      return setTimeout(fn, Math.min(ms, 5));
    },
    clearTimeout,
    fetch: (url, init) => {
      calls.push({ url, init });
      if (offline) return Promise.reject(new TypeError('Failed to fetch'));
      if (hang) {
        return new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        );
      }
      return Promise.resolve(new Response(JSON.stringify(reply), { status: statusAt(calls.length - 1), headers }));
    },
    chrome: {
      runtime: {
        id: 'self',
        onInstalled: { addListener() {} },
        onMessage: { addListener: (fn) => listeners.push(fn) },
        async openOptionsPage() {
          opened.push(true);
        },
      },
      storage,
    },
  });
  ctx.importScripts = (path) => vm.runInContext(readFileSync(join(ROOT, path), 'utf8'), ctx);
  vm.runInContext(readFileSync(join(ROOT, 'src/background.js'), 'utf8'), ctx, { filename: 'background.js' });
  return { ctx, calls, listeners, opened, delays };
}

/** 판정 하나를 돌리고, background 로 보낸 본문과 판정 결과를 돌려준다 */
async function judgeWith(settings, mail, reply = { json: { answers: { action: { noul: 0.5 } } } }) {
  let body = null;
  const ext = loadExtension({
    chrome: {
      i18n: { getMessage: () => '' },
      runtime: {
        sendMessage: async (m) => {
          body = m.body;
          return reply;
        },
      },
    },
  });
  const out = await ext.nmtJudge(mail, settings);
  return { body, out };
}

describe('경로는 고른 것만 따른다', () => {
  it('저장소를 못 읽으면 보내지 않는다', async () => {
    const { ctx } = loadBackground({ failWhen: () => true });
    assert.equal((await ctx.nmtRoute()).errorCode, 'storage');
  });

  it('본인 키를 골랐는데 키가 없으면 중계로 보내지 않는다', async () => {
    const { ctx } = loadBackground({ local: { useOwnKey: true } });
    const route = await ctx.nmtRoute();
    assert.equal(route.errorCode, 'ownKeyMissing');
    assert.notEqual(route.relay, true);
  });

  it('본인 키를 골랐는데 키를 못 읽으면 보내지 않는다', async () => {
    const { ctx } = loadBackground({ local: { useOwnKey: true }, failWhen: (q) => q === 'apiKey' });
    assert.equal((await ctx.nmtRoute()).errorCode, 'storage');
  });

  it('체험을 골랐으면 키가 있어도 쓰지 않는다', async () => {
    const { ctx } = loadBackground({ local: { useOwnKey: false, apiKey: 'k' } });
    const route = await ctx.nmtRoute();
    assert.equal(route.relay, true);
    assert.equal(route.key, undefined);
  });

  it('처음 설치하면 체험으로 시작한다', async () => {
    const { ctx } = loadBackground();
    assert.equal((await ctx.nmtRoute()).relay, true);
  });

  it('본인 키를 골랐고 키가 있으면 그 키로 간다', async () => {
    const { ctx } = loadBackground({ local: { useOwnKey: true, apiKey: 'k' } });
    assert.equal((await ctx.nmtRoute()).key, 'k');
  });
});

describe('중계가 닫혀 있으면 할 일을 알린다', () => {
  it('중계의 503 은 상태 코드가 아니라 닫힘으로 돌려준다', async () => {
    const { ctx, calls } = loadBackground({ status: 503 });
    const reply = await ctx.callJev({ relay: true }, { model: 'x' });
    assert.equal(reply.errorCode, 'relayClosed');
    assert.equal(calls.length, 1);
  });

  it('중계의 409 는 판이 맞지 않는다고 돌려준다', async () => {
    const { ctx } = loadBackground({ status: 409, reply: { error: 'questions' } });
    const reply = await ctx.callJev({ relay: true }, { model: 'x' });
    assert.equal(reply.errorCode, 'relayVersion');
  });
});

describe('중계가 거절한 까닭을 가려 알린다', () => {
  const cases = [
    ['you', 'relayQuota'],
    ['service', 'relayPool'],
    ['new', 'relayNew'],
    ['burst', 'relayBurst'],
    ['constructor', 'relayQuota'],
  ];
  for (const [scope, want] of cases) {
    it(scope + ' 는 ' + want, async () => {
      const { ctx } = loadBackground({ status: 429, reply: { error: 'rate', scope } });
      const got = await ctx.callJev({ relay: true }, { model: 'x' });
      assert.equal(got.errorCode, want);
    });
  }
});

describe('본인 키 경로는 기다렸다가 다시 보낸다', () => {
  // API 는 429 와 529 에 잠시 기다렸다가 지수 백오프로 다시 보내라고 한다
  const own = { key: 'k' };

  it('429 뒤에 성공하면 성공으로 돌려준다', async () => {
    const { ctx, calls } = loadBackground({ status: [429, 200], reply: { answers: { action: { noul: 0.4 } } } });
    const got = await ctx.callJev(own, { model: 'x' });
    assert.equal(calls.length, 2);
    assert.ok(got.json, '다시 보낸 뒤의 응답을 돌려주지 않았다');
  });

  it('529 가 이어지면 세 번 더 보내고 멈춘다', async () => {
    const { ctx, calls } = loadBackground({ status: 529 });
    const got = await ctx.callJev(own, { model: 'x' });
    assert.equal(calls.length, 4);
    assert.equal(got.errorCode, 'http');
    assert.equal(got.status, 529);
  });

  it('한도 초과가 이어지면 한도 초과로 알린다', async () => {
    const { ctx, calls } = loadBackground({ status: 429 });
    const got = await ctx.callJev(own, { model: 'x' });
    assert.equal(calls.length, 4);
    assert.equal(got.errorCode, 'rate');
  });

  it('오래 기다리라고 하면 기다리지 않고 바로 알린다', async () => {
    const { ctx, calls } = loadBackground({ status: 429, headers: { 'retry-after': '60' } });
    const got = await ctx.callJev(own, { model: 'x' });
    assert.equal(calls.length, 1);
    assert.equal(got.errorCode, 'rate');
  });

  it('응답이 오지 않으면 시간 제한으로 끊고 다시 보낸 뒤 시간 초과로 알린다', async () => {
    const { ctx, calls } = loadBackground({ hang: true });
    const got = await ctx.callJev(own, { model: 'x' });
    assert.equal(calls.length, 4);
    assert.equal(got.errorCode, 'timeout');
  });

  it('연결이 안 되면 다시 보낸 뒤 연결 오류로 알린다', async () => {
    const { ctx, calls } = loadBackground({ offline: true });
    const got = await ctx.callJev(own, { model: 'x' });
    assert.equal(calls.length, 4);
    assert.equal(got.errorCode, 'network');
  });

  it('retry-after-ms 를 읽는다', async () => {
    // 읽지 못하면 백오프로 세 번 더 보내게 된다
    const { ctx, calls } = loadBackground({ status: 429, headers: { 'retry-after-ms': '60000' } });
    const got = await ctx.callJev(own, { model: 'x' });
    assert.equal(calls.length, 1);
    assert.equal(got.errorCode, 'rate');
  });

  it('곧바로 다시 보내라고 해도 백오프만큼은 기다린다', async () => {
    const { ctx, calls, delays } = loadBackground({ status: [429, 200], headers: { 'retry-after': '0' } });
    await ctx.callJev(own, { model: 'x' });
    assert.equal(calls.length, 2);
    // 첫 백오프는 0.5초에서 최대 4분의 1을 뺀 값이다
    assert.ok(
      delays.some((ms) => ms >= 375 && ms <= 500),
      '기다린 시간: ' + delays.join(', ')
    );
  });

  it('요청 자체가 틀린 422 는 다시 보내지 않는다', async () => {
    const { ctx, calls } = loadBackground({ status: 422 });
    const got = await ctx.callJev(own, { model: 'x' });
    assert.equal(calls.length, 1);
    assert.equal(got.status, 422);
  });

  it('중계 경로는 다시 보내지 않는다. 중계가 시도마다 하루 한도를 차감한다', async () => {
    const { ctx, calls } = loadBackground({ status: 529 });
    await ctx.callJev({ relay: true }, { model: 'x' });
    assert.equal(calls.length, 1);
  });

  it('중계 경로는 기다리다 끊지 않는다. 끊어도 한도는 이미 차감됐다', async () => {
    const relay = loadBackground();
    await relay.ctx.callJev({ relay: true }, { model: 'x' });
    assert.equal(relay.calls[0].init.signal, undefined);

    const direct = loadBackground();
    await direct.ctx.callJev(own, { model: 'x' });
    assert.ok(direct.calls[0].init.signal, '본인 키 경로에는 시간 제한이 있어야 한다');
  });
});

describe('상태 문장은 중계가 받는 길이를 넘지 않는다', () => {
  it('모든 칸이 아주 길어도 1500자 안에 들고 제목과 발신자가 남는다', async () => {
    const { body } = await judgeWith(
      { persona: '가'.repeat(5000), myIdentity: '나'.repeat(500) },
      { sender: '다'.repeat(3000), email: 'a'.repeat(3000), subject: '라'.repeat(900), preview: '마'.repeat(900) }
    );
    assert.ok(body.state.length <= 1500, '길이 ' + body.state.length);
    assert.ok(body.state.includes('[제목]'), '제목이 잘려 나갔다');
    assert.ok(body.state.includes('[발신자]'), '발신자가 잘려 나갔다');
  });

  it('보통 길이면 미리보기 500자를 그대로 싣는다', async () => {
    const { body } = await judgeWith(
      { persona: '백엔드 개발자', myIdentity: '' },
      { sender: '김민준', email: 'a@b.c', subject: '확인 부탁', preview: '바'.repeat(600) }
    );
    assert.ok(body.state.includes('바'.repeat(500)));
    assert.ok(!body.state.includes('바'.repeat(501)));
  });
});

describe('회신 메일', () => {
  // 회신 제목은 원래 메일의 요청을 달고 온다. 목록에 미리보기가 없으면 모델이 제목의 요청을
  // 발신자의 것으로 읽으므로, 회신이면 그 사실을 따로 알린다
  const settings = { persona: '구매 담당자', myIdentity: '' };

  for (const subject of ['RE: 견적 검토 부탁드립니다', 're: 견적', 'Re[2]: 견적', '회신: 견적', '  답장 : 견적']) {
    it('회신 표시가 있으면 알린다: ' + subject.trim(), async () => {
      const { body } = await judgeWith(settings, { sender: '김민수', subject });
      assert.ok(body.state.includes('[회신 여부]'), body.state);
    });
  }

  for (const subject of ['견적 검토 부탁드립니다', 'FW: 견적', '[공지] 회의실 안내', 'Reply 기능 소개', '회신 부탁드립니다', '']) {
    it('회신 표시가 아니면 붙이지 않는다: ' + (subject || '(빈 제목)'), async () => {
      const { body } = await judgeWith(settings, { sender: '김민수', subject });
      assert.ok(!body.state.includes('[회신 여부]'), body.state);
    });
  }

  it('모든 칸이 아주 길어도 안내 줄과 미리보기 앞부분이 1500자 안에 남는다', async () => {
    const { body } = await judgeWith(
      { persona: '가'.repeat(5000), myIdentity: '나'.repeat(500) },
      { sender: '다'.repeat(3000), email: 'a'.repeat(3000), subject: 'RE: ' + '라'.repeat(900), preview: '마'.repeat(900) }
    );
    assert.ok(body.state.length <= 1500, '길이 ' + body.state.length);
    assert.ok(body.state.endsWith('보지 않는다.'), '안내 줄이 잘렸다');
    assert.ok(body.state.includes('[미리보기] 마'), '미리보기가 빠졌다');
  });
});

describe('응답의 종류는 정해 둔 것만 받는다', () => {
  const cases = [
    ['reply', 'reply'],
    ['__proto__', 'other'],
    ['constructor', 'other'],
    ['<img src=x>', 'other'],
    [42, 'other'],
  ];
  for (const [got, want] of cases) {
    it(JSON.stringify(got) + ' 은 ' + want + ' 로 본다', async () => {
      const { out } = await judgeWith(
        { persona: '개발자' },
        { sender: 'a', subject: 'b' },
        { json: { answers: { action: { noul: 0.9 }, kind: { choice: got } } } }
      );
      assert.equal(out.kind, want);
    });
  }
});

describe('시간 초과는 분류를 멈춘다', () => {
  it('background 가 다시 보낸 뒤에도 늦으면 남은 메일을 부르지 않는다', async () => {
    const { out } = await judgeWith({ persona: '개발자' }, { sender: 'a', subject: 'b' }, { errorCode: 'timeout' });
    assert.equal(out.fatal, true);
  });

  it('연결 오류 하나로는 멈추지 않는다', async () => {
    const { out } = await judgeWith({ persona: '개발자' }, { sender: 'a', subject: 'b' }, { errorCode: 'network', detail: 'x' });
    assert.notEqual(out.fatal, true);
  });
});

describe('설정 화면 열기', () => {
  // 처리부가 없으면 응답이 오지 않는다. 기다리기 전에 판정하고, 기다림에도 끝을 둔다
  it('메일 화면의 부탁을 받아 확장 쪽에서 연다', { timeout: 2000 }, async () => {
    const { listeners, opened } = loadBackground();
    const reply = await new Promise((resolve) => {
      const keep = listeners[0]({ type: 'open-options' }, { id: 'self' }, resolve);
      assert.equal(keep, true, '응답을 기다리게 하지 않았다');
    });
    assert.equal(reply.ok, true);
    assert.equal(opened.length, 1);
  });

  it('다른 확장이 보낸 부탁은 받지 않는다', () => {
    const { listeners, opened } = loadBackground();
    assert.equal(listeners[0]({ type: 'open-options' }, { id: 'other' }, () => {}), false);
    assert.equal(opened.length, 0);
  });
});
