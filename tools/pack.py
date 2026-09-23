"""스토어에 올릴 압축을 만든다.

넣을 것을 나열한다. 뺄 것을 나열하는 방식은 새로 생긴 파일이 조용히 딸려 가므로 쓰지
않는다. 시험과 검사기와 문서는 확장이 도는 데 필요하지 않고, 배포본에 들어가면 읽는
사람이 늘 뿐이다.

압축 전에 검사기를 돌리고, 만든 압축 안을 다시 훑어 자격 증명이 없는지 본다. 만들
때의 상태와 압축된 내용이 다를 수 있으므로 양쪽을 모두 본다.

    python tools/pack.py
"""
import io
import os
import re
import subprocess
import sys
import zipfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
os.chdir(ROOT)
sys.stdout.reconfigure(encoding='utf-8')

# 확장이 도는 데 필요한 것만. 파일과 디렉터리를 함께 적는다
ALLOW = [
    'manifest.json',
    'LICENSE',
    'PRIVACY.md',
    'src/',
    '_locales/',
    'icons/',
]

# 압축 안에 있으면 안 되는 것. 검사기와 같은 목록을 쓴다
SECRETS = [
    (r'\bapikey_[A-Za-z0-9_.-]{12,}', 'TypeSafe 키로 보이는 문자열'),
    (r'\bsk-[A-Za-z0-9_-]{16,}', 'API 키로 보이는 문자열'),
    (r'\bAIza[A-Za-z0-9_-]{30,}', 'Google 키로 보이는 문자열'),
    (r'-----BEGIN [A-Z ]*PRIVATE KEY', '비밀 키'),
]

# 아이콘 원본과 스토어 이미지는 확장이 쓰지 않는다
SKIP_NAMES = ('_preview_small.png', 'tile440x280.png')


def collect():
    out = []
    for entry in ALLOW:
        if entry.endswith('/'):
            for base, _dirs, files in os.walk(entry.rstrip('/')):
                for name in sorted(files):
                    if name in SKIP_NAMES:
                        continue
                    out.append(os.path.join(base, name).replace('\\', '/'))
        elif os.path.exists(entry):
            out.append(entry)
        else:
            print('없는 항목: %s' % entry)
            sys.exit(1)
    return sorted(out)


def history_leaks():
    """지난 커밋에 자격 증명이 들어간 적이 있는지 본다.

    파일에서 지워도 커밋 기록에는 남는다. 공개 저장소에 올리는 순간 그 기록도 함께
    공개되고, 자동으로 훑는 도구가 몇 초 안에 찾아낸다. 배포 전에 한 번 본다.
    """
    try:
        log = subprocess.run(['git', 'log', '-p', '--all'], capture_output=True,
                             encoding='utf-8', errors='ignore')
    except FileNotFoundError:
        return ['git 을 실행할 수 없어 커밋 기록을 검사하지 못했다']
    if log.returncode != 0:
        # 기록을 못 읽은 것을 깨끗한 것으로 보지 않는다
        return ['커밋 기록을 읽지 못해 검사하지 못했다']

    found = []
    for pattern, label in SECRETS:
        if re.search(pattern, log.stdout or ''):
            found.append('커밋 기록에 %s 가 있다. 파일에서 지워도 기록에는 남는다' % label)
    return found


def main():
    leaks = history_leaks()
    if leaks:
        for x in leaks:
            print('  -', x)
        print('커밋 기록에 나가면 안 되는 것이 있어 압축하지 않는다.')
        sys.exit(1)

    check = subprocess.run([sys.executable, 'tools/check.py'], capture_output=True, text=True,
                           encoding='utf-8')
    if check.returncode != 0:
        print(check.stdout)
        print('검사기가 통과하지 않아 압축하지 않는다.')
        sys.exit(1)

    files = collect()

    version = re.search(r'"version"\s*:\s*"([^"]+)"', io.open('manifest.json', encoding='utf-8').read())
    name = 'mail-triage-%s.zip' % (version.group(1) if version else 'dev')

    with zipfile.ZipFile(name, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(f, f)

    # 만든 압축을 다시 열어 본다. 만들 때의 상태와 들어간 내용이 다를 수 있다
    problems = []
    with zipfile.ZipFile(name) as z:
        for info in z.infolist():
            if info.filename.endswith(('.png', '.jpg', '.zip')):
                continue
            body = z.read(info.filename).decode('utf-8', 'ignore')
            for pattern, label in SECRETS:
                if re.search(pattern, body):
                    problems.append('%s: %s' % (info.filename, label))

    if problems:
        os.remove(name)
        print('압축 안에 나가면 안 되는 것이 있어 지웠다.')
        for p in problems:
            print('  -', p)
        sys.exit(1)

    total = sum(os.path.getsize(f) for f in files)
    print('%s  파일 %d개  %.1f KB' % (name, len(files), total / 1024))
    for f in files:
        print('  ', f)


main()
