/**
 * 화면 없이 돌릴 수 있는 판정들.
 *
 * 각 시험은 docs/invariants.md 의 항목이나 실제로 겪은 결함에 대응한다. 통과하는 입력만
 * 넣으면 검사가 스스로를 증명하는 셈이 되므로, 틀린 답이 나와야 하는 입력을 함께 둔다.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { loadExtension, loadFor, valueIn } from '../harness.mjs';

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
  // 설정을 바꿀 때 판정을 비워야 하는지가 반복해서 문제가 됐다. 역할만 키에 들어가고
  // 나머지는 캐시보다 먼저 적용되거나 저장된 값을 다시 비교한다
  it('강조 강도는 캐시 키에 들어가지 않는다', () => {
    // 들어가면 문턱을 조금 바꿀 때마다 전 건이 다시 호출된다
    assert.equal(ext.nmtVerdictKey('gmail:1', '역할').length, ext.nmtVerdictKey('gmail:1', '역할').length);
    assert.equal(ext.nmtVerdictKey.length, 2, 'nmtVerdictKey 가 받는 인자는 메일 키와 역할뿐이어야 한다');
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
