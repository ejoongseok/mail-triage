/**
 * 메일 화면에 분류 버튼을 띄우고, 눌렀을 때만 판정한다.
 *
 * 자동으로 돌지 않는다. 사용자가 누른 만큼만 호출이 나가므로 비용이 통제된다.
 * 판정 결과는 행 왼쪽 띠와 배지로만 표시한다. 메일을 옮기거나 읽음 처리하거나 지우지 않는다.
 */

const NMT_CONCURRENCY = 4;
const NMT_PRICE_PER_MTOK = 0.042;

let nmtBusy = false;

/**
 * 확장 컨텍스트가 살아 있는가.
 *
 * 확장을 새로고침하거나 스토어에서 업데이트되면 이미 주입된 content script 는 남지만
 * chrome.runtime 이 무효가 된다. 그 상태로 API 를 부르면 Extension context invalidated 가
 * 난다. 버튼을 누르기 전에 먼저 본다.
 */
function nmtAlive() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch (_) {
    return false;
  }
}

/** 죽어 있으면 안내하고 true 를 돌려준다. */
function nmtWarnIfDead() {
  if (nmtAlive()) return false;
  nmtStatus(nmtMsg('contextDead'));
  const btn = document.getElementById('nmt-run');
  if (btn) btn.disabled = true;
  return true;
}

/** 설정 화면을 연다. 컨텍스트가 죽어 있으면 안내만 한다. */
function nmtOpenOptions() {
  try {
    window.open(chrome.runtime.getURL('src/options.html'), '_blank');
  } catch (_) {
    nmtStatus(nmtMsg('contextDead'));
  }
}

/* 설정 ------------------------------------------------------------------ */

/**
 * 설정. API 키는 여기 없다.
 *
 * 키는 background 만 읽는다. 메일 페이지에 주입된 코드가 키를 들고 있을 이유가 없고,
 * 들고 있으면 그만큼 새어 나갈 자리가 는다.
 */
const NMT_DEFAULTS = {
  persona: '',
  myIdentity: '',
  alwaysShow: '',
  alwaysMute: '',
  rowSelector: '',
  threshold: 0.7,
  unreadOnly: false,
};

// 목록에 보이는 행을 전부 본다. 화면에 로드된 것만 대상이라 이 정도면 넉넉하다
const NMT_MAX_PER_RUN = 300;

/**
 * 발신자가 본인인가.
 *
 * 전체메일함에는 보낸 메일이 섞여 있다. 본인이 보낸 것을 모델에 물으면 답장 필요로
 * 판정되는 일이 생긴다. 이름이 일치하면 호출 없이 처리한다.
 */
function nmtIsFromMe(sender, myIdentity) {
  if (!sender || !myIdentity) return false;

  const norm = (s) => s.toLowerCase().replace(/[\s()[\]<>,]/g, '');
  const s = norm(sender);

  return myIdentity
    .split(/[,;\n]/)
    .map((x) => norm(x))
    .filter((x) => x.length >= 2)
    .some((mine) => s.includes(mine) || mine.includes(s));
}

async function nmtSettings() {
  try {
    return { ...NMT_DEFAULTS, ...(await chrome.storage.sync.get(NMT_DEFAULTS)) };
  } catch (_) {
    return NMT_DEFAULTS;
  }
}

/* 패널 ------------------------------------------------------------------ */

function nmtPanel() {
  let el = document.getElementById('nmt-panel');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'nmt-panel';

  // DOM 으로 만든다. 문자열로 조립하면 번역 파일에 섞인 태그가 그대로 주입된다
  const part = (tag, id, cls, text) => {
    const node = document.createElement(tag);
    node.id = id;
    if (cls) node.className = cls;
    if (tag === 'button') node.type = 'button';
    node.textContent = text;
    return node;
  };
  el.append(
    part('button', 'nmt-run', '', nmtMsg('btnRun')),
    part('span', 'nmt-status', '', nmtMsg('statusReady')),
    part('button', 'nmt-clear', 'nmt-sub', nmtMsg('btnClear')),
    part('button', 'nmt-opts', 'nmt-sub', nmtMsg('btnOptions'))
  );
  document.body.appendChild(el);

  el.querySelector('#nmt-run').addEventListener('click', nmtRun);
  el.querySelector('#nmt-clear').addEventListener('click', nmtClearMarks);
  el.querySelector('#nmt-opts').addEventListener('click', nmtOpenOptions);

  return el;
}

function nmtStatus(text, clickable) {
  const el = document.getElementById('nmt-status');
  if (!el) return;
  // 같은 문장을 다시 쓰지 않는다. 목록 관찰자가 이 변경에 다시 불려 끝없이 돈다
  if (el.textContent !== text) el.textContent = text;
  el.classList.toggle('nmt-link', Boolean(clickable));
  el.title = clickable ? nmtMsg('filterHint') : '';
}

/* 화면 상태 --------------------------------------------------------------- */

/**
 * 화면이 지금 무엇을 보여 주고 있는가.
 *
 * 기능을 붙일 때마다 전역 플래그가 하나씩 늘어 서로를 덮어쓰는 일이 반복됐다. 상태는
 * 여기 한 곳에만 두고 화면은 이 값에서만 만든다. 깨지면 안 되는 것들은
 * docs/invariants.md 에 있고 nmtCheckInvariants 가 그중 화면에서 보이는 것을 검사한다.
 */
