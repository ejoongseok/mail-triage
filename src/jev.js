/**
 * Jev 요청을 만들고 응답을 읽는다.
 *
 * 실제 HTTP 호출은 background.js 가 한다. content script 에서 직접 부르면 페이지의
 * CORS 와 CSP 에 막힌다.
 *
 * 한 메일에 대해 세 가지를 한 번의 호출로 묻는다. 질문을 늘려도 응답 시간이 거의 변하지
 * 않는 성질을 쓴다.
 *   action   행동이 필요한가        Noul
 *   kind     어떤 종류인가          Choice
 *   deadline 정해진 시점까지 할 일이 있는가  Noul
 *
 * 읽음 여부는 보내지 않는다. 답을 기다리는 메일인가는 받는 사람이 열어 봤는지와 무관한
 * 성질이고, 무엇보다 캐시 키에는 읽음 여부가 없어 판정이 처음 분류한 시점의 상태로 굳는다.
 * 안 읽은 것만 보려면 설정의 명시적 항목을 쓴다.
 *
 * 키는 사용자가 설정 화면에 넣는다. 확장 코드에는 어떤 키도 들어 있지 않다.
 */

const NMT_MODEL = 'jev-latest';

/**
 * 상태 문장의 최대 길이. 중계가 이보다 긴 요청을 받지 않는다.
 *
 * 역할 문장을 길게 붙여 넣은 사람도 판정이 멈추지 않도록, 넘치면 미리보기부터 줄인다.
 * 역할과 신원과 제목은 판정에 더 중요하므로 각자의 상한 안에서 그대로 둔다.
 */
const NMT_STATE_MAX = 1500;

const NMT_KINDS = {
  reply: '사람이 보냈고 받는 사람이 답장을 써야 진행된다. 질문, 의견 요청, 검토 회신 요구',
  task: '사람이 보냈고 받는 사람이 무언가를 처리해야 진행된다. 계정 발급, 권한 부여, 자료나 파일 전달, 구매와 설정 변경, 시스템 작업 요청',
  approval: '사람이 보냈고 받는 사람의 승인이나 결재나 서명을 기다린다',
  schedule: '일정 조율, 회의 소집, 참석 확인',
  fyi: '사람이 보낸 공유나 통지나 정기 보고. 답이 없어도 진행된다',
  vendor: '외부 업체의 영업이나 홍보나 제휴 제안',
  system:
    '사람이 아니라 시스템이나 서비스가 자동으로 보냈다. 발신자가 서비스 이름이거나 발신전용이거나 알림 봇인 경우만 해당한다. 사람이 보낸 정기 보고는 여기가 아니다',
  sent: '받는 사람 본인이 보낸 메일이다. 발신자가 나 자신인 경우',
  other: '위 어디에도 맞지 않음',
};

/** 응답에서 확률 값을 꺼낸다. 표기가 문헌마다 달라 후보를 순서대로 본다. */
function nmtNoulValue(ans) {
  if (!ans) return null;
  for (const k of ['value', 'noul', 'probability', 'score']) {
    if (typeof ans[k] === 'number') return ans[k];
  }
  if (typeof ans === 'number') return ans;
  return null;
}

