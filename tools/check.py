"""확장의 정합성 검사와 반출 게이트.

파일 사이에서 조용히 어긋나는 것을 잡는다. 번역 키의 짝, 정의 없는 함수 호출, CSS 에
없는 클래스, manifest 가 가리키는 파일의 부재, 설정 키의 어긋남이다.

그리고 공개 저장소에 나가면 안 되는 것을 막는다. 자격 증명과 개발 경위다. 공개된
저장소는 누구나 내려받아 읽고 분석하므로, 코드에 남은 날짜와 건수가 만든 사람의
환경을 알려 준다. 규칙과 그 이유는 남기고 언제 무슨 일이 있었는지는 남기지 않는다.

인자로 디렉터리를 주면 그곳을 본다. 검사기 자체를 시험할 때 사본을 돌리기 위해서다.
검사기가 통과만 잘 하고 결함을 못 잡는 일이 있으므로, 고칠 때마다 결함을 심은
사본을 만들어 잡히는지 본다. 통과 사례만으로는 검사기가 스스로를 증명하는 셈이 된다.

    python tools/check.py
"""
import io, json, os, re, sys

root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
os.chdir(root)
sys.stdout.reconfigure(encoding='utf-8')
fail = []

def read(f):
    return io.open(f, encoding='utf-8').read()

mani = json.loads(read('manifest.json'))
cs = mani['content_scripts'][0]['js']
opt = re.findall(r'<script src="([^"]+)"', read('src/options.html'))
opt = ['src/' + x for x in opt]

# --- 1) i18n 키 -----------------------------------------------------------
ko = json.load(io.open('_locales/ko/messages.json', encoding='utf-8'))
en = json.load(io.open('_locales/en/messages.json', encoding='utf-8'))
if set(ko) != set(en):
    fail.append('ko/en 키 불일치: %s' % sorted(set(ko) ^ set(en)))

srcs = sorted(set(cs + opt + ['manifest.json', 'src/options.html']))
used = set()
for f in srcs:
    t = read(f)
    used |= set(re.findall(r"nmtMsg\(\s*'([A-Za-z0-9_]+)'", t))
    used |= set(re.findall(r'data-i18n(?:-placeholder)?="([A-Za-z0-9_]+)"', t))
    used |= set(re.findall(r'__MSG_([A-Za-z0-9_]+)__', t))
# 동적 참조: NMT_LABEL_KEYS 의 값만. 객체 리터럴 전부를 훑으면 상태값 같은 것까지 키로 읽는다
_m = re.search(r'const NMT_LABEL_KEYS = \{(.*?)\n\}', read('src/content.js'), re.S)
if _m:
    used |= set(re.findall(r":\s*'([A-Za-z0-9_]+)'", _m.group(1)))
else:
    fail.append('NMT_LABEL_KEYS 정의를 찾지 못해 동적 키를 검사하지 못했다')

miss = sorted(used - set(ko))
if miss:
    fail.append('정의 안 된 i18n 키: %s' % miss)

# 반대쪽도 본다. 화면에서 항목을 뺐는데 문구가 남으면 번역 부담만 남고, 나중에 읽는
# 사람은 어딘가 쓰이는 줄 안다
dead = sorted(set(ko) - used)
if dead:
    fail.append('쓰이지 않는 i18n 키: %s (화면에서 뺐으면 문구도 지운다)' % dead)

# 플레이스홀더를 쓰는 메시지는 선언이 있어야 한다
for lang, m in (('ko', ko), ('en', en)):
    for k, v in m.items():
        n = len(set(re.findall(r'\$([A-Z]+)\$', v['message'])))
        d = len(v.get('placeholders', {}))
        if n != d:
            fail.append('%s/%s 플레이스홀더 %d개인데 선언 %d개' % (lang, k, n, d))

# --- 2) 함수 정의와 호출 ---------------------------------------------------
defined, order = set(), {}
for i, f in enumerate(cs + opt):
    for name in re.findall(r'function (nmt[A-Za-z0-9_]+)', read(f)):
        defined.add(name)
        order.setdefault(name, i)
    for name in re.findall(r'(?:const|let|var) (nmt[A-Za-z0-9_]+)\s*=', read(f)):
        defined.add(name)
        order.setdefault(name, i)

