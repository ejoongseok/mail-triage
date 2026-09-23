/**
 * 판정 결과 캐시.
 *
 * 같은 메일을 다시 판정하면 돈과 시간이 그대로 나간다. 메일 키로 결과를 저장한다.
 * chrome.storage.local 은 비동기이므로 메모리 사본을 함께 둔다.
 */

const NMT_CACHE_KEY = 'nmt_verdicts';
const NMT_CACHE_MAX = 5000;

/**
 * 질문 설계가 바뀌면 옛 판정이 무효다. 코드를 고칠 때 이 값을 올린다.
 */
const NMT_SCHEMA_VERSION = 3;

let nmtMem = null;

/** 짧은 해시(djb2). 역할 문장이 바뀌었는지 가리는 용도이고 암호용이 아니다. */
function nmtHash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * 판정 캐시의 최종 키.
 *
 * 메일 식별자만으로는 부족하다. 역할 문장이 바뀌면 같은 메일의 판정이 달라져야 하는데
 * 메일 키만 쓰면 옛 결과가 그대로 나온다.
 */
function nmtVerdictKey(mailKey, persona) {
  return `v${NMT_SCHEMA_VERSION}:${nmtHash(persona ?? '')}:${mailKey}`;
}

async function nmtCacheLoad() {
  if (nmtMem) return nmtMem;
  try {
    // 확장이 업데이트되면 chrome.storage 접근이 예외를 던진다. 그때는 빈 캐시로 진행한다
    const got = await chrome.storage.local.get(NMT_CACHE_KEY);
    nmtMem = got[NMT_CACHE_KEY] ?? {};
  } catch (_) {
    nmtMem = {};
  }
  return nmtMem;
}

async function nmtCacheGet(key) {
  const all = await nmtCacheLoad();
  return all[key] ?? null;
}

async function nmtCacheSet(key, verdict) {
  const all = await nmtCacheLoad();
  all[key] = { ...verdict, at: Date.now() };

  const keys = Object.keys(all);
  if (keys.length > NMT_CACHE_MAX) {
    // 오래된 것부터 버린다
    keys
      .sort((a, b) => (all[a].at ?? 0) - (all[b].at ?? 0))
      .slice(0, keys.length - NMT_CACHE_MAX)
      .forEach((k) => delete all[k]);
  }

  try {
    await chrome.storage.local.set({ [NMT_CACHE_KEY]: all });
  } catch (_) {
    // 저장에 실패해도 메모리 사본으로 이번 세션은 동작한다
  }
}

async function nmtCacheClear() {
  nmtMem = {};
  try {
    await chrome.storage.local.remove(NMT_CACHE_KEY);
  } catch (_) {
    // 무시
  }
}

async function nmtCacheCount() {
  const all = await nmtCacheLoad();
  return Object.keys(all).length;
}

/* 처리함 기록 ------------------------------------------------------------ */

/**
 * 사용자가 직접 "처리했다"고 표시한 메일.
 *
 * 판정 캐시와 따로 둔다. 판정은 역할 문장이 바뀌면 다시 해야 하지만 처리 여부는
 * 역할과 무관한 사실이므로 키에 역할 해시를 섞지 않는다.
 *
 * 메일함에서 지워진 메일의 키는 다시 조회될 일이 없어 그대로 쌓이므로 기간으로 턴다.
 */
const NMT_DONE_KEY = 'nmt_done';

/**
 * 다른 화면에서 기록을 비우면 이 화면의 사본도 비운다.
 *
 * 설정 화면의 비우기는 그 화면의 사본과 저장소만 지운다. 이미 열린 메일 탭은 한 번 읽어 둔
 * 사본을 계속 써서, 비웠는데도 옛 판정과 내려간 표시가 그대로 나온다.
 */
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[NMT_CACHE_KEY] && changes[NMT_CACHE_KEY].newValue === undefined) nmtMem = null;
    if (changes[NMT_DONE_KEY] && changes[NMT_DONE_KEY].newValue === undefined) nmtDoneMem = null;
  });
} catch (_) {
  // 저장소 API 가 없는 곳에서는 듣지 않는다
}
const NMT_DONE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

let nmtDoneMem = null;

async function nmtDoneLoad() {
  if (nmtDoneMem) return nmtDoneMem;

  let all = {};
  try {
    const got = await chrome.storage.local.get(NMT_DONE_KEY);
    all = got[NMT_DONE_KEY] ?? {};
  } catch (_) {
    // 확장 업데이트 직후에는 접근이 막힌다. 이번 회차는 빈 기록으로 진행한다
  }

  const cutoff = Date.now() - NMT_DONE_TTL_MS;
  let dropped = 0;
  for (const k of Object.keys(all)) {
    if (nmtDoneAt(all[k]) < cutoff) {
      delete all[k];
      dropped += 1;
    }
  }
  if (dropped) nmtDoneSave(all);

  nmtDoneMem = all;
  return nmtDoneMem;
}

function nmtDoneSave(all) {
  try {
    chrome.storage.local.set({ [NMT_DONE_KEY]: all }).catch(() => {});
  } catch (_) {
    // 저장에 실패해도 메모리 사본으로 이번 세션은 동작한다
  }
}

/** 기록 시각을 꺼낸다. 초기 형식은 숫자 하나였으므로 둘 다 읽는다 */
function nmtDoneAt(entry) {
  if (typeof entry === 'number') return entry;
  return entry?.at ?? 0;
}

/**
 * 내려간 메일의 기록을 돌려준다.
 *
 * 유형을 함께 담는다. 배지에 "처리함"만 남기면 답장이 필요했다는 사실이 사라지는데,
 * 확장이 아는 것은 열었다는 사실뿐이라 처리했다고 단정할 수도 없다.
 */
async function nmtDoneGet(mailKey) {
  const all = await nmtDoneLoad();
  const e = all[mailKey];
  if (!e) return null;
  return { at: nmtDoneAt(e), kind: typeof e === 'number' ? '' : (e.kind ?? '') };
}

async function nmtDoneSet(mailKey, on, kind) {
  const all = await nmtDoneLoad();
  if (on) all[mailKey] = { at: Date.now(), kind: kind ?? '' };
  else delete all[mailKey];
  nmtDoneSave(all);
}

async function nmtDoneClear() {
  nmtDoneMem = {};
  try {
    await chrome.storage.local.remove(NMT_DONE_KEY);
  } catch (_) {
    // 무시
  }
}

async function nmtDoneCount() {
  return Object.keys(await nmtDoneLoad()).length;
}
