/**
 * 메일 목록의 DOM 구조를 찾는다.
 *
 * 사이트마다 프로파일을 둔다. 프로파일이 안 맞으면 구조 휴리스틱으로 떨어진다.
 *
 * 두 사이트가 같은 것을 다른 방식으로 담는다.
 *   읽음 여부   웍스는 자식 요소(.icoRead.yes), 네이버는 행 클래스(read)
 *   메일 ID     웍스는 링크 질의문자열(nMailId=), 네이버는 행 클래스(mail-745)와 경로
 *   제목        둘 다 접두 라벨이 섞인다. 웍스는 .folderName, 네이버는 .mailbox_title
 *
 * 네이버 계열은 스크린리더용 텍스트를 span.blind 로 심어 둔다. 걷어내지 않으면
 * 제목이 "메일 제목 실제제목" 으로 들어온다.
 *
 * 주소 패턴에는 앵커를 붙인다. 없으면 mail.google.com.example 같은 남의 도메인이
 * 걸린다. manifest 의 권한이 막아 주지만 그것이 유일한 방어이면 권한이 넓어질 때
 * 함께 뚫린다.
 */

const NMT_PROFILES = [
  {
    id: 'naverworks',
    match: /(^|\.)worksmobile\.com$/,
    rows: '[class*="mailList"] > li',
    subject: 'strong.mail_title',
    sender: 'span.sender_name',
    preview: null,
    idSelector: 'a[href*="nMailId="]',
    idPattern: /nMailId=(\d+)/,
    readChildMark: null,
    readRowClass: null,
    unreadRowClass: 'notRead',
  },
  {
    // Gmail 은 읽음과 안읽음에서 클래스가 갈린다(안읽음 zE 는 span.zF 와 span.bqe,
    // 읽음 yO 는 span.yP 와 클래스 없는 span). .y6 와 .y2 와 span.bA4 는 양쪽 공통이라
    // 그쪽을 쓴다. 스레드 ID 는 행이 아니라 자손 요소에 붙는다.
    id: 'gmail',
    // 로컬 주소도 받는다. test/fixtures 의 데모 화면이 이 구조를 쓴다. manifest 에
    // 로컬 권한이 없으면 확장이 그 페이지에 주입되지 않으므로 배포본에서는 열리지 않는다
    match: /^mail\.google\.com$|^localhost$|^127\.0\.0\.1$/,
    rows: 'tr.zA',
    subject: '.y6',
    sender: 'span.bA4',
    preview: '.y2',
    idSelector: '[data-legacy-thread-id]',
    idAttr: 'data-legacy-thread-id',
    readChildMark: null,
    readRowClass: 'yO',
  },
  {
    id: 'naver',
    match: /^mail\.naver\.com$/,
    rows: '.mail_list > li',
    subject: '.mail_title .text',
    sender: 'button.button_sender',
    preview: null,
    idSelector: 'a.mail_title_link',
    idPattern: /read\/\d+\/(\d+)/,
    idRowClassPattern: /\bmail-(\d+)\b/,
    readChildMark: null,
    readRowClass: 'read',
  },
];

/** 스크린리더용 텍스트와 접두 라벨. 제목 앞에 붙어 들어온다. */
const NMT_NOISE = '.blind, .screen_out, .sr-only, .folderName, .mailbox_title';

/** 목록이 아니라 메뉴나 머리말에 있는 요소를 거른다. */
const NMT_CHROME_ZONES =
  'nav, header, aside, footer, [role="navigation"], [role="banner"], [class*="gnb"], [class*="lnb"], [id*="gnb"]';

/** 현재 페이지에 맞는 프로파일. 없으면 null. */
function nmtProfile() {
  return NMT_PROFILES.find((p) => p.match.test(location.hostname)) ?? null;
}

/** 스크린리더용 텍스트를 걷어낸 순수 텍스트. */
function nmtText(el) {
  if (!el) return '';
  const copy = el.cloneNode(true);
  copy.querySelectorAll(NMT_NOISE).forEach((n) => n.remove());
  return (copy.innerText || copy.textContent || '').replace(/\s+/g, ' ').trim();
}

