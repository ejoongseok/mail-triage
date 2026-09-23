// rowSelector 는 화면에서 뺐다. 프로파일이 깨지면 확장을 고쳐 배포하는 것이 맞는 대응이고,
// 급할 때는 콘솔에서 chrome.storage.sync.set({rowSelector: '...'}) 로 넣을 수 있다
// 키는 동기화 저장소에 두지 않는다. 구글 계정을 통해 다른 기기로 옮겨지기 때문이다
const NMT_SYNCED = {
  persona: '',
  myIdentity: '',
  alwaysShow: '',
  alwaysMute: '',
  threshold: 0.7,
  unreadOnly: false,
};

const $ = (id) => document.getElementById(id);

/* 직군 목록 ------------------------------------------------------------- */

function fillJobs() {
  const sel = $('jobSelect');
  const groups = nmtJobs();

  for (const { group, items } of groups) {
    const og = document.createElement('optgroup');
    og.label = group;
    for (const [name, text] of items) {
      const opt = document.createElement('option');
      opt.value = text;
      opt.textContent = name;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }

  sel.addEventListener('change', () => {
    if (!sel.value) return;
    const cur = $('persona').value.trim();
    // 손으로 쓴 내용이 있으면 덮기 전에 묻는다
    if (cur && !isTemplate(cur, groups) && !confirm(nmtMsg('optRoleHint'))) {
      sel.value = '';
      return;
    }
    $('persona').value = sel.value;
    $('persona').focus();
  });
}

function isTemplate(text, groups) {
  return groups.some(({ items }) => items.some(([, t]) => t === text));
}

/* 강조 강도 ------------------------------------------------------------- */

function markChosen() {
  document.querySelectorAll('.choice').forEach((el) => {
    el.classList.toggle('on', el.querySelector('input').checked);
  });
}

function setStrength(value) {
  const radios = [...document.querySelectorAll('input[name="strength"]')];
  // 저장된 값과 가장 가까운 단계를 고른다
  const best = radios.reduce((a, b) =>
    Math.abs(Number(b.value) - value) < Math.abs(Number(a.value) - value) ? b : a
  );
  best.checked = true;
  markChosen();
}

function getStrength() {
  const on = document.querySelector('input[name="strength"]:checked');
  return on ? Number(on.value) : 0.7;
}

/* 지금 어느 경로인가 ------------------------------------------------------ */

/** 이 빌드에 체험 중계가 설정돼 있는가. 소스에서 직접 빌드하면 비어 있다 */
function hasRelay() {
  return typeof NMT_RELAY_URL === 'string' && NMT_RELAY_URL.length > 0;
}

/** 지금 고른 방식. own 이면 본인 키, trial 이면 중계 */
function chosenSource() {
  const on = document.querySelector('input[name="source"]:checked');
  return on ? on.value : 'trial';
}

function setSource(value) {
  const want = value === 'own' || !hasRelay() ? 'own' : 'trial';
  const radio = document.querySelector('input[name="source"][value="' + want + '"]');
  if (radio) radio.checked = true;
}

/**
 * 고른 방식에 따라 화면을 맞춘다.
 *
 * 무엇이 어디로 가는지가 방식마다 다르므로, 고르는 순간 그 사실을 적는다. 중계 주소가
 * 없는 빌드에서는 체험을 고를 수 없게 하고 왜 그런지도 적는다.
 */
function renderMode() {
  const note = document.getElementById('modeNote');
  if (!note) return;

  const relay = hasRelay();
  const trialRow = document.getElementById('sourceTrialRow');
  const trialRadio = trialRow.querySelector('input');

  trialRadio.disabled = !relay;
  trialRow.classList.toggle('off', !relay);
  if (!relay && chosenSource() === 'trial') setSource('own');

  const own = chosenSource() === 'own';
  $('keyBox').classList.toggle('on', own);

  // 본인 키는 고른 것만으로 분명하다. 설명이 필요한 쪽은 왜 서버가 끼는지다
  if (!relay) {
    note.className = 'mode need';
    note.textContent = nmtMsg('optModeNoRelay');
  } else {
    note.className = 'mode';
    note.textContent = '';
  }

  document.querySelectorAll('.choice').forEach((el) => {
    el.classList.toggle('on', el.querySelector('input').checked);
  });
}

/* 불러오기와 저장 -------------------------------------------------------- */

/**
 * 방식과 키는 이 기기에만 둔다.
 *
 * 기기마다 다르게 고를 수 있어야 하고, 키는 동기화 저장소에 두면 구글 계정을 통해
 * 다른 기기로 옮겨진다.
 */
async function loadSource() {
  const got = await chrome.storage.local.get({ useOwnKey: null });
  if (got.useOwnKey === null) return hasRelay() ? 'trial' : 'own';
  return got.useOwnKey ? 'own' : 'trial';
}

/** 키만 따로 읽는다. 이전 버전이 동기화 저장소에 두었으면 옮기고 지운다 */
async function loadApiKey() {
  const local = await chrome.storage.local.get({ apiKey: '' });
  if (local.apiKey) return local.apiKey;

  const synced = await chrome.storage.sync.get({ apiKey: '' });
  if (synced.apiKey) {
    await chrome.storage.local.set({ apiKey: synced.apiKey });
    await chrome.storage.sync.remove('apiKey');
    return synced.apiKey;
  }
  return '';
}

async function load() {
  const s = await chrome.storage.sync.get(NMT_SYNCED);
  $('apiKey').value = await loadApiKey();
  setSource(await loadSource());
  $('persona').value = s.persona;
  $('myIdentity').value = s.myIdentity;
  $('alwaysShow').value = s.alwaysShow;
  $('alwaysMute').value = s.alwaysMute;
  $('unreadOnly').checked = s.unreadOnly;
  setStrength(s.threshold);

  const hit = [...$('jobSelect').options].find((o) => o.value === s.persona);
  $('jobSelect').value = hit ? hit.value : '';

  $('cacheInfo').textContent = nmtMsg('optCacheCount', await nmtCacheCount());
  $('doneInfo').textContent = nmtMsg('optDoneCount', await nmtDoneCount());

  // 화면에서 찾은 값은 따로 적는다. 입력 예시 자리를 덮으면 어떻게 적는지가 사라진다
  if (!s.myIdentity) {
    const { detectedIdentity } = await chrome.storage.local.get({ detectedIdentity: '' });
    if (detectedIdentity) $('detectedNote').textContent = nmtMsg('optDetected', detectedIdentity);
  }

  renderMode();
}

document.querySelectorAll('input[name="source"]').forEach((r) => {
  r.addEventListener('change', renderMode);
});

document.querySelectorAll('input[name="strength"]').forEach((r) => {
  r.addEventListener('change', markChosen);
});

$('save').addEventListener('click', async () => {
  const apiKey = $('apiKey').value.trim();
  const persona = $('persona').value.trim();

  const useOwnKey = chosenSource() === 'own';
  await chrome.storage.local.set({ apiKey, useOwnKey });
  await chrome.storage.sync.set({
    persona,
    myIdentity: $('myIdentity').value.trim(),
    alwaysShow: $('alwaysShow').value.trim(),
    alwaysMute: $('alwaysMute').value.trim(),
    threshold: getStrength(),
    unreadOnly: $('unreadOnly').checked,
  });

  // 체험을 고르면 키가 없어도 된다. 본인 키를 골랐으면 키가 있어야 한다
  const missing = [];
  if (persona.length < 5) missing.push(nmtMsg('needPersona'));
  if (useOwnKey && !apiKey) missing.push(nmtMsg('needKey'));

  // 같은 줄을 양쪽 목록에 적은 것은 대개 실수다. 규칙상 항상 확인이 이긴다
  const lines = (s) =>
    new Set(
      s
        .split('\n')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
    );
  const muteSet = lines($('alwaysMute').value);
  const both = [...lines($('alwaysShow').value)].filter((x) => muteSet.has(x));

  renderMode();

  const el = $('saved');
  if (both.length) {
    el.style.color = '#93500a';
    el.textContent = nmtMsg('optBothLists', both.join(', '));
    return;
  }
  if (missing.length) {
    el.style.color = '#b42318';
    el.textContent = nmtMsg('optSavedIncomplete', missing.join(', '));
  } else {
    el.style.color = '#1a7f37';
    el.textContent = nmtMsg('optSaved');
    setTimeout(() => (el.textContent = ''), 4000);
  }
});

$('clearCache').addEventListener('click', async () => {
  await nmtCacheClear();
  $('cacheInfo').textContent = nmtMsg('optCacheCount', 0);
});

$('clearDone').addEventListener('click', async () => {
  await nmtDoneClear();
  $('doneInfo').textContent = nmtMsg('optDoneCount', 0);
});

// 툴바 아이콘으로 열면 폭이 좁은 팝업이다. 설정 화면과 같은 문서를 쓰고 모양만 바꾼다
if (new URLSearchParams(location.search).has('popup')) {
  document.body.classList.add('popup');
}

nmtApplyI18n();
fillJobs();
load();
