/**
 * 문자열 조회와 화면 적용.
 *
 * chrome.i18n 은 확장 컨텍스트가 죽으면 예외를 던지므로 감싼다. 키를 못 찾으면 키 자체를
 * 돌려주어 화면이 비지 않게 한다.
 */

function nmtMsg(key, ...subs) {
  try {
    const got = chrome.i18n.getMessage(key, subs.length ? subs.map(String) : undefined);
    return got || key;
  } catch (_) {
    return key;
  }
}

/** data-i18n 과 data-i18n-placeholder 를 가진 요소를 채운다. */
function nmtApplyI18n(root) {
  const scope = root ?? document;

  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    const t = nmtMsg(el.dataset.i18n);
    if (t) el.textContent = t;
  });

  scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const t = nmtMsg(el.dataset.i18nPlaceholder);
    if (t) el.placeholder = t;
  });
}