/** 메일 행을 찾는다. */
function nmtFindRows(userSelector) {
  const profile = nmtProfile();
  const tries = [];
  if (userSelector) tries.push(userSelector);
  if (profile) tries.push(profile.rows);

  for (const sel of tries) {
    try {
      const found = document.querySelectorAll(sel);
      if (found.length >= 3) {
        return { rows: [...found], how: `selector:${sel}`, profile };
      }
    } catch (_) {
      // 잘못된 셀렉터는 건너뛴다
    }
  }

  const guessed = nmtGuessRows();
  if (guessed.length >= 3) return { rows: guessed, how: 'heuristic', profile };
  return { rows: [], how: 'none', profile };
}

/**
 * 프로파일이 없을 때의 추측.
 *
 * 개수가 가장 많은 묶음을 고르면 틀린다. 네이버 메일에서 li[class*="mail"] 은 51개가
 * 잡히는데 진짜 목록은 30개이고 나머지는 상단 메뉴의 메일 아이콘이다.
 * 그래서 셋을 건다.
 *   1) 메뉴와 머리말 영역 안의 요소는 버린다
 *   2) 평균 글자 수가 15자 미만인 묶음은 버린다(메뉴 항목은 짧다)
 *   3) 남은 것 중 행 수 곱하기 평균 글자 수가 가장 큰 묶음을 고른다
 */
function nmtGuessRows() {
  const byParent = new Map();

  for (const a of document.querySelectorAll('a')) {
    if (a.closest(NMT_CHROME_ZONES)) continue;

    let node = a.parentElement;
    let hops = 0;
    while (node && hops < 5) {
      const tag = node.tagName;
      if ((tag === 'LI' || tag === 'TR') && node.parentElement) {
        const key = node.parentElement;
        if (!byParent.has(key)) byParent.set(key, new Set());
        byParent.get(key).add(node);
        break;
      }
      node = node.parentElement;
      hops += 1;
    }
  }

  let best = [];
  let bestScore = 0;

  for (const set of byParent.values()) {
    const rows = [...set];
    if (rows.length < 3) continue;

    const sample = rows.slice(0, 5);
    const avgLen = sample.reduce((sum, r) => sum + nmtText(r).length, 0) / sample.length;
    if (avgLen < 15) continue;

    const score = rows.length * avgLen;
    if (score > bestScore) {
      bestScore = score;
      best = rows;
    }
  }

  return best.length >= 3 ? best : [];
}

/** 행 하나에서 제목과 발신자와 미리보기를 뽑는다. */
function nmtExtract(row, profile) {
  const p = profile ?? nmtProfile();

  let subject = p ? nmtText(row.querySelector(p.subject)) : '';
  let sender = p ? nmtText(row.querySelector(p.sender)) : '';
  const preview = p?.preview ? nmtText(row.querySelector(p.preview)) : '';

  // 프로파일이 안 맞으면 가장 긴 텍스트를 제목으로 본다
  if (!subject) {
    const texts = [...row.querySelectorAll('a, strong, span')]
      .map((el) => nmtText(el))
      .filter((t) => t.length > 1);
    subject = texts.sort((a, b) => b.length - a.length)[0] ?? '';
  }
  if (!sender) {
    const bits = [...row.querySelectorAll('button, span, em')]
      .map((el) => nmtText(el))
      .filter((t) => t && t !== subject && t.length <= 30);
    sender = bits[0] ?? '';
  }

  return { subject, sender, preview };
}

/**
 * 발신자의 메일 주소.
 *
 * 두 사이트 모두 발신자 요소의 title 에 `"이름" <주소>` 를 넣어 둔다.
 * 셀렉터를 고정하지 않고 행 안의 title 과 aria-label 을 훑는다. 화면 구조가 바뀌어도
 * 이 형식은 남을 가능성이 높다.
 */
