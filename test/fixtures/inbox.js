/*
 * 데모 받은편지함의 메일과 화면 동작.
 *
 * 확장이 Gmail 로 인식하는 데 필요한 골격만 맞췄다. 행은 tr.zA, 제목은 .y6,
 * 발신자는 span.bA4, 미리보기는 .y2, 식별자는 data-legacy-thread-id, 읽음은 yO 다.
 * 구조가 바뀌면 src/selectors.js 의 gmail 프로파일과 함께 고친다.
 *
 * judge 는 시나리오 시험에서 판정 서비스 대신 돌려줄 값이다. 실제 판정과는 상관없다.
 * 회신 불가 주소나 본인 발신처럼 규칙으로 걸러지는 메일은 낮게 두어, 규칙을 타든 판정을
 * 타든 결과가 같게 한다.
 */

const NMT_FIXTURE_PAGES = [
  [
    { from: '김민준', email: 'minjun@partner.example.com', unread: true,
      subject: '주간 보고서 검토 부탁드립니다',
      preview: '이번 주 진행 상황 정리했습니다. 내일 오전까지 회신 부탁드려요.', when: '오후 3:24',
      judge: { action: 0.93, kind: 'reply' } },

    { from: '이서연', email: 'seoyeon@client.example.com', unread: true,
      subject: '[견적] 3분기 계약 건 확인 요청',
      preview: '보내주신 견적서에서 두 항목만 다시 확인 부탁드립니다.', when: '오후 2:51',
      judge: { action: 0.88, kind: 'reply' } },

    { from: '한지우', email: 'jiwoo@company.example.com', unread: true,
      subject: '코드 리뷰 요청드립니다 (#482)',
      preview: '결제 모듈 리팩터링 건입니다. 오늘 중으로 봐주시면 배포 일정에 맞출 수 있습니다.',
      when: '오후 1:07', judge: { action: 0.91, kind: 'task' } },

    { from: '인사팀', email: 'hr@company.example.com', unread: true,
      subject: '연차 신청 결재 대기 안내',
      preview: '결재 대기 중인 건이 1건 있습니다. 9월 30일까지 처리해 주세요.', when: '오전 11:42',
      judge: { action: 0.86, kind: 'approval' } },

    { from: '박지훈', email: 'jihoon@company.example.com', unread: true,
      subject: '내일 오후 2시 설계 리뷰 참석 가능하신가요',
      preview: '회의실 예약 전에 참석 여부만 알려 주시면 됩니다.', when: '오전 10:15',
      judge: { action: 0.82, kind: 'schedule' } },

    { from: '배포알림', email: 'deploy-bot@ci.example.com', unread: true,
      subject: '[실패] 운영 배포 #1284 중단됨',
      preview: '배포 4분 12초 만에 중단됐습니다. 테스트 3건이 통과하지 못했습니다.',
      when: '오전 9:33', judge: { action: 0.3, kind: 'system' } },

    { from: 'AWS', email: 'no-reply@aws.example.com', unread: false,
      subject: '9월 요금 청구 예상 금액 안내',
      preview: '현재까지 사용 금액은 지난달 같은 기간 대비 12% 증가했습니다.', when: '오전 8:02',
      judge: { action: 0.1, kind: 'system' } },

    { from: '최유나', email: 'yuna@company.example.com', unread: false,
      subject: '[공유] 지난주 릴리스 노트',
      preview: '지난주에 나간 변경 사항을 정리했습니다. 읽어 보시라고 보내는 것이고 회신은 필요 없습니다.',
      when: '어제', judge: { action: 0.15, kind: 'fyi' } },

    { from: '사내공지', email: 'notice@company.example.com', unread: false,
      subject: '[공지] 10월 사내 교육 일정 안내',
      preview: '전 직원 대상 정보보안 교육이 10월 둘째 주에 진행됩니다.', when: '어제',
      judge: { action: 0.2, kind: 'fyi' } },

    { from: 'LinkedIn', email: 'notifications@linkedin.example.com', unread: false,
      subject: '회원님의 프로필을 12명이 조회했습니다',
      preview: '이번 주 프로필 조회수가 지난주보다 늘었습니다.', when: '어제',
      judge: { action: 0.05, kind: 'system' } },

    { from: '테크뉴스레터', email: 'newsletter@tech.example.com', unread: false,
      subject: '이번 주 개발 소식 38호',
      preview: '프레임워크 신규 릴리스와 커뮤니티 소식을 정리했습니다.', when: '9월 20일',
      judge: { action: 0.05, kind: 'fyi' } },

    { from: '나', email: 'me@company.example.com', unread: false,
      subject: '회의록 공유드립니다',
      preview: '오늘 논의한 내용 정리해서 첨부합니다.', when: '9월 20일',
      judge: { action: 0.1, kind: 'sent' } },

    { from: '온누리시스템', email: 'sales@onnuri.example.com', unread: false,
      subject: '[광고] 업무 자동화 솔루션 소개',
      preview: '수신을 원하지 않으시면 하단 링크로 거부하실 수 있습니다.', when: '9월 19일',
      judge: { action: 0.05, kind: 'vendor' } },

    { from: 'Google', email: 'no-reply@accounts.example.com', unread: false,
      subject: '보안 알림: 새로운 기기에서 로그인',
      preview: '본인이 맞다면 별도 조치가 필요하지 않습니다.', when: '9월 19일',
      judge: { action: 0.1, kind: 'system' } },

    { from: '배송알림', email: 'delivery@shop.example.com', unread: false,
      subject: '주문하신 상품이 배송 완료되었습니다',
      preview: '문 앞에 두고 갔습니다. 수령 확인 부탁드립니다.', when: '9월 18일',
      judge: { action: 0.2, kind: 'fyi' } },

    { from: '카드사', email: 'noreply@card.example.com', unread: false,
      subject: '9월 이용대금 명세서',
      preview: '결제 예정일은 10월 5일입니다.', when: '9월 18일',
      judge: { action: 0.1, kind: 'system' } },

    { from: '채용플랫폼', email: 'jobs@recruit.example.com', unread: false,
      subject: '회원님께 맞는 공고 14건',
      preview: '관심 직군에 새로 올라온 공고를 모았습니다.', when: '9월 17일',
      judge: { action: 0.05, kind: 'vendor' } },

    { from: '웨비나', email: 'events@webinar.example.com', unread: false,
      subject: '[무료] 클라우드 비용 최적화 웨비나 초대',
      preview: '10월 8일 오후 3시에 온라인으로 진행됩니다.', when: '9월 17일',
      judge: { action: 0.1, kind: 'vendor' } },
  ],
  [
    { from: '정다은', email: 'daeun@client.example.com', unread: true,
      subject: '계약서 수정본 회신 부탁드립니다',
      preview: '법무 검토 의견을 반영했습니다. 금요일까지 확인 부탁드립니다.', when: '9월 16일',
      judge: { action: 0.92, kind: 'reply' } },

    { from: '오세훈', email: 'sehoon@company.example.com', unread: true,
      subject: '서버 증설 구매 요청 승인 부탁드립니다',
      preview: '견적 두 건 첨부했습니다. 승인해 주시면 바로 발주하겠습니다.', when: '9월 16일',
      judge: { action: 0.84, kind: 'approval' } },

    { from: '보안팀', email: 'security@company.example.com', unread: false,
      subject: '[안내] 비밀번호 변경 주기 도래',
      preview: '다음 로그인 시 변경 안내가 표시됩니다.', when: '9월 15일',
      judge: { action: 0.25, kind: 'fyi' } },

    { from: 'GitHub', email: 'noreply@github.example.com', unread: false,
      subject: '[repo] 새 이슈가 등록되었습니다',
      preview: '결제 모듈 타임아웃 재현 절차가 올라왔습니다.', when: '9월 15일',
      judge: { action: 0.1, kind: 'system' } },

    { from: '마케팅팀', email: 'marketing@company.example.com', unread: false,
      subject: '[공유] 3분기 캠페인 결과',
      preview: '참고용으로 공유드립니다.', when: '9월 14일',
      judge: { action: 0.1, kind: 'fyi' } },

    { from: '클라우드뉴스', email: 'news@cloud.example.com', unread: false,
      subject: '이달의 클라우드 소식',
      preview: '새 지역 출시와 가격 변경 소식입니다.', when: '9월 14일',
      judge: { action: 0.05, kind: 'fyi' } },

    { from: '총무팀', email: 'admin@company.example.com', unread: false,
      subject: '주차 등록 안내',
      preview: '신규 차량 등록은 총무팀으로 문의 바랍니다.', when: '9월 13일',
      judge: { action: 0.2, kind: 'fyi' } },

    { from: '세미나', email: 'seminar@conf.example.com', unread: false,
      subject: '[초대] 개발자 컨퍼런스 사전 등록',
      preview: '얼리버드 등록이 이번 주에 마감됩니다.', when: '9월 13일',
      judge: { action: 0.1, kind: 'vendor' } },

    { from: '회계팀', email: 'finance@company.example.com', unread: false,
      subject: '법인카드 사용 내역 확인',
      preview: '지난달 사용 내역을 첨부합니다. 참고 바랍니다.', when: '9월 12일',
      judge: { action: 0.3, kind: 'fyi' } },

    { from: '쇼핑몰', email: 'no-reply@mall.example.com', unread: false,
      subject: '장바구니에 담긴 상품이 할인 중입니다',
      preview: '오늘까지만 적용됩니다.', when: '9월 12일',
      judge: { action: 0.05, kind: 'vendor' } },

    { from: '윤하린', email: 'harin@company.example.com', unread: false,
      subject: '[공유] 회의실 예약 규칙 변경',
      preview: '다음 달부터 적용됩니다. 회신은 필요 없습니다.', when: '9월 11일',
      judge: { action: 0.12, kind: 'fyi' } },

    { from: '교육센터', email: 'edu@training.example.com', unread: false,
      subject: '수료증이 발급되었습니다',
      preview: '마이페이지에서 내려받으실 수 있습니다.', when: '9월 11일',
      judge: { action: 0.1, kind: 'fyi' } },
  ],
];

