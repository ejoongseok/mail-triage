/**
 * 외부 API 호출을 여기서 한다.
 *
 * MV3 에서 content script 의 fetch 는 그 페이지의 origin 으로 나가므로 페이지의 CORS 와
 * CSP 제약을 그대로 받는다. 메일 서비스는 외부 도메인 연결을 막아 두기 때문에
 * content script 에서 직접 부르면 Failed to fetch 가 난다.
 *
 * service worker 의 fetch 는 확장 origin 으로 나가고 host_permissions 가 적용된다.
 *
 * 경로가 둘이고 사용자가 설정에서 고른다.
 *   본인 키   확장에서 TypeSafe 로 직접 간다. 개발자를 거치지 않는다
 *   체험      중계를 거친다. 개발자가 비용을 내고 한도가 걸린다
 *
 * 키가 있는지로 자동으로 가르지 않는다. 키를 넣어 두고도 체험을 쓰거나 그 반대를
 * 하고 싶을 수 있고, 무엇보다 어디로 가는지는 고른 것이어야 한다.
 */

importScripts('/src/config.js');

const NMT_DIRECT = 'https://api.typesafe.ai/v1/systemone';

/**
 * 설치 직후 설정 화면을 연다.
 *
 * 역할 문장이 없으면 아무것도 판정할 수 없는데, 설치만 하고 끝내면 무엇을 해야
 * 하는지 알 방법이 없다. 업데이트에서는 열지 않는다.
 */
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // externally_connectable 이 없어 웹페이지는 애초에 보낼 수 없지만, 설정이 바뀌어도
  // 남의 메시지로 키를 쓰게 되지 않도록 발신자를 본다
  if (sender.id !== chrome.runtime.id) return false;
  if (msg?.type !== 'jev-call') return false;

  nmtRoute()
    .then((route) => (route.errorCode ? route : callJev(route, msg.body)))
    .then(sendResponse);
  return true; // 비동기 응답을 쓰겠다는 표시
});

/**
 * 이번 호출의 경로. { relay: true } 나 { key } 나 { errorCode } 를 돌려준다.
 *
 * 어디로 가는지는 사용자가 고른 것이어야 한다. 저장소를 못 읽거나 본인 키를 골랐는데
 * 키가 없으면 보내지 않는다. 대신 중계로 보내면 업무 메일이 고르지 않은 서버를 지난다.
 *
 * 체험을 골랐으면 키가 저장돼 있어도 쓰지 않는다.
 */
async function nmtRoute() {
  let chosen;
  try {
    chosen = (await chrome.storage.local.get({ useOwnKey: null })).useOwnKey;
  } catch (_) {
    return { errorCode: 'storage' };
  }

  // 아직 고른 적이 없으면 중계가 있는 빌드에서는 체험으로 시작한다
  const own = chosen === null ? !NMT_RELAY_URL : chosen;
  if (!own) return NMT_RELAY_URL ? { relay: true } : { errorCode: 'needKey' };

  const key = await nmtApiKey();
  if (key === null) return { errorCode: 'storage' };
  if (!key) return { errorCode: chosen === true ? 'ownKeyMissing' : 'needKey' };
  return { key };
}

/**
 * 저장된 API 키.
 *
 * 동기화 저장소가 아니라 이 기기에만 둔다. 동기화 저장소는 구글 계정을 통해 다른 기기로
 * 옮겨지므로 자격 증명을 두기에 적절하지 않다. 이전 버전이 그쪽에 저장했으므로
 * 처음 읽을 때 옮기고 지운다.
 */
async function nmtApiKey() {
  try {
    const local = await chrome.storage.local.get('apiKey');
    if (local.apiKey) return local.apiKey;

    const synced = await chrome.storage.sync.get('apiKey');
    if (synced.apiKey) {
      await chrome.storage.local.set({ apiKey: synced.apiKey });
      await chrome.storage.sync.remove('apiKey');
      return synced.apiKey;
    }
    return '';
  } catch (_) {
    // 못 읽은 것과 없는 것을 가른다. 못 읽었으면 보내지 않는다
    return null;
  }
}

/**
 * 이 설치를 가리키는 임의의 값.
 *
 * 중계가 설치별 한도를 걸 때 쓴다. 사람을 알아보는 값이 아니다. 중계는 이 값을 처음 본
 * 날부터 90일 동안 한도를 세는 저장소 열쇠에 둔다.
 * 바꾸면 한도가 초기화되므로 이것만으로는 남용을 막지 못한다. 하루 총량이 그 역할을 한다.
 */
async function nmtInstallId() {
  try {
    const got = await chrome.storage.local.get('installId');
    if (got.installId) return got.installId;

    const made = crypto.randomUUID();
    await chrome.storage.local.set({ installId: made });
    return made;
  } catch (_) {
    return '';
  }
}

async function callJev(route, body) {
  const relay = Boolean(route.relay);
  const apiKey = route.key ?? '';

  const headers = { 'Content-Type': 'application/json' };
  if (relay) {
    const install = await nmtInstallId();
    if (!install) return { errorCode: 'storage' };
    headers['X-Install'] = install;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let res;
  try {
    res = await fetch(relay ? NMT_RELAY_URL : NMT_DIRECT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    // 문장을 여기서 만들지 않는다. 화면에 쓰는 쪽이 사용자 언어로 만든다
    return { errorCode: 'network', detail: String(err?.message ?? err).slice(0, 120) };
  }

  // 중계가 거부한 것과 키가 거부된 것은 사용자가 할 일이 다르다
  if (res.status === 401 || res.status === 403) {
    return { errorCode: relay ? 'relayDenied' : 'auth' };
  }
  if (res.status === 429) {
    if (!relay) return { errorCode: 'rate' };
    // 내 몫이 끝난 것과 전체가 끝난 것은 할 일이 같지만, 무엇 때문인지는 알려 준다
    let scope = '';
    try {
      scope = (await res.clone().json()).scope ?? '';
    } catch (_) {
      // 본문을 못 읽으면 본인 몫으로 본다
    }
    // 중계가 준 값이라 정해 둔 것만 받는다
    const byScope = { service: 'relayPool', new: 'relayNew', burst: 'relayBurst' };
    return { errorCode: Object.hasOwn(byScope, scope) ? byScope[scope] : 'relayQuota' };
  }

  // 중계가 멈춘 것이지 사용자가 잘못한 것이 아니다. 상태 코드 대신 할 일을 알린다
  if (relay && res.status === 503) return { errorCode: 'relayClosed' };
  // 중계가 이 판을 아직 받지 않는다. 확장과 중계 중 한쪽만 새로 올라간 경우다
  if (relay && res.status === 409) return { errorCode: 'relayVersion' };

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
      // 상류가 오류 본문에 키를 되비치면 화면과 콘솔에 그대로 나온다
      if (apiKey) detail = detail.split(apiKey).join('***');
    } catch (_) {
      // 본문을 못 읽어도 상태 코드는 돌려준다
    }
    return { errorCode: 'http', status: res.status, detail };
  }

  try {
    return { json: await res.json() };
  } catch (_) {
    return { errorCode: 'parse' };
  }
}
