/*
 * 사용자가 실제로 하는 순서대로 화면을 움직이고, 매 단계에서 표시가 맞는지 본다.
 *
 * 메일 서비스마다 목록을 다시 그리는 방식이 다르다. 새 DOM 으로 바꾸기도 하고, 행을 두고
 * 칸만 다시 그리거나 글자만 바꾸기도 한다. 마지막 경우에는 확장이 행에 붙인 것이 다른
 * 메일로 그대로 넘어간다. 그래서 같은 흐름을 세 방식으로 모두 돌린다.
 *
 * 결과는 페이지 아래 #result 에 JSON 으로 적는다. tools/scenario.py 가 그것을 읽는다.
 */
(async () => {
  const out = document.getElementById('result');
  const results = [];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // 목록 재생성 복원은 250ms 뒤에, 여는 클릭의 화면 정리는 400ms 뒤에 돈다
  const settle = () => sleep(900);

  const rows = () => [...document.querySelectorAll('#rows tr.zA')];
  const idOf = (tr) => tr.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id') ?? '';
  const keyOf = (tr) => 'gmail:' + idOf(tr);
  const mailOf = (tr) => nmtFixture.mailById(idOf(tr));
  const listShown = () => !document.getElementById('list').hidden;
  const detailShown = () => !document.getElementById('detail').hidden;
  const shown = (tr) => tr.isConnected && listShown() && getComputedStyle(tr).display !== 'none';
  const state = (tr) => tr.dataset.nmtState ?? '';
  const acts = () => rows().filter((tr) => state(tr) === 'act');
  const status = () => document.getElementById('nmt-status')?.textContent ?? '';
  const msg = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String));
  const expectedActs = () => rows().filter((tr) => (mailOf(tr)?.judge.action ?? 0) >= 0.7);

  /** 어느 화면에서든 성립해야 하는 것 */
  function invariants() {
    const bad = [];
    for (const tr of rows()) {
      const key = keyOf(tr);
      const st = state(tr);
      const badges = tr.querySelectorAll('.nmt-badge').length;
      if (st && tr.dataset.nmtKey !== key) bad.push(`${key}: 다른 메일(${tr.dataset.nmtKey ?? '키 없음'})의 상태 ${st} 가 남았다`);
      if (st === 'act' && (mailOf(tr)?.judge.action ?? 0) < 0.7) bad.push(`${key}: 확인 대상이 아닌 메일이 강조됐다`);
      if (badges > 1) bad.push(`${key}: 배지가 ${badges}개`);
      if (badges && !st) bad.push(`${key}: 상태 없이 배지만 남았다`);
      if (tr.dataset.nmtHidden && !nmtView.filtered) bad.push(`${key}: 접지 않았는데 감춰졌다`);
      if (tr.dataset.nmtHidden && !st) bad.push(`${key}: 판정하지 않은 메일이 감춰졌다`);
      if (tr.dataset.nmtHidden && st === 'act') bad.push(`${key}: 확인 대상이 감춰졌다`);
    }
    return bad;
  }

  function scenario(name) {
    const problems = [];
    const check = (label, ok, detail) => {
      if (!ok) problems.push(label + (detail === undefined ? '' : ` (${detail})`));
    };
    const same = () => invariants().forEach((p) => problems.push(p));
    return {
      check,
      same,
      done() {
        results.push({ name, ok: problems.length === 0, problems });
      },
    };
  }

  /* 동작 ------------------------------------------------------------------ */

  async function fresh({ mode = 'replace', openMode = 'remove' } = {}) {
    if (nmtFixture.state.opened) nmtFixture.back();
    nmtClearMarks();
    await chrome.storage.local.clear();
    NMT_TEST.calls = 0;
    NMT_TEST.delay = 0;
    Object.assign(nmtFixture.state, { page: 0, mode, openMode });
    document.getElementById('list').hidden = false;
    // 같은 쪽으로는 넘어가지 않으므로 쪽 번호를 비워 두고 1쪽을 새로 그린다
    document.getElementById('rows').replaceChildren();
    nmtFixture.state.page = -1;
    nmtFixture.go(0);
    await settle();
  }

  async function waitRun() {
    for (let i = 0; i < 400 && (nmtBusy || nmtView.phase === 'running'); i += 1) await sleep(50);
    await settle();
  }

  async function classify() {
    document.getElementById('nmt-run').click();
    await sleep(20);
    await waitRun();
  }

  async function press(tr) {
    const target = tr.querySelector('.y6') ?? tr;
    for (const type of ['mousedown', 'mouseup', 'click']) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, view: window }));
    }
    await settle();
  }

  const next = async () => {
    document.getElementById('next').click();
    await settle();
  };
  const prev = async () => {
    document.getElementById('prev').click();
    await settle();
  };
  const back = async () => {
    document.getElementById('back').click();
    await settle();
  };
  const toggleFilter = async () => {
    document.getElementById('nmt-status').click();
    await settle();
  };

  /* 시나리오 --------------------------------------------------------------- */

  for (const mode of ['replace', 'reuse-cells', 'reuse-text']) {
    const s = scenario(`분류 뒤 다음 페이지와 이전 페이지 (${mode})`);
    await fresh({ mode });
    await classify();
    const firstCalls = NMT_TEST.calls;
    const want = expectedActs().length;
    s.check('1쪽 확인 대상 수', acts().length === want, `${acts().length} / ${want}`);
    s.check('1쪽 안내 문구', status() === msg('doneActionable', want), status());
    s.same();

    await next();
    s.check('2쪽에 1쪽 판정이 남지 않는다', acts().length === 0, `강조 ${acts().length}건`);
    s.check('2쪽은 판정하지 않았다고 알린다', status().includes(String(rows().filter((tr) => !state(tr)).length)), status());
    s.check('넘기기만 해서는 판정을 부르지 않는다', NMT_TEST.calls === firstCalls, NMT_TEST.calls);
    s.same();

    await prev();
    s.check('돌아오면 1쪽 판정이 되살아난다', acts().length === want, `${acts().length} / ${want}`);
    s.check('돌아온 1쪽 안내 문구', status() === msg('doneActionable', want), status());
    s.check('돌아와도 판정을 다시 부르지 않는다', NMT_TEST.calls === firstCalls, NMT_TEST.calls);
    s.same();
    s.done();
  }

  {
    const s = scenario('확인할 메일만 본 채 메일을 열고 돌아오기');
    await fresh({ openMode: 'remove' });
    await classify();
    const want = expectedActs().length;
    await toggleFilter();
    s.check('접으면 확인 대상만 보인다', rows().filter(shown).length === want, rows().filter(shown).length);

    for (let left = want - 1; left >= want - 2; left -= 1) {
      const target = acts()[0];
      const id = idOf(target);
      await press(target);
      s.check('누르면 본문이 열린다', detailShown());
      await back();
      const again = rows().find((tr) => idOf(tr) === id);
      s.check('열어 본 메일은 목록에서 내려간다', again && state(again) === 'done', again && state(again));
      s.check('남은 수가 줄어든다', acts().length === left, `${acts().length} / ${left}`);
      s.check('돌아와도 확인할 메일만 보는 상태가 이어진다', nmtView.filtered === true);
      s.check('보이는 행은 남은 확인 대상뿐이다', rows().filter(shown).length === left, rows().filter(shown).length);
      s.check('안내 문구가 남은 수를 말한다', status() === msg('filterOn', left), status());
      s.same();
    }
    s.done();
  }

  {
    const s = scenario('확인할 메일만 본 채 다음 페이지로 넘기기');
    await fresh();
    await classify();
    const want = expectedActs().length;
    await toggleFilter();
    await next();
    const unjudged = rows().filter((tr) => !state(tr));
    s.check('판정하지 않은 메일은 감추지 않는다', unjudged.every(shown), `${unjudged.filter((tr) => !shown(tr)).length}건 감춰짐`);
    s.check('확인할 메일이 없는 쪽에서는 접기가 풀린다', nmtView.filtered === false);
    s.check('2쪽은 판정하지 않았다고 알린다', status() === msg('pendingRows', unjudged.length), status());
    s.same();

    await prev();
    s.check('1쪽으로 돌아오면 판정이 되살아난다', acts().length === want, acts().length);
    s.same();
    s.done();
  }

  for (const mode of ['replace', 'reuse-text']) {
    const s = scenario(`분류 도중에 다음 페이지로 넘기기 (${mode})`);
    await fresh({ mode });
    NMT_TEST.delay = 300;
    document.getElementById('nmt-run').click();
    await sleep(350);
    document.getElementById('next').click();

    // 끝난 뒤의 화면만 보면 마지막 맞추기가 틀린 표시를 덮어 가린다. 도는 도중을 본다.
    // 목록 맞추기는 변화가 멎고 250ms 뒤에 돌므로 그보다 늦게 본다
    await sleep(400);
    s.check('도는 도중에 본다', nmtBusy, '분류가 이미 끝나 도중을 보지 못했다');
    const during = invariants().filter((p) => p.includes('다른 메일'));
    s.check('도는 도중에도 2쪽에 1쪽 판정이 붙지 않는다', during.length === 0, during.join(' / '));

    await waitRun();
    s.check('분류가 끝난다', !nmtBusy && nmtView.phase !== 'running', nmtView.phase);
    s.check('2쪽에 1쪽 판정이 붙지 않는다', acts().length === 0, `강조 ${acts().length}건`);
    s.check('2쪽 안내가 진행률에 멈춰 있지 않다', status() === msg('pendingRows', rows().filter((tr) => !state(tr)).length), status());
    s.same();

    NMT_TEST.delay = 0;
    const calls = NMT_TEST.calls;
    await prev();
    const want = expectedActs().length;
    s.check('1쪽으로 돌아오면 받아 둔 판정이 붙는다', acts().length === want, `${acts().length} / ${want}`);
    s.check('돌아와도 판정을 다시 부르지 않는다', NMT_TEST.calls === calls, NMT_TEST.calls);
    s.same();
    s.done();
  }

  {
    const s = scenario('목록을 감췄다 다시 보이는 메일 서비스에서 열고 돌아오기');
    await fresh({ openMode: 'hide' });
    await classify();
    const want = expectedActs().length;
    const target = acts()[0];
    await press(target);
    await back();
    s.check('열어 본 메일은 내려간다', state(target) === 'done', state(target));
    s.check('방금 누른 행은 자리를 지킨다', shown(target));
    s.check('남은 수가 줄어든다', acts().length === want - 1, acts().length);
    s.check('안내 문구가 남은 수를 말한다', status() === msg('doneActionable', want - 1), status());
    s.same();
    s.done();
  }

  {
    const s = scenario('페이지를 빠르게 오가기 (reuse-text)');
    await fresh({ mode: 'reuse-text' });
    await classify();
    const want = expectedActs().length;
    for (let i = 0; i < 3; i += 1) {
      document.getElementById('next').click();
      await sleep(60);
      document.getElementById('prev').click();
      await sleep(60);
    }
    await settle();
    s.check('1쪽 판정이 제자리에 있다', acts().length === want, `${acts().length} / ${want}`);
    s.same();
    s.done();
  }

  {
    const s = scenario('설정에서 기록을 비우면 열린 화면도 따른다');
    await fresh();
    await classify();
    const want = expectedActs().length;
    const judged = NMT_TEST.calls;
    await press(acts()[0]);
    await back();
    s.check('연 메일이 내려간다', acts().length === want - 1, acts().length);

    // 설정 화면의 비우기는 저장소에서 기록을 지운다. 이 화면은 다른 창이다
    await chrome.storage.local.remove(['nmt_verdicts', 'nmt_done']);
    await classify();
    s.check('판정 기록을 비웠으니 다시 판정한다', NMT_TEST.calls === judged * 2, `${NMT_TEST.calls} / ${judged * 2}`);
    s.check('내려간 기록을 비웠으니 다시 확인 대상이다', acts().length === want, `${acts().length} / ${want}`);
    s.same();
    s.done();
  }

  {
    const s = scenario('화면이 쉬지 않고 바뀌어도 목록을 맞춘다 (reuse-text)');
    await fresh({ mode: 'reuse-text' });
    await classify();
    // 메일 서비스는 시각 표시처럼 목록과 상관없는 곳을 계속 바꾸기도 한다. 변화가 멎기를
    // 기다리기만 하면 이런 화면에서는 끝내 맞추지 못한다
    const tick = document.createElement('span');
    document.body.appendChild(tick);
    const timer = setInterval(() => {
      tick.textContent = String(Date.now());
    }, 100);
    try {
      document.getElementById('next').click();
      await sleep(1500);
      const stale = invariants().filter((p) => p.includes('다른 메일'));
      s.check('계속 바뀌는 중에도 남은 표시를 걷는다', stale.length === 0, stale.slice(0, 3).join(' / '));
    } finally {
      clearInterval(timer);
      tick.remove();
    }
    await settle();
    s.done();
  }

  {
    const s = scenario('가만히 두면 목록 맞추기가 멈춘다');
    await fresh();
    await classify();
    // 목록 맞추기는 자기가 붙인 표시에도 불린다. 같은 행을 건드리지 않고 같은 문장을 다시
    // 쓰지 않아야 한 번 더 돌고 멈춘다. 멈추지 않으면 메일함을 열어 둔 내내 돈다
    const original = nmtRepaint;
    let runs = 0;
    nmtRepaint = async (...args) => {
      runs += 1;
      return original(...args);
    };
    try {
      await sleep(3000);
    } finally {
      nmtRepaint = original;
    }
    s.check('3초 동안 한 번 넘게 돌지 않는다', runs <= 1, `${runs}회`);
    s.done();
  }

  const report = {
    done: true,
    total: results.length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  out.textContent = JSON.stringify(report, null, 2);
  console.log('[scenario]', report);
})().catch((err) => {
  document.getElementById('result').textContent = JSON.stringify({ done: true, crashed: String(err && err.stack || err) });
});
