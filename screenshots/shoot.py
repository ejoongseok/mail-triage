"""스토어에 올릴 화면을 만든다.

확장이 실제로 만든 DOM 을 그대로 받아 CSS 만 합친다. 화면을 다시 그리지 않으므로
스토어에 올라가는 것과 쓰는 사람이 보는 것이 같다.

    1. test/fixtures 를 띄우고 확장으로 분류한다
    2. 브라우저 콘솔에서 아래를 실행해 HTML 을 내려받는다
    3. python screenshots/shoot.py 로 CSS 를 합친다
    4. 로컬 서버에 올리고 1280x800 으로 캡처한다

콘솔에서 실행할 것:

    const html = '<!DOCTYPE html>' + document.documentElement.outerHTML;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = 'nmt-shot.html';
    a.click();
"""
import io
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.stdout.reconfigure(encoding='utf-8')

src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads/nmt-shot.html')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'screenshots', 'shot.html')

html = io.open(src, encoding='utf-8').read()
css = io.open(os.path.join(ROOT, 'src', 'content.css'), encoding='utf-8').read()

marker = '</head>'
if marker not in html:
    print('head 를 찾지 못했다')
    sys.exit(1)

# 저장본에는 화면을 만든 스크립트가 그대로 남아 있다. 다시 열면 행을 또 그려 목록이
# 두 벌이 되므로 걷어낸다. 확장이 붙인 표시는 이미 DOM 에 들어 있다
html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.S)

# 확장 CSS 는 chrome-extension 에서 주입되어 저장본에 남지 않는다. 인라인으로 넣는다

html = html.replace(marker, '<style>\n' + css + '\n</style>\n' + marker, 1)
io.open(out, 'w', encoding='utf-8').write(html)
print('%s  (%d바이트)' % (out, len(html)))