/** 메일 한 건을 판정한다. 실패하면 error 를 담아 돌려주고 호출자가 행을 건드리지 않는다. */
async function nmtJudge(mail, settings) {
  const lines = [
    `[받는 사람] ${String(settings.persona ?? '').slice(0, 400)}`,
    settings.myIdentity ? `[받는 사람의 이름과 주소] ${String(settings.myIdentity).slice(0, 120)}` : '',
    `[발신자] ${String(mail.sender || '미상').slice(0, 100)}${mail.email ? ` <${String(mail.email).slice(0, 120)}>` : ''}`,
    `[제목] ${(mail.subject || '(제목 없음)').slice(0, 300)}`,
  ].filter(Boolean);

  // 한 줄이 더 붙으므로 줄바꿈 한 글자를 함께 센다
  const room = Math.min(500, NMT_STATE_MAX - lines.join('\n').length - 1 - '[미리보기] '.length);
  if (mail.preview && room > 0) lines.push(`[미리보기] ${mail.preview.slice(0, room)}`);

  const state = lines.join('\n').slice(0, NMT_STATE_MAX);

  const body = {
    model: NMT_MODEL,
    state,
    questions: {
      action: {
        type: 'noul',
        instructions: '이 메일은 받는 사람의 답변이나 행동을 기다리고 있는가?',
        criteria: {
          true: '명시적 질문이나 요청이나 승인 대기나 기한이 있다',
          false: '공유와 통지와 참고용이거나 자동 발송이다',
        },
      },
      kind: {
        type: 'choice',
        instructions: '이 메일은 어떤 종류인가?',
        criteria: NMT_KINDS,
      },
      deadline: {
        type: 'noul',
        instructions: '받는 사람이 정해진 시점까지 무언가를 해야 하는가?',
        criteria: {
          true: '회신 기한이나 제출 마감이나 참석해야 할 일시가 있다',
          false:
            '기한이 없다. 날짜가 적혀 있어도 이미 지난 일을 알리거나 언제 일어난 일인지 표시하는 것뿐이면 여기에 해당한다',
        },
      },
    },
  };

  let reply;
  try {
    // 키를 실어 보내지 않는다. background 가 저장소에서 직접 읽는다
    reply = await chrome.runtime.sendMessage({ type: 'jev-call', body });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (/context invalidated|Receiving end does not exist/i.test(msg)) {
      return { error: nmtMsg('contextDead'), fatal: true };
    }
    return { error: msg, fatal: true };
  }

  if (!reply) return { error: nmtMsg('contextDead'), fatal: true };

  if (reply.errorCode) {
    // fatal 은 남은 건을 더 호출해도 같은 결과라는 뜻이다
    switch (reply.errorCode) {
      case 'auth':
        return { error: nmtMsg('errKeyRejected'), fatal: true };
      case 'rate':
        return { error: nmtMsg('errRateLimit'), fatal: true };
      case 'network':
        return { error: `${reply.detail}` };
      case 'needKey':
        return { error: nmtMsg('errNeedKey'), fatal: true };
      case 'relayQuota':
        return { error: nmtMsg('errRelayQuota'), fatal: true };
      case 'relayPool':
        return { error: nmtMsg('errRelayPool'), fatal: true };
      case 'relayDenied':
        return { error: nmtMsg('errRelayDenied'), fatal: true };
      case 'relayClosed':
        return { error: nmtMsg('errRelayClosed'), fatal: true };
      case 'relayNew':
        return { error: nmtMsg('errRelayNew'), fatal: true };
      case 'relayBurst':
        return { error: nmtMsg('errRelayBurst'), fatal: true };
      case 'relayVersion':
        return { error: nmtMsg('errRelayVersion'), fatal: true };
      case 'ownKeyMissing':
        return { error: nmtMsg('errOwnKeyMissing'), fatal: true };
      case 'storage':
        return { error: nmtMsg('errStorage'), fatal: true };
      case 'parse':
        return { error: nmtMsg('errNoAction') };
      default:
        return { error: `HTTP ${reply.status}${reply.detail ? ' ' + reply.detail : ''}` };
    }
  }

  const json = reply.json ?? {};
  const a = json.answers ?? json.results ?? json;

  const action = nmtNoulValue(a.action);
  if (action === null) {
    // 형식을 맞추려면 실제 응답을 봐야 한다. 앞부분을 콘솔에 남긴다
    console.warn('[mail-triage] no action field. response shape:', JSON.stringify(json).slice(0, 600));
    return { error: nmtMsg('errNoAction') };
  }

  // 응답도 이 확장 밖에서 온 값이다. 정해 둔 종류가 아니면 기타로 본다
  const kind = a.kind?.choice ?? a.kind?.value;

  return {
    action,
    kind: typeof kind === 'string' && Object.hasOwn(NMT_KINDS, kind) ? kind : 'other',
    kindConfidence: a.kind?.confidence ?? 0,
    deadline: nmtNoulValue(a.deadline) ?? 0,
    tokens: json.usage?.input_tokens ?? json.input_tokens ?? 0,
  };
}
