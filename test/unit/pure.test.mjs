/**
 * 화면 없이 돌릴 수 있는 판정들.
 *
 * 각 시험은 docs/invariants.md 의 항목이나 실제로 겪은 결함에 대응한다. 통과하는 입력만
 * 넣으면 검사가 스스로를 증명하는 셈이 되므로, 틀린 답이 나와야 하는 입력을 함께 둔다.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, loadExtension, loadFor, valueIn } from '../harness.mjs';

const ext = loadExtension();

describe('회신 불가 주소', () => {
  it('자동 발송 계열을 잡는다', () => {
    for (const email of [
      'noreply@example.com',
      'no-reply@example.com',
      'no_reply@example.com',
      'donotreply@example.com',
      'DoNotReply@Example.COM',
      'notifications@github.com',
      'github.notifications@example.com',
      'mailer-daemon@example.com',
      'alerts@example.com',
      'alert2@example.com',
      'noreply-billing@example.com',
      'auto@example.com',
    ]) {
      assert.equal(ext.nmtIsNoReply(email), true, email);
    }
  });

  it('사람이 쓰는 주소를 잡지 않는다', () => {
    for (const email of [
      'hong@example.com',
      'sales@example.com',
      'support@example.com',
      'autumn@example.com', // auto 로 시작하지만 사람 이름이다
      'systemsengineer@example.com', // system 으로 시작하지만 직무 주소다
      'notify.me@example.com'.replace('notify', 'notion'), // 앞자리가 비슷할 뿐이다
      '',
      null,
    ]) {
      assert.equal(ext.nmtIsNoReply(email), false, String(email));
    }
  });
});

describe('본인 식별', () => {
  it('이름과 주소 어느 쪽으로도 알아본다', () => {
    const me = 'hong@example.com, 홍길동';
    assert.equal(ext.nmtIsFromMe('홍길동', me), true);
    assert.equal(ext.nmtIsFromMe('hong@example.com', me), true);
  });

  it('남을 본인으로 보지 않는다', () => {
    const me = 'hong@example.com, 홍길동';
    assert.equal(ext.nmtIsFromMe('김철수', me), false);
    assert.equal(ext.nmtIsFromMe('kim@example.com', me), false);
  });

  it('설정이 비어 있으면 아무도 본인이 아니다', () => {
    assert.equal(ext.nmtIsFromMe('홍길동', ''), false);
    assert.equal(ext.nmtIsFromMe('홍길동', null), false);
  });
});

describe('캐시 키', () => {
  it('역할이 바뀌면 키가 달라진다', () => {
    // 역할 문장이 판정에 들어가므로 옛 결과를 그대로 쓰면 안 된다
    const a = ext.nmtVerdictKey('gmail:123', '서버 개발자');
    const b = ext.nmtVerdictKey('gmail:123', '영업 담당');
    assert.notEqual(a, b);
  });

  it('같은 메일과 같은 역할이면 키가 같다', () => {
    assert.equal(
      ext.nmtVerdictKey('gmail:123', '서버 개발자'),
      ext.nmtVerdictKey('gmail:123', '서버 개발자')
    );
  });

  it('메일이 다르면 키가 다르다', () => {
    assert.notEqual(
      ext.nmtVerdictKey('gmail:123', '역할'),
      ext.nmtVerdictKey('gmail:124', '역할')
    );
  });

  it('질문 설계가 바뀌면 옛 판정이 무효가 되도록 버전이 앞에 붙는다', () => {
    assert.match(ext.nmtVerdictKey('gmail:1', ''), /^v\d+:/);
  });

  it('본인 이름과 주소가 바뀌면 키가 달라진다', () => {
    // 본인 이름과 주소도 판정 입력으로 보내므로 옛 결과를 그대로 쓰면 안 된다
    assert.notEqual(
      ext.nmtVerdictKey('gmail:123', '서버 개발자', '홍길동'),
      ext.nmtVerdictKey('gmail:123', '서버 개발자', '김철수')
    );
    assert.notEqual(
      ext.nmtVerdictKey('gmail:123', '서버 개발자', ''),
      ext.nmtVerdictKey('gmail:123', '서버 개발자', '홍길동')
    );
  });

  it('이름 칸이 비어 있으면 키가 이름 칸이 생기기 전과 같다', () => {
    // 늘 붙이면 업데이트 직후 이름을 적지 않은 사용자까지 저장된 판정이 모두 무효가 된다
    const before = valueIn(ext, "`v${NMT_SCHEMA_VERSION}:${nmtHash('서버 개발자')}:gmail:123`");
    assert.equal(ext.nmtVerdictKey('gmail:123', '서버 개발자', ''), before);
    assert.equal(ext.nmtVerdictKey('gmail:123', '서버 개발자', undefined), before);
  });
});

describe('종합 배지', () => {
  // 화면은 판정 하나만 보여 준다. 강조되지 않은 행에 행동형 배지가 붙으면
  // 같은 배지가 어떤 행에서는 강조되고 어떤 행에서는 아닌 화면이 된다
  it('강조된 행은 분류를 그대로 쓴다', () => {
    for (const kind of ['reply', 'task', 'approval', 'schedule', 'fyi', 'system']) {
      assert.equal(ext.nmtBadgeKind(kind, true), kind);
    }
  });

  it('강조되지 않은 행에는 행동형 배지가 남지 않는다', () => {
    for (const kind of ['reply', 'task', 'approval', 'schedule']) {
      assert.equal(ext.nmtBadgeKind(kind, false), 'fyi', kind);
    }
  });

  it('왜 강조하지 않는지 말해 주는 분류는 그대로 둔다', () => {
    for (const kind of ['system', 'sent', 'vendor']) {
      assert.equal(ext.nmtBadgeKind(kind, false), kind);
    }
  });
});

describe('받는 사람 칸에 없는 메일', () => {
  // 참조와 단체 주소로 받은 메일의 요청은 대개 받는 사람 칸의 사람 몫이다
  const v = (action, kind = 'task') => ({ action, kind });

  it('문턱을 넘어도 받는 사람 칸에 없으면 강조하지 않고 참조로 보인다', () => {
    const d = ext.nmtDecide(v(0.9), 0.7, false);
    assert.equal(d.needsAction, false);
    assert.equal(d.shown, 'cc');
  });

  it('받는 사람 칸에 있으면 그대로 강조한다', () => {
    const d = ext.nmtDecide(v(0.9), 0.7, true);
    assert.equal(d.needsAction, true);
    assert.equal(d.shown, 'task');
  });

  it('표시가 없는 서비스(null)에서는 가르지 않는다', () => {
    const d = ext.nmtDecide(v(0.9), 0.7, null);
    assert.equal(d.needsAction, true);
    assert.equal(d.shown, 'task');
  });

  it('항상 확인은 이 규칙보다 앞선다', () => {
    const d = ext.nmtDecide(v(1, 'pinned'), 0.7, false);
    assert.equal(d.needsAction, true);
    assert.equal(d.shown, 'pinned');
  });

  it('문턱 아래는 전과 같다', () => {
    assert.equal(ext.nmtDecide(v(0.3), 0.7, false).shown, 'fyi');
    assert.equal(ext.nmtDecide(v(0.3, 'vendor'), 0.7, false).shown, 'vendor');
    assert.equal(ext.nmtDecide(v(0.3), 0.7, false).needsAction, false);
  });

  it('나를 멘션한 메일은 받는 사람 칸에 없어도 강조한다', () => {
    const d = ext.nmtDecide(v(1, 'mention'), 0.7, false);
    assert.equal(d.needsAction, true);
    assert.equal(d.shown, 'mention');
  });

  it('네이버웍스는 멘션 표시로 나를 멘션했는지 안다', () => {
    const p = loadFor('https://mail.worksmobile.com/w/all').nmtProfile();
    const row = (marks) => ({ querySelector: (sel) => (sel.split(',').some((s) => marks.includes(s.trim())) ? {} : null) });
    assert.equal(ext.nmtIsMentioned(row(['.icon_mention']), p), true);
    // 받는 사람 칸에만 있는 것은 멘션이 아니다
    assert.equal(ext.nmtIsMentioned(row(['.ico_recipient']), p), false);
    assert.equal(ext.nmtIsMentioned(row([]), p), false);
  });

  it('멘션 표시가 없는 서비스는 모른다고 답한다', () => {
    const row = { querySelector: () => ({}) };
    const gmail = loadFor('https://mail.google.com/mail/u/0/').nmtProfile();
    assert.equal(ext.nmtIsMentioned(row, gmail), null);
  });

  it('네이버웍스는 TO 배지나 멘션 표시가 있으면 받는 사람이다', () => {
    const p = loadFor('https://mail.worksmobile.com/w/all').nmtProfile();
    const row = (marks) => ({ querySelector: (sel) => (sel.split(',').some((s) => marks.includes(s.trim())) ? {} : null) });
    assert.equal(ext.nmtIsToMe(row(['.ico_recipient']), p), true);
    assert.equal(ext.nmtIsToMe(row(['.icon_mention']), p), true);
    assert.equal(ext.nmtIsToMe(row([]), p), false);
  });

  it('받는 사람 표시가 없는 서비스는 모른다고 답한다', () => {
    const row = { querySelector: () => null };
    assert.equal(ext.nmtIsToMe(row, loadFor('https://mail.google.com/mail/u/0/').nmtProfile()), null);
    assert.equal(ext.nmtIsToMe(row, loadFor('https://mail.naver.com/v2/folders/0/all').nmtProfile()), null);
  });
});

describe('규칙 판정의 순서', () => {
  // 규칙에 걸리면 모델에 묻지 않는다. null 일 때만 호출이 나간다
  const works = loadFor('https://mail.worksmobile.com/w/all');
  const p = works.nmtProfile();
  const row = (marks = []) => ({
    querySelector: (sel) => (sel.split(',').some((s) => marks.includes(s.trim())) ? {} : null),
  });
  const mail = (email, sender = '보낸 사람', subject = '제목') => ({ email, sender, subject });
  const settings = (alwaysShow = '', alwaysMute = '') => ({ alwaysShow, alwaysMute });
  const kindOf = (r, m, s = settings(), me = '') => works.nmtRuleVerdict(r, m, s, p, me)?.kind ?? null;

  it('나를 멘션한 메일은 모델에 묻지 않고 강조한다', () => {
    const v = works.nmtRuleVerdict(row(['.icon_mention']), mail('kim@corp.com'), settings(), p, '');
    assert.equal(v.kind, 'mention');
    // 가장 엄격한 강조 강도에서도, 받는 사람 칸에 없어도 강조된다
    assert.equal(works.nmtDecide(v, 0.85, false).needsAction, true);
  });

  it('멘션은 회신 불가 주소보다 앞선다', () => {
    assert.equal(kindOf(row(['.icon_mention']), mail('no-reply@corp.com')), 'mention');
    assert.equal(kindOf(row([]), mail('no-reply@corp.com')), 'system');
  });

  it('항상 확인과 항상 무시는 멘션보다 앞선다', () => {
    assert.equal(kindOf(row(['.icon_mention']), mail('kim@corp.com'), settings('kim@corp.com')), 'pinned');
    assert.equal(kindOf(row(['.icon_mention']), mail('kim@corp.com'), settings('', 'kim@corp.com')), 'muted');
  });

  it('내가 보낸 메일은 멘션 표시가 있어도 내가 보냄이다', () => {
    assert.equal(kindOf(row(['.icon_mention']), mail('me@corp.com', '홍길동'), settings(), '홍길동'), 'sent');
  });

  it('본인 발신은 항상 확인과 항상 무시보다 앞선다', () => {
    // 목록을 앞에 두면 받은 메일과 보낸 메일이 섞인 목록에서 내가 보낸 요청이 제목 단어에 걸려
    // 강조된다. 내가 보낸 메일은 내가 처리할 일이 아니다
    const m = mail('me@corp.com', '홍길동', '[긴급] 서버 점검 요청');
    assert.equal(kindOf(row([]), m, settings('긴급'), '홍길동'), 'sent');
    assert.equal(kindOf(row([]), m, settings('', '서버 점검'), '홍길동'), 'sent');
    assert.equal(kindOf(row([]), m, settings('me@corp.com'), '홍길동'), 'sent');
    // 같은 제목이라도 남이 보냈으면 목록이 정한다. 상대가 보낸 회신도 원래 제목을 달고 와 걸린다
    const reply = mail('kim@corp.com', '김철수', 'RE: [긴급] 서버 점검 요청');
    assert.equal(kindOf(row([]), reply, settings('긴급'), '홍길동'), 'pinned');
    assert.equal(kindOf(row([]), reply, settings('', '서버 점검'), '홍길동'), 'muted');
  });

  it('본인 발신은 회신 불가 주소보다 앞선다', () => {
    // 이름 칸의 값이 알림 발신자 이름과 겹치면 자동발송 대신 내가 보냄이 된다. README 의 순서와 같다
    assert.equal(kindOf(row([]), mail('no-reply@corp.com', '홍길동'), settings(), '홍길동'), 'sent');
  });

  it('규칙에 걸리지 않으면 모델에 묻는다', () => {
    assert.equal(kindOf(row(['.ico_recipient']), mail('kim@corp.com')), null);
  });

  it('멘션 표시가 없는 서비스에서는 멘션 규칙이 걸리지 않는다', () => {
    const gmail = loadFor('https://mail.google.com/mail/u/0/');
    const v = gmail.nmtRuleVerdict(row(['.icon_mention']), mail('kim@corp.com'), settings(), gmail.nmtProfile(), '');
    assert.equal(v, null);
  });

  it('목록 다시 그리기와 분류하기가 같은 규칙 함수를 쓴다', () => {
    // 한쪽에만 규칙을 더하면 다시 그릴 때와 분류할 때의 표시가 갈린다
    // 저장소는 CRLF 로 체크아웃될 수 있다. 줄 끝을 맞춘 뒤 함수 본문을 자른다
    const src = readFileSync(join(ROOT, 'src/content.js'), 'utf8').replace(/\r\n/g, '\n');
    const body = (name) => {
      const start = src.indexOf(`async function ${name}(`);
      const end = src.indexOf('\n}\n', start);
      assert.ok(start >= 0 && end > start, name + ' 본문을 찾지 못했다');
      return src.slice(start, end);
    };
    for (const name of ['nmtRepaint', 'nmtRun']) {
      assert.ok(body(name).includes('nmtRuleVerdict('), name + ' 이 규칙 함수를 쓰지 않는다');
      assert.ok(!body(name).includes('nmtIsNoReply('), name + ' 이 규칙을 따로 판단한다');
    }
  });
});

describe('배지 툴팁은 걸린 규칙을 말한다', () => {
  // 규칙 판정에 확률을 적으면 모델이 100% 확신한 것처럼 읽히고, 무엇을 고쳐야 할지 알 수 없다
  const works = loadFor('https://mail.worksmobile.com/w/all');
  const p = works.nmtProfile();
  const row = (marks = []) => ({
    querySelector: (sel) => (sel.split(',').some((s) => marks.includes(s.trim())) ? {} : null),
  });
  const mail = (email, subject = '제목', sender = '보낸 사람') => ({ email, sender, subject });
  const settings = (alwaysShow = '', alwaysMute = '') => ({ alwaysShow, alwaysMute });
  const verdict = (r, m, s = settings(), me = '') => works.nmtRuleVerdict(r, m, s, p, me);
  const title = (v) => works.nmtBadgeTitle(v, works.nmtDecide(v, 0.7, true).shown);

  it('목록 규칙은 걸린 줄을 적힌 그대로 남긴다', () => {
    const v = verdict(row(), mail('ci@corp.com', 'my-app | Failed pipeline for main'), settings('긴급\nFailed Pipeline'));
    assert.equal(v.rule, 'show');
    assert.equal(v.word, 'Failed Pipeline');
    assert.ok(title(v).includes('항상 확인할 것'), title(v));
    assert.ok(title(v).includes('"Failed Pipeline"'), title(v));
    assert.ok(!title(v).includes('행동 필요'), '규칙 판정에 확률을 적었다');
  });

  it('두 목록에 걸리면 이긴 쪽의 줄을 남긴다', () => {
    const m = mail('spam@x.com', '[프로모션] 상반기 결산 세미나');
    const v = verdict(row(), m, settings('세미나', '[프로모션] 상반기'));
    assert.equal(v.rule, 'mute');
    assert.equal(v.word, '[프로모션] 상반기');
    assert.ok(title(v).includes('항상 무시할 것'), title(v));
  });

  it('규칙마다 다른 이유를 적는다', () => {
    const cases = [
      [verdict(row(['.icon_mention']), mail('kim@corp.com')), 'mention', '멘션'],
      [verdict(row(), mail('no-reply@corp.com')), 'noreply', '회신 불가'],
      [verdict(row(), mail('me@corp.com', '제목', '홍길동'), settings(), '홍길동'), 'sent', '내가 보낸'],
    ];
    for (const [v, rule, phrase] of cases) {
      assert.equal(v.rule, rule);
      assert.ok(title(v).includes(phrase), rule + ': ' + title(v));
      assert.ok(!title(v).includes('행동 필요'), rule + ' 에 확률을 적었다');
    }
  });

  it('모델이 자동발송이라 답한 판정은 규칙이 아니라 확률을 적는다', () => {
    // 종류만 보고 규칙 문구를 고르면, 모델이 system 이라 답한 행이 회신 불가 주소라고 적힌다
    const v = { action: 0.12, kind: 'system', kindConfidence: 0.9, deadline: 0 };
    assert.ok(title(v).includes('행동 필요 12%'), title(v));
    assert.ok(!title(v).includes('회신 불가'), title(v));
  });

  it('참조로 흐린 모델 판정은 원래 분류를 함께 적는다', () => {
    const v = { action: 0.9, kind: 'reply', kindConfidence: 0.8, deadline: 0 };
    const shown = works.nmtDecide(v, 0.7, false).shown;
    assert.equal(shown, 'cc');
    assert.ok(works.nmtBadgeTitle(v, shown).includes('분류는 답장 필요'), works.nmtBadgeTitle(v, shown));
  });

  it('배지를 붙이는 함수가 이 툴팁 함수를 쓴다', () => {
    // 툴팁 함수만 시험하면, 배지를 붙이는 쪽이 예전처럼 확률을 직접 적어도 통과한다
    const src = readFileSync(join(ROOT, 'src/content.js'), 'utf8').replace(/\r\n/g, '\n');
    const start = src.indexOf('function nmtMark(');
    const body = src.slice(start, src.indexOf('\n}\n', start));
    assert.ok(start >= 0, 'nmtMark 본문을 찾지 못했다');
    assert.ok(body.includes('nmtBadgeTitle('), 'nmtMark 가 툴팁 함수를 쓰지 않는다');
    assert.ok(!body.includes("'badgeTip'"), 'nmtMark 가 확률 문구를 따로 만든다');
  });
});

describe('응답 형식', () => {
  it('확률 값의 여러 표기를 읽는다', () => {
    assert.equal(ext.nmtNoulValue({ value: 0.8 }), 0.8);
    assert.equal(ext.nmtNoulValue({ noul: 0.8 }), 0.8);
    assert.equal(ext.nmtNoulValue({ probability: 0.8 }), 0.8);
    assert.equal(ext.nmtNoulValue(0.8), 0.8);
  });

  it('값이 없으면 null 을 돌려준다', () => {
    // 0 을 돌려주면 확신을 가지고 확인 불필요로 판정하는 셈이 된다
    assert.equal(ext.nmtNoulValue(null), null);
    assert.equal(ext.nmtNoulValue({}), null);
    assert.equal(ext.nmtNoulValue({ value: 'high' }), null);
  });
});

describe('내려간 배지 문구', () => {
  it('원래 분류를 남기고 상태만 덧붙인다', () => {
    // 처리함이라고만 쓰면 읽기만 하고 답장하지 않은 경우에도 처리했다고 읽힌다
    assert.equal(ext.nmtDoneLabel('reply'), '답장 필요 (읽음)');
    assert.equal(ext.nmtDoneLabel('task'), '처리 필요 (읽음)');
  });

  it('분류를 모르면 상태만 적는다', () => {
    assert.equal(ext.nmtDoneLabel(''), '읽음');
    assert.equal(ext.nmtDoneLabel(undefined), '읽음');
  });
});

describe('프로파일', () => {
  it('주소로 서비스를 고른다', () => {
    assert.equal(loadFor('https://mail.google.com/mail/u/0/#inbox').nmtProfile().id, 'gmail');
    assert.equal(loadFor('https://mail.naver.com/v2/folders/0/all').nmtProfile().id, 'naver');
    assert.equal(loadFor('https://mail.worksmobile.com/w/all').nmtProfile().id, 'naverworks');
  });

  it('모르는 주소에는 프로파일이 없다', () => {
    assert.equal(loadFor('https://example.com/').nmtProfile(), null);
  });

  it('읽음 판정 축을 하나씩만 쓴다', () => {
    // 축이 여럿이면 어느 것이 쓰였는지 알 수 없어 오판을 추적하지 못한다
    for (const p of valueIn(ext, 'NMT_PROFILES')) {
      const axes = ['unreadRowClass', 'readRowClass', 'readChildMark'].filter((k) => p[k]);
      assert.equal(axes.length, 1, p.id + ' 의 읽음 판정 축: ' + axes.join(', '));
    }
  });
});

describe('읽음 판정', () => {
  // 행을 흉내 낸다. 판정 함수는 클래스와 자식 요소만 본다
  const row = (classes = [], child = null) => ({
    classList: { contains: (c) => classes.includes(c) },
    querySelector: (sel) => (child === sel ? {} : null),
  });

  it('네이버웍스는 notRead 가 붙은 행만 안 읽음이다', () => {
    // 읽음 아이콘의 부재를 안 읽음으로 읽으면 100행 중 25건이 오판된다
    const p = loadFor('https://mail.worksmobile.com/w/all').nmtProfile();
    assert.equal(ext.nmtIsUnread(row(['cv_master', 'notRead']), p), true);
    assert.equal(ext.nmtIsUnread(row(['cv_master']), p), false);
    assert.equal(ext.nmtIsUnread(row([]), p), false);
  });

  it('Gmail 은 yO 가 없는 행이 안 읽음이다', () => {
    const p = loadFor('https://mail.google.com/mail/u/0/').nmtProfile();
    assert.equal(ext.nmtIsUnread(row(['zA', 'zE']), p), true);
    assert.equal(ext.nmtIsUnread(row(['zA', 'yO']), p), false);
  });

  it('네이버 메일은 read 가 없는 행이 안 읽음이다', () => {
    const p = loadFor('https://mail.naver.com/v2/folders/0/all').nmtProfile();
    assert.equal(ext.nmtIsUnread(row([]), p), true);
    assert.equal(ext.nmtIsUnread(row(['read']), p), false);
  });

  it('데모 화면의 로컬 주소를 받는다', () => {
    // test/fixtures 의 데모가 Gmail 구조를 쓴다. manifest 에 로컬 권한이 없으면
    // 확장이 그 페이지에 주입되지 않으므로 배포본에서는 열리지 않는다
    assert.equal(loadFor('http://localhost:8347/inbox.html').nmtProfile().id, 'gmail');
    assert.equal(loadFor('http://127.0.0.1:8347/inbox.html').nmtProfile().id, 'gmail');
  });

  it('이름이 비슷한 다른 주소를 로컬로 보지 않는다', () => {
    // 앵커가 없으면 localhost 를 품은 아무 도메인이나 통과한다
    for (const url of [
      'https://evil-localhost.com/',
      'https://localhost.attacker.com/',
      'https://mail.google.com.evil.example/',
    ]) {
      assert.equal(loadFor(url).nmtProfile(), null, url);
    }
  });

  it('모르는 서비스에서는 판정하지 않는다', () => {
    // false 를 돌려주면 안 읽은 것만 보기에서 전부 걸러진다
    const unknown = loadFor('https://example.com/');
    assert.equal(unknown.nmtIsUnread(row([]), unknown.nmtProfile()), null);
  });
});

describe('사용자가 정한 발신자', () => {
  const mail = (email, sender = '') => ({ email, sender });

  it('주소 일부만 적어도 맞는다', () => {
    assert.equal(ext.nmtSenderMatchLength(mail('ceo@example.com'), 'ceo@example.com') > 0, true);
    assert.equal(ext.nmtSenderMatchLength(mail('kim@partner.co.kr'), '@partner.co.kr') > 0, true);
    assert.equal(ext.nmtSenderMatchLength(mail('deploy-bot@ci.example.com'), 'deploy-bot') > 0, true);
  });

  it('발신자 이름으로도 맞는다', () => {
    // 네이버 계열은 목록에서 주소를 못 뽑는 경우가 있다
    assert.equal(ext.nmtSenderMatchLength(mail('', '홍길동'), '홍길동') > 0, true);
  });

  it('대소문자를 가리지 않는다', () => {
    assert.equal(ext.nmtSenderMatchLength(mail('CEO@Example.COM'), 'ceo@example.com') > 0, true);
  });

  it('여러 줄 중 하나만 맞아도 된다', () => {
    const list = 'ceo@example.com\n@partner.co.kr\ndeploy-bot';
    assert.equal(ext.nmtSenderMatchLength(mail('x@partner.co.kr'), list) > 0, true);
    assert.equal(ext.nmtSenderMatchLength(mail('x@other.com'), list) > 0, false);
  });

  it('빈 줄과 한 글자는 무시한다', () => {
    // 한 글자를 그대로 쓰면 거의 모든 주소에 맞아 목록 전체가 무의미해진다
    assert.equal(ext.nmtSenderMatchLength(mail('hong@example.com'), 'a') > 0, false);
    assert.equal(ext.nmtSenderMatchLength(mail('hong@example.com'), '\n\n  \n') > 0, false);
    assert.equal(ext.nmtSenderMatchLength(mail('hong@example.com'), '') > 0, false);
  });

  it('발신자를 못 뽑았으면 맞지 않는다', () => {
    assert.equal(ext.nmtSenderMatchLength(mail('', ''), 'ceo@example.com') > 0, false);
  });

  it('걸린 줄 가운데 가장 긴 것을 적힌 그대로 돌려준다', () => {
    // 툴팁이 이 줄을 보여 준다. 소문자로 바꿔 돌려주면 사용자가 목록에서 그 줄을 찾기 어렵다
    const list = '@Partner.co.kr\nKim@Partner.co.kr\n  \nk';
    assert.equal(ext.nmtSenderMatch(mail('kim@partner.co.kr'), list), 'Kim@Partner.co.kr');
    assert.equal(ext.nmtSenderMatch(mail('lee@partner.co.kr'), list), '@Partner.co.kr');
    assert.equal(ext.nmtSenderMatch(mail('lee@other.com'), list), '');
    assert.equal(ext.nmtSenderMatch(mail('lee@other.com'), ''), '');
    // 한 글자 줄은 걸린 줄로 돌려주지 않는다. 돌려주면 툴팁이 k 에 걸렸다고 적는다
    assert.equal(ext.nmtSenderMatch(mail('kim@other.com'), list), '');
  });
});

describe('두 목록이 겹칠 때', () => {
  const mail = (email, sender = '') => ({ email, sender });

  it('같은 줄을 양쪽에 적었으면 확인이 이긴다', () => {
    // 놓치는 쪽이 더 나쁘다. 설정 화면이 저장할 때 이 사실을 알려 준다
    const m = mail('ceo@example.com');
    assert.equal(ext.nmtSenderRule(m, 'ceo@example.com', 'ceo@example.com'), 'show');
  });

  it('더 구체적으로 적은 쪽이 이긴다', () => {
    // 도메인 전체를 무시로 두고 그중 한 사람만 확인으로 두는 경우
    assert.equal(ext.nmtSenderRule(mail('ceo@x.com'), 'ceo@x.com', '@x.com'), 'show');
    // 반대도 성립해야 한다. 앞서 검사하는 쪽이 이기면 이 경우가 틀린다
    assert.equal(ext.nmtSenderRule(mail('spam@x.com'), '@x.com', 'spam@x.com'), 'mute');
  });

  it('한쪽에만 있으면 그쪽이 적용된다', () => {
    assert.equal(ext.nmtSenderRule(mail('a@x.com'), 'a@x.com', ''), 'show');
    assert.equal(ext.nmtSenderRule(mail('a@x.com'), '', 'a@x.com'), 'mute');
  });

  it('어느 목록에도 없으면 규칙이 없다', () => {
    // 빈 문자열이어야 모델 판정으로 넘어간다
    assert.equal(ext.nmtSenderRule(mail('a@x.com'), 'b@y.com', 'c@z.com'), '');
    assert.equal(ext.nmtSenderRule(mail('a@x.com'), '', ''), '');
  });
});

describe('설정과 캐시의 관계', () => {
  // 설정을 바꿀 때 판정을 비워야 하는지가 반복해서 문제가 됐다. 판정 입력으로 보내는 역할과
  // 본인 이름과 주소만 키에 들어가고, 나머지는 캐시보다 먼저 적용되거나 저장된 값을 다시 비교한다
  it('강조 강도는 캐시 키에 들어가지 않는다', () => {
    // 들어가면 문턱을 조금 바꿀 때마다 전 건이 다시 호출된다
    assert.equal(ext.nmtVerdictKey('gmail:1', '역할').length, ext.nmtVerdictKey('gmail:1', '역할').length);
    assert.equal(
      ext.nmtVerdictKey.length,
      3,
      'nmtVerdictKey 가 받는 인자는 메일 키와, 판정 입력으로 보내는 역할과 본인 이름과 주소뿐이어야 한다'
    );
  });

  it('역할만 키를 가른다', () => {
    const a = ext.nmtVerdictKey('gmail:1', '서버 개발자');
    const b = ext.nmtVerdictKey('gmail:1', '서버 개발자 ');
    assert.notEqual(a, b, '공백 하나도 다른 문장이므로 키가 달라야 한다');
  });
});

describe('제목으로도 거른다', () => {
  const mail = (subject, email = 'someone@example.com', sender = '') => ({ email, sender, subject });

  it('제목에 든 말로 맞춘다', () => {
    // 보내는 곳이 매번 다른 것은 발신자로 가를 수 없다
    assert.ok(ext.nmtSenderMatchLength(mail('[무료] 클라우드 웨비나 초대'), '웨비나') > 0);
    assert.ok(ext.nmtSenderMatchLength(mail('이번 주 뉴스레터 38호'), '뉴스레터') > 0);
  });

  it('제목과 발신자를 한 목록이 함께 맡는다', () => {
    const list = '@partner.co.kr\n웨비나';
    assert.ok(ext.nmtSenderMatchLength(mail('아무 제목', 'a@partner.co.kr'), list) > 0);
    assert.ok(ext.nmtSenderMatchLength(mail('웨비나 초대', 'b@other.com'), list) > 0);
    assert.equal(ext.nmtSenderMatchLength(mail('보고서', 'c@other.com'), list), 0);
  });

  it('겹칠 때는 더 구체적으로 적은 쪽이 이긴다', () => {
    // 프로모션은 무시하되 그중 특정 건만 보고 싶은 경우
    const m = mail('[프로모션] 상반기 결산 세미나', 'events@x.com');
    assert.equal(ext.nmtSenderRule(m, '상반기 결산 세미나', '프로모션'), 'show');
    assert.equal(ext.nmtSenderRule(m, '세미나', '[프로모션] 상반기'), 'mute');
  });
});