for group, files in (('content', cs), ('options', opt)):
    seen = set()
    for i, f in enumerate(files):
        t = read(f)
        for name in re.findall(r'(nmt[A-Za-z0-9_]+)\(', t):
            if name not in defined:
                fail.append('%s: 정의 없는 함수 호출 %s (%s)' % (group, name, f))
        seen.add(f)

# --- 2b) 판정 입력과 캐시 키 -------------------------------------------------
# 불변식: 판정에 넣는 값은 전부 캐시 키에 들어간다.
# 캐시 키는 메일 식별자와 역할 문장의 해시뿐이므로, 입력에는 그 메일의 고유한 속성만
# 들어가야 한다. 읽음 여부처럼 나중에 바뀌는 값을 넣으면 판정이 처음 분류한 시점의
# 상태로 굳고, 같은 메일이 읽었는지에 따라 다르게 판정된다.
jev = read('src/jev.js')
# 상태 문장은 여러 줄에 걸쳐 조립되므로, 판정 함수 첫머리부터 요청 본문을 만들기
# 전까지를 통째로 본다. 특정 배열 모양을 찾으면 조립 방식이 바뀔 때 입력을 놓친다
_m = re.search(r'async function nmtJudge\(mail, settings\) \{(.*?)const body = \{', jev, re.S)
if not _m:
    fail.append('jev.js 의 판정 입력 블록을 찾지 못해 캐시 키 대조를 하지 못했다')
else:
    STABLE = {'sender', 'email', 'subject', 'preview'}
    volatile = set(re.findall(r'mail\.(\w+)', _m.group(1))) - STABLE
    if volatile:
        fail.append(
            '판정 입력에 메일 고유값이 아닌 것: %s. 캐시 키는 메일 식별자와 역할 해시뿐이라 '
            '이 값이 바뀌어도 옛 판정이 그대로 나온다' % sorted(volatile)
        )

# --- 3) CSS 클래스 ---------------------------------------------------------
css = read('src/content.css')
js = read('src/content.js')
# classList 로 실제로 붙이고 떼는 이름만 클래스다. getElementById 인자는 id 라 제외한다
cls_used = set()
for call in re.findall(r'classList\.(?:add|remove|toggle|contains)\(([^)]*)\)', js):
    cls_used |= set(re.findall(r"'(nmt-[a-z-]+)'", call))
# 부분 문자열로 보면 .nmt-done 이 .nmt-donex 안에 들어 있어 이름을 늘리는 변이가 샌다.
# 선택자에서 토큰을 뽑아 집합으로 대조한다
css_defined = set(re.findall(r'\.(nmt-[a-z0-9-]+)', css))
for cls in sorted(cls_used):
    if cls not in css_defined:
        fail.append('CSS 에 없는 클래스: %s' % cls)
print('classList 로 다루는 클래스 %d개: %s' % (len(cls_used), ', '.join(sorted(cls_used))))

# 행의 표시는 클래스가 아니라 상태 속성에 걸려 있다. 메일 서비스가 className 을 덮어써도
# 살아남아야 하기 때문이다. 코드가 쓰는 상태값이 CSS 에 없으면 그 상태는 보이지 않는다
# 코드에서 값을 긁어 모으면 삼항 연산자 안의 것을 놓친다. 소스가 선언한 목록을 읽는다
_s = re.search(r'const NMT_ROW_STATES = \[(.*?)\]', js, re.S)
if not _s:
    fail.append('NMT_ROW_STATES 선언을 찾지 못해 상태값 스타일을 검사하지 못했다')
else:
    states = set(re.findall(r"'(\w+)'", _s.group(1)))
    # 이름이 어딘가에 나오는 것으로는 부족하다. 행 자체에 걸리는 규칙이어야 한다.
    # [data-nmt-state='low'] .nmt-badge 는 배지의 색일 뿐 행의 표시가 아니다
    css_states = set(re.findall(r"""\[data-nmt-state=['"](\w+)['"]\]\s*(?:,|\{)""", css))
    print('상태값 %d개: %s' % (len(states), ', '.join(sorted(states))))
    for st in sorted(states - css_states):
        fail.append(
            'CSS 에 없는 상태값: data-nmt-state=%s (그 상태의 행은 아무 표시도 나지 않는다)' % st
        )
    # 선언에 없는데 CSS 에만 있는 것도 죽은 규칙이다
    for st in sorted(css_states - states):
        fail.append('NMT_ROW_STATES 에 없는데 CSS 에만 있는 상태값: %s' % st)

