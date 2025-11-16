import subprocess, re, sys
from pathlib import Path

def get_base(path):
    return subprocess.check_output(['git','show','HEAD~1:'+path], text=True, encoding='utf-8', errors='ignore')

def ascii_strip(text):
    return ''.join(ch for ch in text if ord(ch) < 128)

def collect_string_replacements(base_text):
    replacements = {}
    pattern = re.compile(r"('([^'\\]|\\.)*')|\"([^\"\\]|\\.)*\"")
    for match in pattern.finditer(base_text):
        token = match.group(0)
        content = token[1:-1]
        if any(ord(ch) > 127 for ch in content):
            degraded = ascii_strip(content)
            if degraded and degraded != content:
                replacements[token[0] + degraded + token[0]] = token[0] + content + token[0]
    return replacements

def collect_word_replacements(base_text):
    replacements = {}
    # Match words including accented letters
    for word in re.findall(r"[A-Za-zÀ-ÿ]+", base_text):
        if any(ord(ch) > 127 for ch in word):
            degraded = ascii_strip(word)
            if degraded and degraded != word and degraded not in replacements:
                replacements[degraded] = word
    return replacements

def apply_replacements(target_path, string_map, word_map):
    text = Path(target_path).read_text(encoding='utf-8')
    # Apply string replacements first
    for old, new in string_map.items():
        text = text.replace(old, new)
    # Apply word replacements using regex word boundaries
    for degraded, accent in word_map.items():
        pattern = re.compile(rf"\b{re.escape(degraded)}\b")
        text = pattern.sub(accent, text)
    Path(target_path).write_text(text, encoding='utf-8')

if __name__ == '__main__':
    target = sys.argv[1]
    base_text = get_base(target)
    string_map = collect_string_replacements(base_text)
    word_map = collect_word_replacements(base_text)
    apply_replacements(target, string_map, word_map)
