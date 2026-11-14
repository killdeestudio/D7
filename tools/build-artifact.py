"""www/ 를 한 파일짜리 HTML로 묶는다 (미리보기 배포용). 사용: python3 tools/build-artifact.py 출력경로"""
import re, sys, pathlib
www = pathlib.Path(__file__).resolve().parent.parent / 'www'
html = (www / 'index.html').read_text()
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
body = re.sub(r'\s*<script src="[^"]+"></script>', '', body)
css = (www / 'css/style.css').read_text().replace(':root {\n', ':root {\n  color-scheme: dark;\n', 1)
css = css.replace('--safe-t: env(safe-area-inset-top, 0px);', '--safe-t: 0px;').replace('--safe-b: env(safe-area-inset-bottom, 0px);', '--safe-b: 0px;')
order = ['data.js', 'engine.js', 'region.js', 'i18n-en.js', 'sound.js', 'ui.js']
js = '\n'.join((www / 'js' / f).read_text() for f in order)
out = f'<title>D-7 재난 생존</title>\n<style>\n{css}\n</style>\n{body}\n<script>\n{js}\n</script>\n'
pathlib.Path(sys.argv[1]).write_text(out)
print(len(out))