# 옵션 화면이 어느 경로로 도는지 안내하려면 중계 주소를 알아야 한다. 읽지 못하면
# 값이 없는 것으로 보여 늘 키가 필요하다고 잘못 적힌다
if 'NMT_RELAY_URL' in read('src/options.js') and 'config.js' not in read('src/options.html'):
    fail.append('options.js 가 중계 주소를 쓰는데 options.html 이 config.js 를 읽지 않는다')

# 시각 효과를 내는 data 속성도 같은 짝이 필요하다. 접힘은 이것 하나뿐이다
if 'dataset.nmtHidden' in js and not re.search(r'\[data-nmt-hidden\]\s*\{', css):
    fail.append('코드가 접힘 속성을 쓰는데 CSS 에 [data-nmt-hidden] 규칙이 없다 (접어도 행이 남는다)')

# --- 2c) 설정 키 -------------------------------------------------------------
# chrome.storage.sync.get(obj) 는 obj 에 있는 키만 돌려준다. 옵션 화면이 저장하는 키가
# 읽는 쪽의 기본값에 없으면 그 설정은 조용히 무시된다


def default_keys(path, name):
    m = re.search(r'const %s = \{(.*?)\n\};' % name, read(path), re.S)
    return set(re.findall(r'^\s*(\w+):', m.group(1), re.M)) if m else None


# 옵션 화면이 동기화 저장소에 쓰는 것과, 메일 화면이 거기서 읽는 것을 맞춘다.
# API 키는 양쪽 어디에도 없다. background 만 이 기기 저장소에서 읽는다
_saved = default_keys('src/options.js', 'NMT_SYNCED')
_loaded = default_keys('src/content.js', 'NMT_DEFAULTS')
if _saved is None or _loaded is None:
    fail.append('설정 기본값 선언을 찾지 못해 설정 키를 대조하지 못했다')
else:
    orphan = _saved - _loaded
    if orphan:
        fail.append('옵션이 저장하는데 읽는 쪽 기본값에 없는 설정: %s (저장해도 적용되지 않는다)' % sorted(orphan))
    # 화면에 없는 키는 콘솔로만 넣는 값이라 정상이다. 그쪽은 검사하지 않는다

# --- 4) manifest 가 가리키는 파일 -------------------------------------------
for f in cs + mani['content_scripts'][0]['css'] + [mani['background']['service_worker']]:
    if not os.path.exists(f):
        fail.append('manifest 가 가리키는 파일 없음: %s' % f)

# --- 5) 반출 게이트 -----------------------------------------------------------
# 공개 저장소는 누구나 내려받아 읽는다. 나가면 안 되는 두 가지를 막는다.
#
# 자격 증명: 클라이언트에 둔 키는 처음부터 비밀이 아니다. 확장을 설치한 사람이 소스를
# 그대로 볼 수 있으므로, 키가 들어간 채 커밋되면 그 순간 공개된 것과 같다.
#
# 개발 경위: 규칙과 그 이유는 남겨야 다음 사람이 같은 실수를 반복하지 않는다. 하지만
# 언제 무슨 일이 있었고 우리 환경에서 몇 건이었는지는 만든 사람의 사정이고, 공개되면
# 그 환경을 알려 주는 단서가 된다.

SECRETS = [
    (r'\bapikey_[A-Za-z0-9_.-]{12,}', 'TypeSafe 키로 보이는 문자열'),
    (r'\bsk-[A-Za-z0-9_-]{16,}', 'API 키로 보이는 문자열'),
    (r'\bAIza[A-Za-z0-9_-]{30,}', 'Google 키로 보이는 문자열'),
    (r'-----BEGIN [A-Z ]*PRIVATE KEY', '비밀 키'),
]

# 키가 닿아도 되는 자리는 background 와 설정 화면뿐이다. 메일 페이지에 주입되는 코드가
# 키를 들고 있으면 그만큼 새어 나갈 자리가 늘고, 동기화 저장소에 두면 구글 계정을 통해
# 다른 기기로 옮겨진다
for f in cs:
    body = read(f)
    if re.search(r'\bapiKey\b', body):
        fail.append('%s: content script 가 API 키를 참조한다. 키는 background 만 읽는다' % f)