/**
 * 화면 조작. 페이지 넘김과 메일 열기를 실제 메일 서비스가 할 법한 방식으로 흉내 낸다.
 *
 * mode     다음 페이지를 그리는 방식
 *   replace       행을 새 DOM 으로 바꾼다
 *   reuse-cells   행은 두고 칸을 다시 그린다
 *   reuse-text    행과 칸은 두고 글자와 속성만 바꾼다. 확장이 붙인 것이 그대로 남는다
 *
 * openMode 행을 눌렀을 때
 *   read      읽음으로만 바꾼다. 목록이 남는다
 *   remove    목록을 비우고 본문을 띄운다. 돌아오면 목록을 새 DOM 으로 다시 그린다
 *   hide      목록을 감추고 본문을 띄운다. 돌아오면 같은 DOM 을 다시 보인다
 */
const nmtFixture = (() => {
  const state = { page: 0, mode: 'replace', openMode: 'read', opened: '' };

  const idOf = (page, i) => 'demo-' + 'bc'[page] + '-' + String(i).padStart(3, '0');
  const body = () => document.getElementById('rows');
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function mailById(id) {
    for (const [p, list] of NMT_FIXTURE_PAGES.entries()) {
      const i = list.findIndex((_, n) => idOf(p, n) === id);
      if (i >= 0) return list[i];
    }
    return null;
  }

  function fill(tr, m, id) {
    tr.className = 'zA ' + (m.unread ? 'zE' : 'yO');
    tr.innerHTML = `
      <td class="PF xY"><input type="checkbox" aria-label="선택"></td>
      <td class="apU xY"><span class="aXw T-KT" role="button" aria-label="별표 없음">&#9734;</span></td>
      <td class="yX xY">
        <div class="afn">
          <span class="bA4"><span class="zF" email="${esc(m.email)}" name="${esc(m.from)}">${esc(m.from)}</span></span>
          <span class="bqe" data-legacy-thread-id="${id}"></span>
        </div>
      </td>
      <td class="xY a4W">
        <div class="a4X"><div class="xS"><div class="xT">
          <span class="y6"><span>${esc(m.subject)}</span></span>
          <span class="y2"> - ${esc(m.preview)}</span>
        </div></div></div>
      </td>
      <td class="xW xY"><span>${esc(m.when)}</span></td>`;
  }

  function retext(tr, m, id) {
    tr.className = 'zA ' + (m.unread ? 'zE' : 'yO');
    const who = tr.querySelector('.zF');
    who.setAttribute('email', m.email);
    who.setAttribute('name', m.from);
    who.textContent = m.from;
    tr.querySelector('[data-legacy-thread-id]').setAttribute('data-legacy-thread-id', id);
    tr.querySelector('.y6 span').textContent = m.subject;
    tr.querySelector('.y2').textContent = ' - ' + m.preview;
    tr.querySelector('.xW span').textContent = m.when;
  }

  function render(mode) {
    const list = NMT_FIXTURE_PAGES[state.page];
    const tbody = body();
    const old = [...tbody.children];
    const how = mode ?? state.mode;

    if (how === 'replace' || !old.length) {
      tbody.replaceChildren(
        ...list.map((m, i) => {
          const tr = document.createElement('tr');
          fill(tr, m, idOf(state.page, i));
          return tr;
        })
      );
    } else {
      list.forEach((m, i) => {
        const tr = old[i];
        if (!tr) {
          const fresh = document.createElement('tr');
          fill(fresh, m, idOf(state.page, i));
          tbody.appendChild(fresh);
        } else if (how === 'reuse-cells') {
          fill(tr, m, idOf(state.page, i));
        } else {
          retext(tr, m, idOf(state.page, i));
        }
      });
      old.slice(list.length).forEach((tr) => tr.remove());
    }

    const range = document.getElementById('range');
    if (range) {
      const start = NMT_FIXTURE_PAGES.slice(0, state.page).reduce((n, l) => n + l.length, 0);
      const total = NMT_FIXTURE_PAGES.reduce((n, l) => n + l.length, 0);
      range.textContent = `${start + 1}-${start + list.length} / ${total}`;
    }
  }

  function go(page) {
    if (page < 0 || page >= NMT_FIXTURE_PAGES.length || page === state.page) return;
    state.page = page;
    render();
  }

  function open(tr) {
    const id = tr.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id');
    const m = mailById(id);
    if (!m) return;
    m.unread = false;

    if (state.openMode === 'read') {
      tr.classList.remove('zE');
      tr.classList.add('yO');
      return;
    }

    state.opened = id;
    const detail = document.getElementById('detail');
    detail.hidden = false;
    document.getElementById('detail-subject').textContent = m.subject;
    if (state.openMode === 'remove') body().replaceChildren();
    else document.getElementById('list').hidden = true;
  }

  function back() {
    if (!state.opened) return;
    state.opened = '';
    document.getElementById('detail').hidden = true;
    // 실제 메일 서비스는 목록으로 돌아올 때 새 DOM 으로 다시 그린다
    if (state.openMode === 'remove') render('replace');
    else document.getElementById('list').hidden = false;
  }

  function start(options = {}) {
    Object.assign(state, options);
    body().addEventListener('click', (e) => {
      const tr = e.target.closest('tr.zA');
      if (!tr || e.target.closest('input, [role="button"], .nmt-badge')) return;
      open(tr);
    });
    document.getElementById('prev')?.addEventListener('click', () => go(state.page - 1));
    document.getElementById('next')?.addEventListener('click', () => go(state.page + 1));
    document.getElementById('back')?.addEventListener('click', back);
    render('replace');
  }

  return { state, start, go, open, back, idOf, mailById };
})();