const nmtView = {
  /** idle 아직 안 돌림, running 도는 중, done 끝남 */
  phase: 'idle',
  /** 확인 대상만 남기고 접었는가 */
  filtered: false,
  /** 사용자가 표시를 지웠는가. 지운 뒤에는 목록 재생성 복원도 하지 않는다 */
  cleared: false,
  /** 판정한 적이 없는 행. 표시가 있는 행과 없는 행이 섞인 이유를 알려야 한다 */
  pending: 0,
};

/**
 * 행이 가질 수 있는 상태. CSS 에 값마다 스타일이 있어야 한다.
 *
 * 코드에서 긁어 모으면 삼항 연산자 안의 값을 놓친다. 검사기가 이 목록을 읽으므로
 * 상태를 늘릴 때 여기에도 적는다.
 */
const NMT_ROW_STATES = ['act', 'low', 'done'];

/**
 * 행의 상태를 정한다. act 확인 필요, low 판정했고 대상 아님, done 목록에서 내려감.
 *
 * 상태는 속성에만 적고 클래스는 nmtPaintRow 가 파생한다. 나눈 이유가 있다. mousedown
 * 단계에서 클래스를 바꾸면 행이 감춰져 뒤따르는 click 이 그 행에 닿지 못하지만, 속성은
 * 레이아웃을 건드리지 않아 클릭이 그대로 간다.
 */
function nmtSetRowState(row, state, paint) {
  row.dataset.nmtState = state;
  if (paint !== false) nmtPaintRow(row);
}

/**
 * 접힘을 상태에 맞춘다. 띠와 흐림은 CSS 가 상태 속성에서 직접 만든다.
 *
 * 클래스를 쓰지 않는 이유가 있다. 메일 서비스가 행을 다시 그릴 때 className 을 통째로
 * 덮어쓰면 클래스만 사라지고 data 속성은 남아, 표시가 조용히 없어진다
 *.
 *
 * allowHide 가 false 면 접힘을 적용하지 않는다. 방금 누른 행에 쓴다. 누른 행이 발밑에서
 * 사라지면 아래 행이 그 자리로 올라와, 다른 메일을 잘못 눌렀다고 느끼게 된다.
 */
function nmtPaintRow(row, allowHide) {
  if (allowHide === false) return;
  if (nmtView.filtered && row.dataset.nmtState !== 'act') row.dataset.nmtHidden = '1';
  else delete row.dataset.nmtHidden;
}

function nmtClearRowState(row) {
  delete row.dataset.nmtState;
  delete row.dataset.nmtHidden;
  delete row.dataset.nmtPrev;
  delete row.dataset.nmtKey;
  delete row.dataset.nmtKind;
}

/** 확인이 필요한 행의 수. 증감으로 관리하면 경로가 늘 때마다 어긋나므로 매번 센다 */
function nmtActionable() {
  return document.querySelectorAll('[data-nmt-state="act"]').length;
}

/** 패널 문구는 여기서만 만든다 */
function nmtRenderStatus() {
  const el = document.getElementById('nmt-status');
  if (!el) return;
  el.onclick = null;
  if (nmtView.phase !== 'done') return;

  const n = nmtActionable();
  let text;
  let clickable = false;

  if (nmtView.filtered) {
    // 접은 상태에서도 남은 건수를 보여 준다. 숫자가 사라지면 처리해도 줄어드는 것이
    // 보이지 않아 기능이 동작하지 않는 것처럼 읽힌다
    text = n ? nmtMsg('filterOn', n) : nmtMsg('filterOnNone');
    clickable = true;
  } else if (n) {
    text = nmtMsg('doneActionable', n);
    clickable = true;
  } else if (nmtView.pending) {
    // 확인할 것이 없다고만 하면, 표시가 없는 행을 보고 규칙이 없다고 읽게 된다
    text = nmtMsg('pendingRows', nmtView.pending);
  } else {
    text = nmtMsg('doneNone');
  }

  nmtStatus(text, clickable);
  if (clickable) el.onclick = () => nmtToggleFilter();
  nmtScheduleCheck();
}

/**
 * 강조되지 않은 행을 접는다. 숫자만 알려 주면 스크롤로 찾아야 하므로 패널 문구 자체를
 * 토글로 쓴다. 메일을 옮기거나 지우는 것이 아니라 화면에서만 감춘다.
 */
function nmtToggleFilter() {
  const rows = document.querySelectorAll('[data-nmt-state]');

  // 메일을 열었다 돌아오면 목록이 다시 그려져 표시가 없다. 패널만 옛 상태로 남으면
  // 눌러도 아무 일이 없는 문장이 된다
  if (!rows.length) {
    nmtView.phase = 'idle';
    nmtView.filtered = false;
    nmtView.pending = 0;
    nmtStatus(nmtMsg('marksGone'));
    return;
  }

  nmtView.filtered = !nmtView.filtered;
  rows.forEach(nmtPaintRow);
  nmtRenderStatus();
}

/* 목록에서 내리기 --------------------------------------------------------- */

