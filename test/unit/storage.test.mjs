/**
 * 판정 캐시와 처리함 기록.
 *
 * 브라우저 저장소를 메모리로 흉내 낸다. 확장은 저장에 실패해도 그 회차는 돌아야 하므로
 * 실패하는 저장소도 함께 시험한다.
 */

import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { loadExtension } from '../harness.mjs';

/** chrome.storage.local 을 흉내 낸다. fail 을 켜면 모든 호출이 거부된다 */
function fakeStorage() {
  const data = {};
  const api = {
    fail: false,
    data,
    local: {
      async get(keys) {
        if (api.fail) throw new Error('storage unavailable');
        const names = typeof keys === 'string' ? [keys] : Object.keys(keys ?? data);
        const out = {};
        for (const k of names) if (k in data) out[k] = data[k];
        return out;
      },
      async set(obj) {
        if (api.fail) throw new Error('storage unavailable');
        Object.assign(data, obj);
      },
      async remove(key) {
        if (api.fail) throw new Error('storage unavailable');
        delete data[key];
      },
    },
  };
  return api;
}

function load(storage) {
  return loadExtension({ chrome: { i18n: { getMessage: () => '' }, storage } });
}

describe('판정 캐시', () => {
  let storage;
  let ext;

  beforeEach(() => {
    storage = fakeStorage();
    ext = load(storage);
  });

  it('넣은 것을 그대로 돌려준다', async () => {
    await ext.nmtCacheSet('k1', { action: 0.9, kind: 'reply' });
    const got = await ext.nmtCacheGet('k1');
    assert.equal(got.action, 0.9);
    assert.equal(got.kind, 'reply');
  });

  it('없는 키에는 null 을 준다', async () => {
    assert.equal(await ext.nmtCacheGet('없음'), null);
  });

  it('비우면 건수가 0 이 된다', async () => {
    await ext.nmtCacheSet('k1', { action: 0.1 });
    await ext.nmtCacheSet('k2', { action: 0.2 });
    assert.equal(await ext.nmtCacheCount(), 2);

    await ext.nmtCacheClear();
    assert.equal(await ext.nmtCacheCount(), 0);
    assert.equal(await ext.nmtCacheGet('k1'), null);
  });

  it('저장소가 막혀도 그 회차는 돌아간다', async () => {
    storage.fail = true;
    // 예외가 밖으로 나가면 분류가 중간에 멈춘다
    await ext.nmtCacheSet('k1', { action: 0.5 });
    assert.equal(await ext.nmtCacheCount(), 1);
  });
});

describe('처리함 기록', () => {
  let storage;
  let ext;

  beforeEach(() => {
    storage = fakeStorage();
    ext = load(storage);
  });

  it('내린 메일의 분류를 함께 남긴다', async () => {
    await ext.nmtDoneSet('gmail:1', true, 'reply');
    const got = await ext.nmtDoneGet('gmail:1');
    assert.equal(got.kind, 'reply');
    assert.ok(got.at > 0);
  });

  it('되돌리면 기록이 사라진다', async () => {
    await ext.nmtDoneSet('gmail:1', true, 'reply');
    await ext.nmtDoneSet('gmail:1', false);
    assert.equal(await ext.nmtDoneGet('gmail:1'), null);
  });

  it('비우면 전부 사라진다', async () => {
    await ext.nmtDoneSet('gmail:1', true, 'reply');
    await ext.nmtDoneSet('gmail:2', true, 'task');
    assert.equal(await ext.nmtDoneCount(), 2);

    await ext.nmtDoneClear();
    assert.equal(await ext.nmtDoneCount(), 0);
  });

  it('오래된 기록은 저절로 지워진다', async () => {
    // 메일함에서 사라진 메일의 키는 다시 조회될 일이 없어 그대로 쌓인다
    const old = Date.now() - 61 * 24 * 60 * 60 * 1000;
    storage.data.nmt_done = { '오래됨': { at: old, kind: 'reply' }, '최근': { at: Date.now(), kind: 'task' } };
    assert.equal(await ext.nmtDoneCount(), 1);
    assert.equal(await ext.nmtDoneGet('오래됨'), null);
    assert.ok(await ext.nmtDoneGet('최근'));
  });

  it('초기 형식으로 저장된 기록도 읽는다', async () => {
    // 초기 형식은 시각 하나였다. 확장을 업데이트한 사람의 기록이 사라지면 안 된다
    storage.data.nmt_done = { 'gmail:9': Date.now() };
    const got = await ext.nmtDoneGet('gmail:9');
    assert.ok(got, '옛 형식을 읽지 못했다');
    assert.equal(got.kind, '');
  });
});