for f in ['src/background.js', 'src/options.js']:
    body = read(f)
    for m in re.finditer(r'storage\.sync\.(get|set)\(([^)]*)', body):
        if 'apiKey' in m.group(2) and 'remove' not in m.group(0):
            # 옛 저장분을 옮기는 코드는 읽고 지우기만 한다
            if m.group(1) == 'set':
                fail.append('%s: API 키를 동기화 저장소에 쓴다. 이 기기 저장소에 둔다' % f)

# 확장에서 코드를 문자열로 만들어 실행하거나 HTML 을 문자열로 조립하지 않는다.
# 번역 파일이나 메일 제목에 섞인 태그가 그대로 주입될 자리를 아예 두지 않는다
DANGEROUS = [
    (r'\.innerHTML\s*=', 'innerHTML 대입'),
    (r'\.outerHTML\s*=', 'outerHTML 대입'),
    (r'insertAdjacentHTML', 'insertAdjacentHTML'),
    (r'\beval\s*\(', 'eval'),
    (r'new\s+Function\s*\(', 'new Function'),
    (r'setTimeout\s*\(\s*[\'"`]', '문자열을 넘기는 setTimeout'),
]
for f in sorted(set(cs + opt + ['src/background.js'])):
    body = read(f)
    for pattern, label in DANGEROUS:
        if re.search(pattern, body):
            fail.append('%s: %s. 확장 코드에서는 쓰지 않는다' % (f, label))

# 권한은 최소로 둔다. 아래 둘은 확장 바깥에서 닿을 수 있는 문을 여는 설정이라,
# 필요해지면 그 이유를 적고 이 검사를 함께 고친다
for key, why in (
    ('externally_connectable', '웹페이지가 확장에 메시지를 보낼 수 있게 된다'),
    ('web_accessible_resources', '웹페이지가 확장 파일을 읽을 수 있게 된다'),
):
    if mani.get(key):
        fail.append('manifest 의 %s 가 설정돼 있다. %s' % (key, why))

if set(mani.get('permissions', [])) - {'storage'}:
    fail.append('permissions 가 storage 보다 넓다: %s' % mani.get('permissions'))
HISTORY = [
    (r'(실측|시험|확인)\s*\d{4}-\d{2}-\d{2}', '주석의 실측 날짜'),
    (r'사용자\s*(지적|신고|보고)', '개발 경위'),
    (r'\d+\s*회차', '개발 경위'),
    (r'(전에는|예전에는|처음에는)\s', '변경 이력'),
]

scan = []
for base, _dirs, files in os.walk('.'):
    if any(p in base for p in ('.git', 'node_modules', 'icons')):
        continue
    for name in files:
        if name.endswith(('.js', '.mjs', '.json', '.html', '.css', '.md', '.py')):
            scan.append(os.path.join(base, name))

for path in sorted(scan):
    # 검사기 자신은 패턴을 문자열로 담고 있으므로 건너뛴다
    if os.path.abspath(path) == os.path.abspath(__file__):
        continue
    body = read(path)
    for pattern, label in SECRETS:
        if re.search(pattern, body):
            fail.append('%s: %s (공개 저장소에 나가면 안 된다)' % (path, label))
    for pattern, label in HISTORY:
        hits = re.findall(pattern, body)
        if hits:
            fail.append('%s: %s %d건. 규칙과 이유는 남기고 경위는 뺀다' % (path, label, len(hits)))

# 코드 안의 날짜는 대개 언제 무엇이 있었는지의 기록이다. 규칙은 날짜 없이도 남는다.
# 문서의 날짜(개인정보처리방침의 갱신일 같은)는 대상이 아니다
for name in sorted(os.listdir('src')):
    if name.endswith('.js'):
        for m in re.finditer(r'20[0-9]{2}-[0-9]{2}-[0-9]{2}', read('src/' + name)):
            fail.append('src/%s: 코드에 날짜 %s 가 있다. 언제 무엇이 있었는지는 공개 코드에 남기지 않는다' % (name, m.group(0)))

print('검사 대상: 스크립트 %d, i18n 키 %d, 반출 검사 %d파일' % (len(srcs), len(ko), len(scan)))
if fail:
    print('결함 %d건' % len(fail))
    for x in fail:
        print('  -', x)
    sys.exit(1)
print('통과')