/**
 * 내려간 메일의 배지 문구.
 *
 * 확장이 아는 것은 목록에서 내려갔다는 사실뿐이다. 처리함이라고 쓰면 읽기만 하고 답장하지
 * 않은 경우에도 처리했다고 읽히므로, 원래 유형을 남기고 상태만 덧붙인다.
 */
function nmtDoneLabel(kind) {
  const read = nmtMsg('badgeRead');
  const key = NMT_LABEL_KEYS[kind];
  return key ? nmtMsg(key) + ' (' + read + ')' : read;
}

/**
 * 내리기 전 상태를 읽는다.
 *
 * 이 값은 우리가 썼지만 페이지에 있는 속성이라 메일 서비스가 바꿀 수 있다. 쓰는 열쇠만
 * 문자열로 꺼내고 나머지는 버린다.
 */
function nmtReadPrev(row) {
  let raw;
  try {
    raw = JSON.parse(row.dataset.nmtPrev ?? '');
  } catch (_) {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;

  const str = (k) => (typeof raw[k] === 'string' ? raw[k] : '');
  const state = str('state');
  return {
    state: NMT_ROW_STATES.includes(state) ? state : 'low',
    kind: str('kind'),
    text: str('text'),
    title: str('title'),
  };
}

function nmtPaintDoneBadge(badge, kind) {
  badge.dataset.kind = 'done';
  badge.textContent = nmtDoneLabel(kind);
  badge.title = nmtMsg('badgeUndoTip');
}

/**
 * 목록에서 내리거나 되돌린다.
 *
 * paint 가 false 면 상태와 저장만 바꾸고 화면은 그대로 둔다. 메일을 여는 클릭에서 쓴다.
 */
function nmtSetDone(row, on, paint) {
  const badge = row.querySelector('.nmt-badge');
  const mailKey = row.dataset.nmtKey;
  if (!badge || !mailKey) return;

  if (on) {
    if (row.dataset.nmtState === 'done') return;
    row.dataset.nmtPrev = JSON.stringify({
      state: row.dataset.nmtState ?? 'low',
      kind: badge.dataset.kind,
      text: badge.textContent,
      title: badge.title,
    });
    row.dataset.nmtKind = badge.dataset.kind;
    nmtSetRowState(row, 'done', paint);
    if (paint !== false) nmtPaintDoneBadge(badge, row.dataset.nmtKind);
    nmtDoneSet(mailKey, true, row.dataset.nmtKind);
  } else {
    const prev = nmtReadPrev(row);

    // 지난 회차에 내려간 건이라 이 화면에는 복원할 판정이 없다. 배지를 걷고 다시 묻게 둔다
    if (!prev) {
      nmtClearRowState(row);
      badge.remove();
      nmtDoneSet(mailKey, false);
      nmtStatus(nmtMsg('undoneRerun'));
      return;
    }

    nmtSetRowState(row, prev.state);
    badge.dataset.kind = prev.kind ?? 'other';
    badge.textContent = prev.text ?? '';
    badge.title = prev.title ?? '';
    delete row.dataset.nmtPrev;
    delete row.dataset.nmtKind;
    nmtDoneSet(mailKey, false);
  }

  nmtRenderStatus();
}

/** 배지를 누름 단추로 만든다. 행 클릭은 메일 열기이므로 이벤트를 여기서 끊는다 */
function nmtMakeToggle(badge, row) {
  badge.classList.add('nmt-clickable');
  badge.setAttribute('role', 'button');
  badge.tabIndex = 0;

  const swallow = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const toggle = () => nmtSetDone(row, row.dataset.nmtState !== 'done');

  badge.addEventListener('mousedown', swallow);
  badge.addEventListener('click', (e) => {
    swallow(e);
    toggle();
  });
  badge.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    swallow(e);
    toggle();
  });
}

/** 지난 회차에 내려간 메일이다. 호출 없이 배지만 붙인다 */
function nmtMarkDone(row, profile, mailKey, kind) {
  row.querySelector('.nmt-badge')?.remove();
  row.dataset.nmtKey = mailKey;
  if (kind) row.dataset.nmtKind = kind;
  nmtSetRowState(row, 'done');

  const badge = document.createElement('span');
  badge.className = 'nmt-badge';
  nmtPaintDoneBadge(badge, kind);
  nmtMakeToggle(badge, row);

  const slot = nmtBadgeSlot(row, profile);
  slot.parent.insertBefore(badge, slot.before);
}

/* 여는 클릭 --------------------------------------------------------------- */

let nmtOpenWatching = false;

