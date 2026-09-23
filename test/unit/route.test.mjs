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
 */
function loadBackground({ local = {}, failWhen = () => false, status = 200, reply = { answers: {} } } = {}) {
  const calls = [];
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

  const ctx = vm.createContext({
    console,
    crypto: globalThis.crypto,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(reply), { status });
    },
    chrome: {
      runtime: {
        id: 'self',
        onInstalled: { addListener() {} },
        onMessage: { addListener() {} },
        openOptionsPage() {},
      },
      storage,
    },
  });
  ctx.importScripts = (path) => vm.runInContext(readFileSync(join(ROOT, path), 'utf8'), ctx);
  vm.runInContext(readFileSync(join(ROOT, 'src/background.js'), 'utf8'), ctx, { filename: 'background.js' });
  return { ctx, calls };
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
