/**
 * 실제 메일함에서 돌리는 전수 진단.
 *
 * 확장을 올린 메일함에서 분류를 한 번 돌린 뒤, 브라우저 콘솔(F12)에 이 파일을 통째로
 * 붙여 넣는다. 화면에 붙은 표시만 보므로 확장 코드와 따로 놀지 않는다.
 *
 * 이 진단이 잡아 온 것들:
 *   네이버웍스 읽음 판정 오판 (100행 중 25건을 안 읽음으로 봤는데 실제로는 1건)
 *   목록 재생성 뒤 일부 행만 판정된 상태 (34행 중 24건)
 *   상태 속성과 클래스가 갈린 구간
 *
 * 표본 몇 개로 확인하면 우연히 맞는 경우가 있다. 그래서 전부 센다.
 */

(() => {
  const ACTION_KINDS = new Set(['reply', 'task', 'approval', 'schedule']);

  const rows = [...document.querySelectorAll('[data-nmt-state]')];
  const allRows = (() => {
    // 확장이 고른 목록을 모르므로, 표시가 붙은 행의 부모에서 형제를 센다
    const parent = rows[0]?.parentElement;
    return parent ? [...parent.children] : rows;
  })();

  if (!rows.length) {
    console.warn('[audit] 표시가 붙은 행이 없습니다. 분류하기를 먼저 누르십시오.');
    return;
  }

  /* 1) 분모 ---------------------------------------------------------------- */

  const marked = rows.length;
  const total = allRows.length;
  const coverage = {
    '목록의 행': total,
    '판정된 행': marked,
    '표시 없는 행': total - marked,
  };

  /* 2) 불변식 -------------------------------------------------------------- */

  const violations = [];

  // 행동형 배지가 붙은 행은 반드시 강조된다
  document.querySelectorAll('.nmt-badge').forEach((b) => {
    const row = b.closest('[data-nmt-state]');
    if (!row) return;
    if (ACTION_KINDS.has(b.dataset.kind) && row.dataset.nmtState !== 'act') {
      violations.push('강조 없는 행동형 배지: ' + b.dataset.kind + ' / ' + b.textContent);
    }
  });

  // 상태 속성과 클래스가 갈리면 화면과 숫자가 어긋난다
  for (const [state, cls] of [
    ['act', 'nmt-act'],
    ['low', 'nmt-low'],
    ['done', 'nmt-done'],
  ]) {
    const byAttr = document.querySelectorAll('[data-nmt-state="' + state + '"]').length;
    const byCls = document.querySelectorAll('.' + cls).length;
    if (byAttr !== byCls) {
      violations.push(state + ': 속성 ' + byAttr + '개인데 클래스 ' + byCls + '개');
    }
  }

  // 패널 숫자와 화면의 강조 수가 같다
  const statusText = document.getElementById('nmt-status')?.textContent ?? '';
  const said = statusText.match(/(\d+)/);
  const shown = document.querySelectorAll('[data-nmt-state="act"]').length;
  if (said && Number(said[1]) !== shown && !/아직|not sorted/.test(statusText)) {
    violations.push('패널은 ' + said[1] + '건인데 강조된 행은 ' + shown + '개');
  }

  // 표시가 붙은 행은 모두 메일 식별자를 가진다. 없으면 클릭해도 기록되지 않는다
  const keyless = rows.filter((r) => r.dataset.nmtState === 'act' && !r.dataset.nmtKey);
  if (keyless.length) violations.push('식별자가 없는 강조 행 ' + keyless.length + '개');

  /* 3) 읽음 판정 ----------------------------------------------------------- */

  // 확장의 판정은 배지의 (읽음) 표시로 드러난다. 그것을 화면의 단서와 대조한다.
  // 단서가 전 행에서 같으면 그 서비스는 그 축으로 읽음을 표시하지 않는 것이므로
  // 판정 불가로 적는다. 굵기가 같다고 판정이 맞다는 뜻이 아니다
  const readMark = (r) => /\(읽음\)|\(read\)/.test(r.querySelector('.nmt-badge')?.textContent ?? '');
  const weightOf = (r) => {
    const t = r.querySelector('strong, .y6, [class*="title"], [class*="subject"]');
    return t ? Number(getComputedStyle(t).fontWeight) || 400 : 400;
  };

  const weights = new Set(rows.map(weightOf));
  let readAudit;
  if (weights.size < 2) {
    readAudit = '판정 불가 (이 서비스는 제목 굵기로 읽음을 구분하지 않습니다. 굵기 ' + [...weights] + ')';
  } else {
    const heavy = Math.max(...weights);
    const table = { '확장 읽음, 화면 읽음': 0, '확장 읽음, 화면 안읽음': 0, '확장 안읽음, 화면 읽음': 0, '확장 안읽음, 화면 안읽음': 0 };
    rows.forEach((r) => {
      const ext = readMark(r) ? '확장 읽음' : '확장 안읽음';
      const scr = weightOf(r) >= heavy ? '화면 안읽음' : '화면 읽음';
      table[ext + ', ' + scr] += 1;
    });
    const wrong = table['확장 읽음, 화면 안읽음'] + table['확장 안읽음, 화면 읽음'];
    readAudit = table;
    if (wrong) violations.push('읽음 판정이 화면과 어긋난 행 ' + wrong + '개');
  }

  /* 4) 보고 ---------------------------------------------------------------- */

  console.log('%c[audit] 분모', 'font-weight:bold');
  console.table(coverage);

  console.log('%c[audit] 상태 분포', 'font-weight:bold');
  console.table({
    '확인 필요': document.querySelectorAll('[data-nmt-state="act"]').length,
    '확인 불필요': document.querySelectorAll('[data-nmt-state="low"]').length,
    '내려감': document.querySelectorAll('[data-nmt-state="done"]').length,
    '접혀 있음': document.querySelectorAll('.nmt-hidden').length,
  });

  console.log('%c[audit] 읽음 판정 대조', 'font-weight:bold');
  console.table(readAudit);

  if (violations.length) {
    console.warn('%c[audit] 불변식 위반 ' + violations.length + '건', 'color:#b42318;font-weight:bold');
    violations.forEach((v) => console.warn('  - ' + v));
  } else {
    console.log('%c[audit] 불변식 위반 없음', 'color:#1a7f37;font-weight:bold');
  }

  return { coverage, violations, readAudit };
})();
