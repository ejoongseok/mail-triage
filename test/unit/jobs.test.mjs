/**
 * 직군 예시와 추천 단어.
 *
 * 설정 화면만 쓰는 파일이라 확장 본체와 따로 불러온다. 화면 언어에 따라 목록이 갈리므로
 * 두 언어를 각각 불러 같은 규칙을 확인한다.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { ROOT, valueIn } from '../harness.mjs';

function loadJobs(lang) {
  const ctx = vm.createContext({ chrome: { i18n: { getUILanguage: () => lang } } });
  vm.runInContext(readFileSync(join(ROOT, 'src/jobs.js'), 'utf8'), ctx, { filename: 'src/jobs.js' });
  return ctx;
}

const head = (text) => text.split('. ')[0];

// 목록 규칙은 제목의 일부만 맞아도 걸린다. 짧은 말은 엉뚱한 메일에 두루 걸리므로(시안 은
// 아시안 에, tender 는 bartender 에) 두 글자 한국어와 영어 한 단어는 여기 올린 것만 쓴다.
// 여기 올릴 때는 그 말이 걸리는 범위를 이유 문장에 적는다
const SHORT_OK = new Set(['긴급', '불량', '과제', 'docusign', 'rfp', 'firing:', 'triggered', 'disapproved', 'escalation', 'assignment']);

// 계정이나 돈을 미끼로 삼는 말과, 사칭 메일 제목에 흔한 말. 항상 확인에 들면 모델을 건너뛰고
// 강조 표시를 받는다. 사칭에도 쓰이는 업무 서식 이름(세금계산서, 발주서)은 src/jobs.js 머리
// 주석대로 그 서식을 처리하는 직군에만 두므로 여기 넣지 않는다
const LURES = ['urgent', 'invoice', 'payment', 'remittance', 'suspended', 'verify', 'password', '결제 실패', '입금', '송금', '계정 정지', '비밀번호'];

for (const lang of ['ko', 'en']) {
  describe(`직군 추천 단어 (${lang})`, () => {
    const ctx = loadJobs(lang);
    const items = ctx.nmtJobs().flatMap((g) => g.items);
    const hints = valueIn(ctx, `NMT_JOB_HINTS_BY_LANG.${lang}`);

    it('모든 직군에 추천 목록이 있고, 추천 목록은 모두 직군 목록에 있는 직군의 것이다', () => {
      // 권할 말이 없는 직군은 빈 목록으로 둔다. 목록이 아예 없으면 빠뜨린 것과 구별되지 않는다
      const names = items.map(([name]) => name);
      for (const name of names) assert.ok(Array.isArray(hints[name]), name + ' 의 추천 목록이 없다');
      for (const name of Object.keys(hints)) assert.ok(names.includes(name), name + ' 은 직군 목록에 없다');
    });

    it('추천 단어는 목록 규칙이 그대로 쓸 수 있는 한 줄이다', () => {
      // 한 글자는 목록 규칙이 무시하고, 줄바꿈이 있으면 두 줄로 들어간다
      for (const [name, list] of Object.entries(hints)) {
        const words = list.map(([w]) => w.toLowerCase());
        assert.equal(new Set(words).size, words.length, name + ' 에 같은 단어가 두 번 있다');
        for (const [word, why] of list) {
          assert.equal(word, word.trim(), `${name}: "${word}" 앞뒤에 공백이 있다`);
          assert.ok(word.length >= 2 && !word.includes('\n'), `${name}: "${word}"`);
          assert.ok(why.length >= 10, `${name}: "${word}" 의 이유가 비었다`);
        }
      }
    });

    it('짧은 말은 허용 목록에 있는 것만 쓰고, 이유 문장에 걸리는 범위를 적는다', () => {
      for (const [name, list] of Object.entries(hints)) {
        for (const [word, why] of list) {
          const short = /^[\x21-\x7e]+$/.test(word) || [...word].length <= 2;
          if (!short) continue;
          assert.ok(SHORT_OK.has(word.toLowerCase()), `${name}: "${word}" 는 짧아 두루 걸린다`);
          // 범위를 적으려면 그 말을 이유 문장에서 불러야 한다
          assert.ok(why.toLowerCase().includes(word.toLowerCase()), `${name}: "${word}" 의 이유에 걸리는 범위가 없다`);
        }
      }
    });

    it('피싱 메일이 내세우는 말은 권하지 않는다', () => {
      for (const [name, list] of Object.entries(hints)) {
        for (const [word] of list) {
          const hit = LURES.find((lure) => word.toLowerCase().includes(lure));
          assert.equal(hit, undefined, `${name}: "${word}"`);
        }
      }
    });

    it('직무 첫 문장이 직군마다 다르다', () => {
      // 고쳐 쓴 문장을 첫 문장으로 알아보므로, 겹치면 엉뚱한 직군의 추천이 나온다.
      // 알아볼 때 대소문자를 가리지 않으므로 여기서도 가리지 않고 비교한다
      const heads = items.map(([, text]) => head(text).toLowerCase());
      assert.equal(new Set(heads).size, heads.length);
    });

    it('예시를 그대로 쓰거나 고쳐 써도 그 직군으로 알아본다', () => {
      const tail = lang === 'ko' ? '직접 쓴 내용.' : 'My own words.';
      for (const [name, text] of items) {
        assert.equal(ctx.nmtJobHints(text)?.name, name);
        assert.equal(ctx.nmtJobHints(head(text) + '. ' + tail)?.name, name);
        assert.equal(ctx.nmtJobHints(`  ${head(text)}.  `)?.name, name);
        // 세 부분을 줄을 바꿔 적어도 같다. README 가 권하는 틀이다
        assert.equal(ctx.nmtJobHints(head(text) + '.\n' + tail)?.name, name);
        assert.equal(ctx.nmtJobHints(head(text).toUpperCase() + '. ' + tail)?.name, name);
      }
    });

    it('맞는 직군이 없으면 추천하지 않는다', () => {
      assert.equal(ctx.nmtJobHints(''), null);
      assert.equal(ctx.nmtJobHints(null), null);
      assert.equal(ctx.nmtJobHints(lang === 'ko' ? '광고 대행사 대표. 광고주 문의.' : 'Agency owner. Client mail.'), null);
    });
  });
}

describe('직군을 첫 문장으로 알아볼 때', () => {
  it('끝이 같은 다른 직무와 헷갈리지 않는다', () => {
    // 스타트업 대표 는 대표 로 끝나지만 대표와 CEO 가 아니다
    const ko = loadJobs('ko');
    assert.equal(ko.nmtJobHints('스타트업 대표. 투자자 연락.').name, '스타트업 창업자');
    assert.equal(ko.nmtJobHints('대표. 결재.').name, '대표와 CEO');
  });

  it('목록이 없는 언어는 영어 목록과 영어 추천을 쓴다', () => {
    const ja = loadJobs('ja');
    assert.equal(ja.nmtJobs()[0].items[0][0], loadJobs('en').nmtJobs()[0].items[0][0]);
    assert.equal(ja.nmtJobHints('Team lead. Anything.').name, 'Team lead / Manager');
    assert.ok(ja.nmtJobHints('Team lead. Anything.').hints.length > 0);
  });
});

describe('추천 단어를 목록에 더할 때', () => {
  const ctx = loadJobs('ko');

  it('빈 목록이면 그 줄만 넣는다', () => {
    assert.equal(ctx.nmtListAdd('', '긴급'), '긴급');
    assert.equal(ctx.nmtListAdd(undefined, '긴급'), '긴급');
  });

  it('기존 줄은 두고 끝에 한 줄을 더한다', () => {
    assert.equal(ctx.nmtListAdd('ceo@example.com\n웨비나\n\n', '긴급'), 'ceo@example.com\n웨비나\n긴급');
  });

  it('이미 있는 줄은 대소문자가 달라도 다시 넣지 않는다', () => {
    // 목록 규칙은 대소문자를 가리지 않으므로 같은 줄이다
    const list = 'ceo@example.com\n  failed PIPELINE  ';
    assert.equal(ctx.nmtListHas(list, 'Failed pipeline'), true);
    assert.equal(ctx.nmtListAdd(list, 'Failed pipeline'), list);
  });

  it('일부만 겹치는 줄은 다른 줄로 본다', () => {
    // 긴급조치 는 긴급 을 품지만 다른 줄이다. 같다고 보면 추가 버튼이 꺼진다
    assert.equal(ctx.nmtListHas('긴급조치', '긴급'), false);
    assert.equal(ctx.nmtListAdd('긴급조치', '긴급'), '긴급조치\n긴급');
  });

  it('설정 화면의 추가 버튼은 저장 버튼과 같은 길로 곧바로 저장한다', () => {
    // 툴바 팝업은 메일 화면으로 제목을 확인하러 가는 순간 닫힌다. 저장 버튼을 기다리면
    // 추가됨 이라고 보인 단어가 사라진다. 따로 저장하면 저장 버튼의 검사(빠진 칸, 두 목록의
    // 겹침)를 건너뛴다. 화면 코드라 소스에서 확인한다
    const src = readFileSync(join(ROOT, 'src/options.js'), 'utf8').replace(/\r\n/g, '\n');
    const start = src.indexOf('function renderHints(');
    const body = src.slice(start, src.indexOf('\n}\n', start));
    assert.ok(start >= 0, 'renderHints 본문을 찾지 못했다');
    assert.ok(body.includes('nmtListAdd('), '추가 버튼이 목록 함수를 쓰지 않는다');
    assert.ok(body.includes('saveAll('), '추가 버튼이 저장 버튼의 저장 함수를 쓰지 않는다');
    assert.ok(!/storage\.sync\.set\(/.test(body), '추가 버튼이 검사를 건너뛰고 따로 저장한다');
    // 항상 무시에 있는 단어를 더하면 두 목록에 같은 줄이 생기고 무시가 조용히 뒤집힌다
    assert.ok(/nmtListHas\(\$\('alwaysMute'\)/.test(body), '추가 버튼이 항상 무시 칸을 보지 않는다');
  });
});
