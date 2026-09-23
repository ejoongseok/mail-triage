/**
 * 역할 문장 두 가지를 같은 메일함에 돌려 판정이 얼마나 갈리는지 잰다.
 *
 * 역할 문장이 판정을 가장 크게 바꾼다는 것은 알지만, 어떤 형식이 더 나은지는 재 본 적이
 * 없다. 37개 문장을 전부 고치기 전에 한 직무로 먼저 확인한다.
 *
 * 쓰는 법
 *   1. 설정에 형식 A 문장을 넣고 저장한다
 *   2. 메일함에서 분류하기를 누른다
 *   3. 콘솔에 이 파일을 붙여 넣고  nmtAB.save('A')
 *   4. 설정에 형식 B 문장을 넣고 저장한다 (역할이 바뀌면 캐시 키도 바뀌어 다시 판정된다)
 *   5. 다시 분류하기를 누른다
 *   6. nmtAB.save('B')  그다음  nmtAB.compare()
 *
 * 비용은 목록에 보이는 만큼 두 번이다. 50건이면 0.002달러쯤 된다.
 *
 * 비교할 두 형식
 *
 *   A (지금 쓰는 것) — 챙길 것만 나열한다
 *     서버 개발자. 배포와 장애 대응, 코드 리뷰 요청, API 연동 문의,
 *     인프라 비용 알림을 챙긴다.
 *
 *   B (대조군) — 답할 것과 읽기만 할 것을 함께 준다
 *     서버 개발자. 장애와 배포 알림, 코드 리뷰 요청, API 연동 문의에 직접 답한다.
 *     사내 공지와 채용 공고와 외부 뉴스레터는 읽기만 한다.
 *
 * 기록은 sessionStorage 에 둔다. 탭을 닫으면 사라지므로 제목이 남지 않는다.
 */

(() => {
  const KEY = 'nmt_ab';

  const subjectOf = (row) => {
    const el = row.querySelector(
      '.y6, strong.mail_title, .mail_title .text, [class*="subject"], [class*="title"]'
    );
    return (el?.textContent ?? row.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  };

  const snapshot = () =>
    [...document.querySelectorAll('[data-nmt-state]')]
      .filter((r) => r.dataset.nmtKey)
      .map((r) => ({
        key: r.dataset.nmtKey,
        state: r.dataset.nmtState,
        badge: r.querySelector('.nmt-badge')?.textContent ?? '',
        subject: subjectOf(r),
      }));

  const read = () => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
    } catch (_) {
      return {};
    }
  };

  window.nmtAB = {
    save(label) {
      const rows = snapshot();
      if (!rows.length) {
        console.warn('[ab] 표시가 붙은 행이 없습니다. 분류하기를 먼저 누르십시오.');
        return;
      }
      const all = read();
      all[label] = rows;
      sessionStorage.setItem(KEY, JSON.stringify(all));
      console.log('[ab] ' + label + ' 기록: ' + rows.length + '행');
    },

    compare() {
      const { A, B } = read();
      if (!A || !B) {
        console.warn('[ab] A 와 B 를 모두 기록해야 합니다.');
        return;
      }

      const byKey = new Map(B.map((r) => [r.key, r]));
      const pairs = A.filter((a) => byKey.has(a.key)).map((a) => ({ a, b: byKey.get(a.key) }));
      const moved = pairs.filter(({ a, b }) => a.state !== b.state);

      const count = (rows, s) => rows.filter((r) => r.state === s).length;
      console.log('%c[ab] 확인 필요 건수', 'font-weight:bold');
      console.table({
        A: { '확인 필요': count(A, 'act'), '확인 불필요': count(A, 'low'), 전체: A.length },
        B: { '확인 필요': count(B, 'act'), '확인 불필요': count(B, 'low'), 전체: B.length },
      });

      console.log(
        '%c[ab] 판정이 갈린 행 ' + moved.length + ' / 짝지은 행 ' + pairs.length,
        'font-weight:bold'
      );
      if (moved.length) {
        console.table(
          moved.map(({ a, b }) => ({
            제목: a.subject,
            A: a.state + ' ' + a.badge,
            B: b.state + ' ' + b.badge,
          }))
        );
      }

      // 어느 쪽이 맞는지는 사람이 본다. 갈린 행만 보면 되므로 전수 확인보다 훨씬 싸다
      console.log(
        '갈린 행을 하나씩 보고 어느 쪽이 맞는지 세십시오. ' +
          'B 가 더 자주 맞으면 형식을 바꿀 근거가 됩니다.'
      );
      return { moved: moved.length, paired: pairs.length };
    },

    clear() {
      sessionStorage.removeItem(KEY);
      console.log('[ab] 기록을 지웠습니다.');
    },
  };

  console.log('[ab] 준비됐습니다. nmtAB.save("A") / nmtAB.save("B") / nmtAB.compare()');
})();