/** 메일을 여는 클릭이 아닌 것. 선택과 별표와 보관과 삭제는 그 행을 읽은 것이 아니다 */
function nmtIsSideAction(el) {
  if (el.closest('input, [role="checkbox"]')) return true;

  const labelled = el.closest('[aria-label], [title], [data-tooltip]');
  if (!labelled) return false;

  const text = [
    labelled.getAttribute('aria-label'),
    labelled.getAttribute('title'),
    labelled.getAttribute('data-tooltip'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /star|별표|중요|즐겨|archive|보관|snooze|다시 알림|delete|삭제|스팸|spam|읽음|unread/.test(
    text
  );
}

/**
 * 메일을 여는 것 자체를 처리로 읽는다.
 *
 * 열어 본 메일을 배지로 한 번 더 내리게 하면 같은 사실을 두 번 알리는 일이 된다.
 * 미뤄 둘 메일은 돌아온 뒤 배지를 눌러 올린다.
 *
 * 리스너는 문서에 하나만 둔다. 행마다 달면 메일을 열었다 돌아올 때 목록이 새 DOM 으로
 * 바뀌면서 사라지고, 복원이 끝나기 전에 누른 메일은 아무도 듣지 않는다.
 *
 * mousedown 과 click 을 모두 듣는다. 메일 서비스에 따라 mousedown 에서 화면을 바꿔
 * click 이 오지 않는다. 먼저 잡힌 쪽에서 상태가 done 이 되므로 두 번 기록되지 않는다.
 */
function nmtWatchOpens() {
  if (nmtOpenWatching) return;
  nmtOpenWatching = true;

  const handler = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;

    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('.nmt-badge')) return;
    if (nmtIsSideAction(t)) return;

    const row = t.closest('[data-nmt-state="act"]');
    if (!row) return;

    // 메일 서비스가 행 DOM 을 재사용하면 표시가 남은 채 다른 메일이 들어온다.
    // 키를 다시 뽑아 어긋나면 그 표시를 걷고 손대지 않는다
    const profile = nmtLastCtx?.profile;
    const fresh = nmtRowKey(row, nmtExtract(row, profile), profile);
    if (fresh !== row.dataset.nmtKey) {
      nmtClearRowState(row);
      row.querySelector('.nmt-badge')?.remove();
      return;
    }

    // 상태와 저장만 바꾼다. 여기서 행을 감추거나 띠를 걷으면 뒤따르는 mouseup 과 click 이
    // 그 행에 닿지 못해 메일이 열리지 않는다
    nmtSetDone(row, true, false);

    // 메일이 열리면 목록째 사라지므로 다시 그릴 것이 없다. 목록이 남는 화면에서만 맞춘다
    setTimeout(() => {
      if (!row.isConnected || row.dataset.nmtState !== 'done') return;
      nmtPaintRow(row, false);
      const badge = row.querySelector('.nmt-badge');
      if (badge && badge.dataset.kind !== 'done') nmtPaintDoneBadge(badge, row.dataset.nmtKind);
      nmtRenderStatus();
    }, 400);
  };

  document.addEventListener('mousedown', handler, true);
  document.addEventListener('click', handler, true);
}

/* 불변식 ----------------------------------------------------------------- */

const NMT_ACTION_KINDS = new Set(['reply', 'task', 'approval', 'schedule']);

let nmtCheckTimer = null;

/** 여는 클릭은 400ms 뒤에 화면을 맞추므로 그보다 늦게 본다 */
function nmtScheduleCheck() {
  clearTimeout(nmtCheckTimer);
  nmtCheckTimer = setTimeout(nmtCheckInvariants, 700);
}

/**
 * 화면이 스스로 어긋났는지 본다.
 *
 * docs/invariants.md 의 목록 중 화면에서 즉시 볼 수 있는 것만 검사한다. 고치지 않고
 * 콘솔에 남긴다. 쓰는 사람이 신고하기 전에 만든 사람이 먼저 보는 것이 목적이다.
 */
function nmtCheckInvariants() {
  const bad = [];

  // 행동형 배지가 붙은 행은 반드시 강조된다
  document.querySelectorAll('.nmt-badge').forEach((b) => {
    const row = b.closest('[data-nmt-state]');
    if (!row) return;
    if (NMT_ACTION_KINDS.has(b.dataset.kind) && row.dataset.nmtState !== 'act') {
      bad.push('강조 없는 행동형 배지 ' + b.dataset.kind);
    }
  });

  // 접지 않았는데 감춰진 행이 있으면 안 된다
  if (!nmtView.filtered && document.querySelectorAll('[data-nmt-hidden]').length) {
    bad.push('접지 않았는데 감춰진 행이 있다');
  }

  // 표시가 붙은 행은 모두 식별자를 가진다. 없으면 눌러도 기록되지 않는다
  const keyless = [...document.querySelectorAll('[data-nmt-state="act"]')].filter(
    (r) => !r.dataset.nmtKey
  );
  if (keyless.length) bad.push('식별자가 없는 강조 행 ' + keyless.length + '개');

  if (bad.length) console.warn('[mail-triage] 불변식 위반', bad);
  return bad;
}

/* 진단 (실패했을 때만 콘솔에 남긴다) -------------------------------------- */

/**
 * 목록을 못 찾거나 추출이 빈 경우에만 부른다. 사용자가 누르는 기능이 아니라
 * 문제를 알릴 때 쓰는 기록이다. 호출이 나가지 않으므로 비용이 0이다.
 */
function nmtDiagnose(rows, how, profile) {
  console.warn('[mail-triage] lookup:', how, '/ profile:', profile?.id ?? 'none');
  if (!rows.length) {
    console.warn('[mail-triage] no rows found. Set a row selector in the troubleshooting section of the settings page.');
    return;
  }

  const sample = rows.slice(0, 3).map((row) => {
    const mail = nmtExtract(row, profile);
    return {
      subject: mail.subject.slice(0, 40),
      sender: mail.sender.slice(0, 20),
      unread: nmtIsUnread(row, profile),
      key: nmtRowKey(row, mail, profile),
    };
  });

  console.table(sample);
}