function nmtSenderEmail(row) {
  // Gmail 은 span[email] 속성에 주소를 직접 넣는다
  const direct = row.querySelector('[email]')?.getAttribute('email');
  if (direct && direct.includes('@')) return direct;

  for (const el of row.querySelectorAll('[title], [aria-label]')) {
    const v = el.getAttribute('title') || el.getAttribute('aria-label') || '';
    const m = v.match(/<([\w.+-]+@[\w.-]+)>/) || v.match(/\b([\w.+-]+@[\w.-]+\.[a-z]{2,})\b/i);
    if (m) return m[1];
  }
  return '';
}

/** 사람이 쓰지 않는 주소의 아이디. 숫자 꼬리는 떼고 본다 */
const NMT_AUTO_LOCALS = new Set([
  'noreply', 'nreply', 'donotreply',
  'auto', 'automated', 'automation', 'automailer',
  'notification', 'notifications', 'notify', 'noti',
  'alert', 'alerts', 'alerting',
  'mailer', 'daemon', 'mailerdaemon', 'postmaster',
  'bounce', 'bounces', 'return', 'returns',
  'system', 'systems', 'robot', 'bot',
]);

/**
 * 사용자가 직접 지정한 목록에 맞는가.
 *
 * 이 판정은 모델보다 앞선다. 확실히 아는 것을 확률에 맡길 이유가 없고, 무엇보다
 * 자동 발송 주소는 모델에 닿기도 전에 걸러지기 때문이다. 배포 실패나 결제 실패처럼
 * 회신할 수 없는 주소에서 오지만 반드시 봐야 하는 알림이 있다.
 *
 * 발신자와 제목을 함께 본다. 보내는 사람으로 가를 수 없는 것이 있기 때문이다. 웨비나
 * 초대나 프로모션은 보내는 곳이 매번 다르고, 특정 프로젝트 이름이 든 메일은 누가
 * 보내든 봐야 한다. 칸을 넷으로 늘리는 대신 한 목록이 둘 다 맡는다.
 *
 * 한 줄에 하나씩 적고, 들어 있기만 하면 맞는 것으로 본다. 주소 전체를 적으면 그 사람만,
 * 도메인만 적으면 그 회사 전체가 걸린다. 한 글자짜리는 아무 데나 맞으므로 무시한다.
 */
function nmtSenderMatchLength(mail, list) {
  if (!list) return 0;

  const hay = ((mail.email || '') + ' ' + (mail.sender || '') + ' ' + (mail.subject || ''))
    .toLowerCase();
  if (!hay.trim()) return 0;

  return list
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length >= 2 && hay.includes(line))
    .reduce((longest, line) => Math.max(longest, line.length), 0);
}

/**
 * 두 목록 중 어느 쪽이 이기는가. 'show' 와 'mute' 와 빈 문자열을 돌려준다.
 *
 * 같은 발신자가 양쪽에 걸릴 수 있다. 도메인 전체를 무시로 두고 그중 한 사람만 확인으로
 * 두는 식이다. 그때는 더 구체적으로 적은 쪽이 이긴다. 길이가 같으면, 즉 같은 줄을
 * 양쪽에 적었으면 확인이 이긴다. 놓치는 쪽이 더 나쁘기 때문이다.
 */
function nmtSenderRule(mail, showList, muteList) {
  const show = nmtSenderMatchLength(mail, showList);
  const mute = nmtSenderMatchLength(mail, muteList);
  if (!show && !mute) return '';
  return show >= mute ? 'show' : 'mute';
}

/**
 * 회신을 받지 않는 주소인가. 이 경우 사람이 아니라 시스템이 보낸 것이다.
 *
 * 앞부분만 보면 사람 주소가 걸린다. systemsengineer 가 system 으로, automation 과 같은
 * 자리에 있는 autumn 이 auto 로 시작한다. 그래서 아이디 전체나
 * 구분자로 끊은 조각이 정확히 그 단어인 경우만 본다. 다만 noreply 와 donotreply 는
 * 어디에 붙어 있든 회신 불가를 뜻한다.
 */
