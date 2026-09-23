/**
 * 확장 스크립트를 Node 에서 불러온다.
 *
 * 확장 스크립트는 모듈이 아니라 전역에 함수를 붙이는 방식이라 import 로 가져올 수 없다.
 * vm 컨텍스트 하나에 순서대로 올려 브라우저에서와 같은 전역을 만든다.
 *
 * 브라우저 API 는 함수를 부를 때만 필요하므로 여기서는 최소한만 흉내 낸다. document 를
 * 주지 않으면 content.js 의 진입부가 화면을 만들지 않고 넘어간다.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = ['src/i18n.js', 'src/selectors.js', 'src/cache.js', 'src/jev.js', 'src/content.js'];

const MESSAGES = JSON.parse(readFileSync(join(ROOT, '_locales/ko/messages.json'), 'utf8'));

/** chrome.i18n.getMessage 와 같은 규칙으로 실제 번역 파일을 읽는다 */
function getMessage(key, subs) {
  const entry = MESSAGES[key];
  if (!entry) return '';
  let out = entry.message;
  Object.keys(entry.placeholders ?? {}).forEach((name, i) => {
    out = out.split('$' + name.toUpperCase() + '$').join(String(subs?.[i] ?? ''));
  });
  return out;
}

export function loadExtension(extra = {}) {
  const ctx = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    JSON,
    chrome: { i18n: { getMessage } },
    ...extra,
  });

  for (const file of FILES) {
    vm.runInContext(readFileSync(join(ROOT, file), 'utf8'), ctx, { filename: file });
  }
  return ctx;
}

/** 프로파일 선택은 hostname 을 보므로 시험에서 원하는 서비스로 고정한다 */
export function loadFor(url, extra = {}) {
  const u = new URL(url);
  return loadExtension({ location: { href: url, hostname: u.hostname }, ...extra });
}

/**
 * 컨텍스트 안의 값을 꺼낸다.
 *
 * const 와 let 으로 선언한 것은 vm 컨텍스트의 전역 객체에 붙지 않아 ctx.NAME 으로
 * 읽히지 않는다. 함수 선언만 붙는다.
 */
export function valueIn(ctx, expression) {
  return vm.runInContext(expression, ctx);
}