/* 목록 재생성 대응 --------------------------------------------------------- */

/** 마지막 회차의 설정. 목록이 다시 그려졌을 때 호출 없이 되살리는 데 쓴다 */
let nmtLastCtx = null;
let nmtWatching = false;

/**
 * 목록이 바뀌면 표시를 다시 맞춘다. 판정을 새로 부르지 않는다.
 *
 * 메일을 열었다 돌아오거나 페이지를 넘기면 목록이 다시 그려진다. 새 DOM 으로 바뀌면 표시가
 * 사라지고, 행을 재사용하면 표시가 남은 채 다른 메일이 들어온다. 어느 쪽이든 행마다 지금
 * 담긴 메일과 표시의 메일이 같은지를 보고 맞춘다. 캐시에 없는 메일은 세어만 둔다.
 *
 * 확인할 메일만 보는 상태는 이어 간다. 메일을 열었다 돌아올 때마다 풀리면 남은 것을 보려고
 * 매번 다시 눌러야 한다. 다만 확인할 메일이 하나도 없고 판정하지 않은 메일만 있는 목록에서는
 * 좁힐 것이 없으므로 푼다.
 */
async function nmtWatchList() {
  if (nmtWatching) return;
  nmtWatching = true;

  let timer = null;
  let since = 0;
  const observer = new MutationObserver((records) => {
    // 패널의 문구는 목록이 아니다. 분류 중에는 판정마다 진행률이 바뀌어, 이것까지 세면
    // 기다림이 끝없이 늘어나 도는 동안 한 번도 맞추지 못한다
    if (records.every((r) => r.target instanceof Element && r.target.closest('#nmt-panel'))) return;

    // 변화가 멎고 250ms 뒤에 맞추되, 변화가 이어져도 1초에 한 번은 맞춘다
    const now = Date.now();
    if (!timer) since = now;
    clearTimeout(timer);
    timer = setTimeout(
      () => {
        timer = null;
        nmtRepaint();
      },
      Math.max(0, Math.min(250, 1000 - (now - since)))
    );
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

async function nmtRepaint() {
  if (nmtView.cleared || !nmtLastCtx) return;
  if (!nmtAlive()) return;

  const { settings, profile, identity } = nmtLastCtx;
  const { rows } = nmtFindRows(settings.rowSelector);
  if (!rows.length) return;

  // 분류가 도는 동안에는 다른 메일로 넘어간 표시만 걷는다. 붙이는 것은 분류가 하고,
  // 끝나면 이 함수가 한 번 더 불려 나머지를 맞춘다
  if (nmtBusy) {
    for (const row of rows) {
      const mail = nmtExtract(row, profile);
      if (mail.subject || mail.sender) nmtKeepMark(row, nmtRowKey(row, mail, profile));
    }
    return;
  }

  let pending = 0;
  for (const row of rows) {
    const mail = nmtExtract(row, profile);
    if (!mail.subject && !mail.sender) continue;

    const mailKey = nmtRowKey(row, mail, profile);
    if (nmtKeepMark(row, mailKey)) continue;
    if (settings.unreadOnly && nmtIsUnread(row, profile) === false) continue;

    const doneRec = await nmtDoneGet(mailKey);
    // 기다리는 사이 메일 서비스가 이 행에 다른 메일을 넣었을 수 있다
    if (!nmtStill(row, mailKey, profile)) continue;
    if (doneRec) {
      nmtMarkDone(row, profile, mailKey, doneRec.kind);
      continue;
    }

    mail.email = nmtSenderEmail(row);
    const rule = nmtSenderRule(mail, settings.alwaysShow, settings.alwaysMute);
    if (rule === 'show') {
      nmtMark(row, { action: 1, kind: 'pinned', kindConfidence: 1, deadline: 0 }, settings, profile, mailKey);
      continue;
    }
    if (rule === 'mute') {
      nmtMark(row, { action: 0, kind: 'muted', kindConfidence: 1, deadline: 0 }, settings, profile, mailKey);
      continue;
    }
    if (nmtIsNoReply(mail.email)) {
      nmtMark(row, { action: 0, kind: 'system', kindConfidence: 1, deadline: 0 }, settings, profile, mailKey);
      continue;
    }
    if (nmtIsFromMe(mail.sender, identity) || nmtIsFromMe(mail.email, identity)) {
      nmtMark(row, { action: 0, kind: 'sent', kindConfidence: 1, deadline: 0 }, settings, profile, mailKey);
      continue;
    }

    const hit = await nmtCacheGet(nmtVerdictKey(mailKey, settings.persona));
    if (!nmtStill(row, mailKey, profile)) continue;
    if (!hit || hit.error) {
      // 판정한 적이 없는 메일이다. 호출하지 않고 세어만 둔다
      pending += 1;
      continue;
    }

    nmtMark(row, hit, settings, profile, mailKey);
  }

  nmtView.pending = pending;
  nmtView.phase = 'done';

  // 좁힐 것이 없는 목록이다. 판정하지 않은 메일만 있는 쪽으로 넘어온 경우다
  if (nmtView.filtered && pending && !nmtActionable()) {
    nmtView.filtered = false;
    document.querySelectorAll('[data-nmt-state]').forEach((r) => nmtPaintRow(r));
  }
  nmtRenderStatus();
}

/**
 * 행의 표시가 지금 담긴 메일 것이면 참을 돌려준다. 아니면 걷어내고 거짓을 돌려준다.
 *
 * 메일 서비스가 행을 재사용하면 표시가 남은 채 다른 메일이 들어오고, 칸만 다시 그리면
 * 상태는 남고 배지만 사라진다. 둘 다 그 행을 새로 표시해야 한다.
 */
function nmtKeepMark(row, mailKey) {
  const badge = row.querySelector('.nmt-badge');
  const state = row.dataset.nmtState;
  if (state && badge && row.dataset.nmtKey === mailKey) return true;
  if (state || badge) {
    nmtClearRowState(row);
    badge?.remove();
  }
  return false;
}

/** 그 행에 아직 같은 메일이 들어 있는가. 판정을 기다리는 사이 페이지가 넘어갈 수 있다 */
function nmtStill(row, mailKey, profile) {
  return row.isConnected && nmtRowKey(row, nmtExtract(row, profile), profile) === mailKey;
}

/* 실행 ------------------------------------------------------------------ */

async function nmtRun() {
  if (nmtBusy) return;
  if (nmtWarnIfDead()) return;

  const settings = await nmtSettings();

  // 키와 역할은 둘 다 있어야 한다. 역할이 없으면 모델은 "일반적으로 중요해 보이는 메일"을
  // 고르는데, 그것은 받는 사람이 누구든 같은 답이라 이 확장을 쓸 이유가 없어진다.
  // 키가 없으면 중계로 가고, 중계도 없으면 background 가 needKey 로 알려 준다
  const missing = [];
  if (!settings.persona || settings.persona.length < 5) missing.push(nmtMsg('needPersona'));

  if (missing.length) {
    nmtStatus(nmtMsg('needSetup', missing.join(', ')));
    nmtOpenOptions();
    return;
  }

  const { rows, how, profile } = nmtFindRows(settings.rowSelector);
  if (!rows.length) {
    nmtStatus(nmtMsg('noRows'));
    nmtDiagnose(rows, how, profile);
    return;
  }

  // 설정에 이름이 없으면 화면에서 찾아 쓴다. 찾은 값은 설정 화면에 보여 주려고 저장한다
  let identity = settings.myIdentity;
  if (!identity) {
    const detected = nmtDetectMe();
    if (detected) {
      identity = detected;
      try {
        chrome.storage.local.set({ detectedIdentity: detected }).catch(() => {});
      } catch (_) {
        // 컨텍스트가 죽어도 이번 회차는 감지값으로 진행한다
      }
    }
  }

  // 관찰은 분류를 시작할 때 켠다. 처음 분류하는 도중에 페이지를 넘겨도 남은 표시를 걷는다
  nmtLastCtx = { settings, profile, identity };
  nmtWatchList();

  const jobs = [];
  let skippedSent = 0;
  let skippedAuto = 0;
  let skippedDone = 0;
  let pinned = 0;
  let muted = 0;

  for (const row of rows) {
    const mail = nmtExtract(row, profile);
    if (!mail.subject && !mail.sender) continue;

    const mailKey = nmtRowKey(row, mail, profile);
    // 행이 재사용되면 다른 메일의 표시가 남아 있다. 건너뛰는 행에도 남지 않게 먼저 걷는다
    nmtKeepMark(row, mailKey);
    if (settings.unreadOnly && nmtIsUnread(row, profile) === false) continue;

    // 사용자가 처리했다고 표시한 메일은 다시 묻지 않는다. 호출도 나가지 않는다
    const doneRec = await nmtDoneGet(mailKey);
    if (doneRec) {
      nmtMarkDone(row, profile, mailKey, doneRec.kind);
      skippedDone += 1;
      continue;
    }

    mail.email = nmtSenderEmail(row);

    // 사용자가 직접 정한 것이 먼저다. 자동 발송 주소라도 반드시 봐야 하는 알림이 있다
    const rule = nmtSenderRule(mail, settings.alwaysShow, settings.alwaysMute);
    if (rule === 'show') {
      nmtMark(row, { action: 1, kind: 'pinned', kindConfidence: 1, deadline: 0 }, settings, profile, mailKey);
      pinned += 1;
      continue;
    }
    if (rule === 'mute') {
      nmtMark(row, { action: 0, kind: 'muted', kindConfidence: 1, deadline: 0 }, settings, profile, mailKey);
      muted += 1;
      continue;
    }

    // 회신 불가 주소는 사람이 보낸 것이 아니다. 호출 없이 판정한다
    if (nmtIsNoReply(mail.email)) {
      nmtMark(row, { action: 0, kind: 'system', kindConfidence: 1, deadline: 0 }, settings, profile, mailKey);
      skippedAuto += 1;
      continue;
    }

    // 본인이 보낸 메일은 호출 없이 표시만 한다
    if (nmtIsFromMe(mail.sender, identity) || nmtIsFromMe(mail.email, identity)) {
      nmtMark(row, { action: 0, kind: 'sent', kindConfidence: 1, deadline: 0 }, settings, profile, mailKey);
      skippedSent += 1;
      continue;
    }

    // 캐시 키에 역할 해시를 섞는다. 역할을 바꾸면 판정이 달라져야 하므로 옛 결과를 쓰면 안 된다
    jobs.push({ row, mail, mailKey, key: nmtVerdictKey(mailKey, settings.persona) });

    if (jobs.length >= NMT_MAX_PER_RUN) break;
  }

  if (!jobs.length) {
    nmtStatus(nmtMsg('nothingToJudge'));
    nmtDiagnose(rows, how, profile);
    return;
  }

  // 프로파일이 안 맞아 구조로 추측한 경우다. 제목과 발신자가 어긋날 수 있다
  if (how === 'heuristic') nmtDiagnose(rows, how, profile);

  nmtBusy = true;
  document.getElementById('nmt-run').disabled = true;

  let done = 0;
  let called = 0;
  let cached = 0;
  let failed = 0;
  let tokens = 0;
  const kindCount = {};
  let firstError = '';

  nmtView.phase = 'running';
  nmtView.filtered = false;
  nmtView.cleared = false;
  nmtView.pending = 0;
  // 접은 채 다시 분류하면 감춰진 행이 그대로 남는다
  document.querySelectorAll('[data-nmt-hidden]').forEach((r) => delete r.dataset.nmtHidden);

  const update = () => nmtStatus(nmtMsg('progress', Math.round((done / jobs.length) * 100)));
  update();

  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const job = queue.shift();

      const hit = await nmtCacheGet(job.key);
      if (hit && !hit.error) {
        if (nmtStill(job.row, job.mailKey, profile)) nmtMark(job.row, hit, settings, profile, job.mailKey);
        kindCount[hit.kind] = (kindCount[hit.kind] ?? 0) + 1;
        cached += 1;
        done += 1;
        update();
        continue;
      }

      const verdict = await nmtJudge(job.mail, settings);
      called += 1;

      if (verdict.error) {
        failed += 1;
        if (!firstError) firstError = verdict.error;
        // 인증 실패나 한도 초과는 남은 건을 호출해도 같은 결과이므로 중단한다
        if (verdict.fatal) queue.length = 0;
      } else {
        tokens += verdict.tokens ?? 0;
        await nmtCacheSet(job.key, verdict);
        // 기다리는 사이 페이지를 넘겼으면 붙이지 않는다. 받아 둔 판정은 그 메일이 다시
        // 보일 때 목록 맞추기가 붙인다
        if (nmtStill(job.row, job.mailKey, profile)) nmtMark(job.row, verdict, settings, profile, job.mailKey);
        kindCount[verdict.kind] = (kindCount[verdict.kind] ?? 0) + 1;
      }

      done += 1;
      update();
    }
  };

  await Promise.all(Array.from({ length: NMT_CONCURRENCY }, worker));

  // 사용자가 알고 싶은 것은 봐야 할 메일이 몇 건인가 하나다.
  // 호출 수와 캐시와 비용은 개발자용이므로 콘솔에만 남긴다
  const cost = (tokens / 1_000_000) * NMT_PRICE_PER_MTOK;
  console.log('[mail-triage]', {
    rows: rows.length,
    judged: done,
    calls: called,
    cached,
    skippedAuto,
    skippedSent,
    skippedDone,
    pinned,
    muted,
    actionable: nmtActionable(),
    // actionable 은 행동 필요 확률이 문턱을 넘은 수이고 kinds 는 유형 분포다.
    // 두 질문이 독립이라 "답장 필요" 유형인데 행동 확률이 낮은 건이 나올 수 있다
    kinds: kindCount,
    estimatedCostUsd: Number(cost.toFixed(5)),
  });

  const statusEl = document.getElementById('nmt-status');
  if (statusEl) statusEl.onclick = null;

  if (firstError) {
    nmtStatus(firstError);
  } else if (done < jobs.length) {
    nmtStatus(nmtMsg('donePartial', done));
  } else {
    nmtView.phase = 'done';
    nmtWatchOpens();
  }

  nmtBusy = false;
  document.getElementById('nmt-run').disabled = false;

  // 도는 동안 페이지를 넘겼을 수 있다. 받아 둔 판정으로 지금 화면을 맞추고 안내를 낸다
  if (nmtView.phase === 'done') await nmtRepaint();
}

/* 표시 ------------------------------------------------------------------ */

/**
 * 화면에 쓸 배지.
 *
 * 판정은 두 질문으로 나뉜다. 종류(분류)와 내 행동이 필요한가(확률)다. 나눈 것은 구현
 * 사정이고, 두 답을 그대로 내보내면 같은 "답장 필요" 가 어떤 행은 강조되고 어떤 행은
 * 아닌 화면이 된다. 종류가 답장 필요여도 그 일이 받는 사람 몫이 아니면 확률이 낮은데,
 * 화면만 보는 사람에게는 규칙이 없는 것으로 읽힌다.
 *
 * 그래서 배지는 종합 판정 하나만 말한다. 강조된 행에만 행동형 배지가 붙고, 강조되지
 * 않은 행은 왜 아닌지를 말한다. 원래 분류는 툴팁에 남긴다.
 */
function nmtBadgeKind(kind, needsAction) {
  if (needsAction) return kind;
  // 사용자가 직접 정한 것과, 왜 강조하지 않는지 말해 주는 분류는 그대로 둔다
  if (kind === 'muted' || kind === 'system' || kind === 'sent' || kind === 'vendor') return kind;
  return 'fyi';
}

const NMT_LABEL_KEYS = {
  pinned: 'kindPinned',
  muted: 'kindMuted',
  reply: 'kindReply',
  task: 'kindTask',
  approval: 'kindApproval',
  schedule: 'kindSchedule',
  fyi: 'kindFyi',
  vendor: 'kindVendor',
  system: 'kindSystem',
  sent: 'kindSent',
  other: 'kindOther',
};

/**
 * 배지를 넣을 자리를 찾는다.
 *
 * 제목을 감싼 block 컨테이너 안의 첫 자식 앞에 넣는다. block 컨테이너 자체에 넣으면
 * 형제 블록이 다음 줄로 밀려 행이 두 줄이 된다.
 * 제목 링크 안에 넣으면 overflow hidden 에 잘린다.
 */
function nmtBadgeSlot(row, profile) {
  const p = profile ?? nmtProfile();
  const title = p ? row.querySelector(p.subject) : null;
  if (!title) return { parent: row, before: row.firstChild };

  let node = title;
  while (node && node !== row) {
    const parent = node.parentElement;
    if (!parent || parent === row) break;
    if (parent.tagName === 'DIV') return { parent, before: node };
    node = parent;
  }
  return { parent: title.parentElement ?? row, before: title };
}

function nmtMark(row, v, settings, profile, mailKey) {
  nmtClearRowState(row);
  row.querySelector('.nmt-badge')?.remove();

  // 문턱이 결정선이다. 그 아래를 따로 나누어 보여 주면 애매하다는 판단을 사용자에게
  // 떠넘기는 것이 된다. 경계를 옮기고 싶으면 설정의 강조 강도를 쓴다
  const needsAction = v.action >= settings.threshold;
  if (mailKey) row.dataset.nmtKey = mailKey;
  nmtSetRowState(row, needsAction ? 'act' : 'low');



  const shown = nmtBadgeKind(v.kind, needsAction);

  const badge = document.createElement('span');
  badge.className = 'nmt-badge';
  badge.dataset.kind = shown;
  badge.textContent = NMT_LABEL_KEYS[shown] ? nmtMsg(NMT_LABEL_KEYS[shown]) : shown;
  // 기한은 확인 대상인 행에서만 뜻이 있다
  if (needsAction && v.deadline >= 0.7) badge.textContent += ' ' + nmtMsg('badgeDeadline');
  // 읽음 여부는 판정에 넣지 않는다. 화면에 사실로만 적는다
  if (nmtIsUnread(row, profile) === false) badge.textContent += ' (' + nmtMsg('badgeRead') + ')';

  // 강등된 경우 원래 분류를 툴팁에 남긴다. 화면에서 지웠다고 사실까지 버리지는 않는다
  const raw = shown === v.kind ? '' : nmtMsg('badgeRaw', nmtMsg(NMT_LABEL_KEYS[v.kind] ?? 'kindOther'));
  badge.title =
    nmtMsg('badgeTip', (v.action * 100).toFixed(0), (v.kindConfidence * 100).toFixed(0)) + raw;

  // 강조된 행에 건다. 흐린 행과 자동발송은 애초에 확인 목록에 없어 내릴 것이 없고,
  // 띠 색에 따라 되고 안 되면 사용자가 규칙을 예측할 수 없다
  if (needsAction && mailKey) {
    // 확률은 툴팁에 남긴다. 누를 수 있다는 사실이 먼저 읽혀야 한다
    badge.title = nmtMsg('badgeDoneTip') + ' (' + badge.title + ')';
    nmtMakeToggle(badge, row);
  }

  const slot = nmtBadgeSlot(row, profile);
  slot.parent.insertBefore(badge, slot.before);
}

/** 붙여 둔 띠와 배지만 걷어낸다. 새로고침과 달리 스크롤 위치가 유지된다. */
function nmtClearMarks() {
  nmtView.phase = 'idle';
  nmtView.filtered = false;
  nmtView.pending = 0;
  // 목록 재생성 복원은 배지가 없다는 것을 신호로 삼는데, 그것만으로는 사용자가 지운 것과
  // 메일 서비스가 다시 그린 것을 구별할 수 없어 지우자마자 되살아난다
  nmtView.cleared = true;

  document.querySelectorAll('.nmt-badge').forEach((b) => b.remove());
  document.querySelectorAll('[data-nmt-state]').forEach(nmtClearRowState);
  document.querySelectorAll('[data-nmt-hidden]').forEach((r) => delete r.dataset.nmtHidden);

  nmtStatus(nmtMsg('marksCleared'));
}


/* 진입 ------------------------------------------------------------------ */

// 시험에서 함수만 불러올 때는 화면을 만들지 않는다
if (typeof document !== 'undefined' && document.body) nmtPanel();