function nmtIsNoReply(email) {
  if (!email) return false;

  const raw = email.split('@')[0].toLowerCase();
  const joined = raw.replace(/[._-]/g, '');

  if (/(noreply|donotreply)/.test(joined)) return true;

  const bare = (s) => NMT_AUTO_LOCALS.has(s.replace(/\d+$/, ''));
  return bare(joined) || raw.split(/[._-]+/).some(bare);
}

/**
 * 로그인한 사용자의 이름과 주소. 못 찾으면 빈 문자열.
 *
 * 설정에 이름을 직접 적지 않아도 본인이 보낸 메일을 가릴 수 있게 한다.
 * 사이트마다 두는 자리가 다르다.
 *   Gmail       프로필 버튼의 aria-label 에 "Google 계정: 이름 (주소)"
 *   네이버 계열  프로필 영역의 이름 요소
 * 이름과 주소를 모두 모아 쉼표로 잇는다. 둘 중 하나만 맞아도 본인 메일을 가릴 수 있다.
 */
function nmtDetectMe() {
  const found = [];

  // Gmail 의 프로필 버튼
  for (const el of document.querySelectorAll('[aria-label*="@"]')) {
    const v = el.getAttribute('aria-label') || '';
    const mail = v.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (!mail) continue;
    found.push(mail[0]);
    // "Google 계정: 홍길동 (user@example.com)" 에서 이름 부분
    const name = v.replace(/^[^:]*:\s*/, '').split('(')[0].trim();
    if (name && name.length <= 30) found.push(name);
    break;
  }

  // 네이버 계열의 프로필 이름
  if (!found.length) {
    for (const sel of ['[class*="profile"] [class*="name"]', '[class*="myInfo"] [class*="name"]']) {
      const t = nmtText(document.querySelector(sel));
      if (t && t.length <= 30) {
        found.push(t);
        break;
      }
    }
  }

  // 마지막 수단으로 문서 제목
  if (!found.length) {
    const m = document.title.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (m) found.push(m[0]);
  }

  return [...new Set(found)].join(', ');
}

/** 읽지 않은 메일인가. 판단할 수 없으면 null. */
/**
 * 안 읽은 메일인가. 판정할 수 없으면 null 을 돌려준다.
 *
 * 읽음 아이콘의 부재를 안 읽음으로 읽으면 안 된다. 네이버웍스는 읽음 아이콘이 yes 와
 * admin 과 없음 셋으로 갈려 아이콘이 없는 행이 12건이나 되는데, 그중 안 읽은 것은
 * 없었다. 안 읽음을 직접
 * 표시하는 클래스가 있으면 그것을 먼저 본다.
 */
function nmtIsUnread(row, profile) {
  const p = profile ?? nmtProfile();
  if (!p) return null;

  if (p.unreadRowClass) return row.classList.contains(p.unreadRowClass);
  if (p.readRowClass) return !row.classList.contains(p.readRowClass);
  if (p.readChildMark) return !row.querySelector(p.readChildMark);
  return null;
}

/** 같은 메일을 두 번 판정하지 않도록 안정적인 키를 만든다. */
function nmtRowKey(row, mail, profile) {
  const p = profile ?? nmtProfile();

  if (p) {
    // 행 클래스에 ID 가 있는 경우(네이버의 mail-745)
    if (p.idRowClassPattern) {
      const m = (row.className || '').match(p.idRowClassPattern);
      if (m) return `${p.id}:${m[1]}`;
    }
    if (p.idSelector) {
      const el = row.querySelector(p.idSelector);
      // 속성에 ID 가 그대로 있는 경우(Gmail 의 data-legacy-thread-id)
      if (el && p.idAttr) {
        const v = el.getAttribute(p.idAttr);
        if (v) return `${p.id}:${v}`;
      }
      // 링크 주소에서 뽑아야 하는 경우(네이버 계열)
      if (el && p.idPattern) {
        const m = (el.getAttribute('href') ?? '').match(p.idPattern);
        if (m) return `${p.id}:${m[1]}`;
      }
    }
  }

  const attr = row.getAttribute('data-mail-sn') || row.getAttribute('id') || '';
  if (attr) return `attr:${attr}`;

  return `txt:${mail.sender}|${mail.subject}`.slice(0, 200);
}
