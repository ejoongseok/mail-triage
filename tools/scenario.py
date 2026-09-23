"""브라우저 시나리오 시험을 돌린다.

    python tools/scenario.py

설치된 크롬을 화면 없이 띄워 test/browser/scenario.html 을 열고, 페이지가 #result 에 적은
결과를 읽는다. 가상 시간으로 돌려 기다리는 시간이 실제로 흐르지 않는다. 크롬 위치가
다르면 CHROME 환경 변수로 준다.

확장을 설치하지 않는다. 확장 스크립트를 가짜 메일함에 그대로 올리고 chrome API 는
test/browser/chrome-stub.js 가 흉내 낸다. 판정 호출은 나가지 않는다.
"""
import html
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from functools import partial

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.stdout.reconfigure(encoding='utf-8')

CANDIDATES = [
    os.environ.get('CHROME', ''),
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    chrome = next((c for c in CANDIDATES if c and os.path.exists(c)), None)
    if not chrome:
        print('크롬을 찾지 못했다. CHROME 환경 변수로 위치를 준다.')
        sys.exit(2)

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=ROOT))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = 'http://127.0.0.1:%d/test/browser/scenario.html' % server.server_address[1]

    profile = tempfile.mkdtemp(prefix='nmt-scenario-')
    try:
        run = subprocess.run(
            [chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
             '--disable-extensions', '--user-data-dir=' + profile,
             '--virtual-time-budget=120000', '--dump-dom', url],
            capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=300,
        )
    finally:
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)

    m = re.search(r'<pre id="result">(.*?)</pre>', run.stdout or '', re.S)
    if not m:
        print('결과를 찾지 못했다. 페이지가 끝까지 돌지 않았다.')
        print((run.stderr or '')[-800:])
        sys.exit(2)

    raw = html.unescape(m.group(1)).strip()
    try:
        report = json.loads(raw)
    except ValueError:
        print('결과가 JSON 이 아니다:', raw[:300])
        sys.exit(2)

    if report.get('crashed'):
        print('시나리오가 도중에 멈췄다')
        print(report['crashed'])
        sys.exit(1)

    for r in report['results']:
        print('%s  %s' % ('통과' if r['ok'] else '실패', r['name']))
        for p in r['problems']:
            print('      - ' + p)
    print('시나리오 %d개 중 실패 %d개' % (report['total'], report['failed']))
    sys.exit(1 if report['failed'] else 0)


main()
