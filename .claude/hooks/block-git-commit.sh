#!/usr/bin/env bash
# PreToolUse (Bash): tolak `git commit` / `git push` — user commit manual.
# Hanya memeriksa awal segmen perintah (awal baris, setelah ; && || |), dan
# mengabaikan isi heredoc serta teks di dalam tanda kutip (mis. echo "git commit").
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$cmd" ] && exit 0

hit=$(printf '%s\n' "$cmd" | awk '
  BEGIN { inhd = 0 }
  {
    line = $0
    if (inhd) { t = line; sub(/^[ \t]+/, "", t); if (t == term) inhd = 0; next }
    if (match(line, /<<-?[ \t]*["\x27]?[A-Za-z_][A-Za-z0-9_]*/)) {
      term = substr(line, RSTART, RLENGTH); gsub(/^<<-?[ \t]*["\x27]?/, "", term); inhd = 1
      line = substr(line, 1, RSTART - 1)
    }
    gsub(/"([^"\\]|\\.)*"/, "\"\"", line)   # buang isi string kutip ganda
    gsub(/\x27[^\x27]*\x27/, "\x27\x27", line) # buang isi string kutip tunggal
    gsub(/&&|\|\||;|\||\(|\)|`|\$\(/, "\n", line)
    n = split(line, seg, "\n")
    for (i = 1; i <= n; i++) {
      s = seg[i]
      sub(/^[ \t]+/, "", s)
      while (s ~ /^(sudo|command|env|exec|time|nohup)([ \t]|$)/ || s ~ /^[A-Za-z_][A-Za-z0-9_]*=[^ \t]*[ \t]/ || s ~ /^-[A-Za-z]+[ \t]/) {
        sub(/^[^ \t]+[ \t]*/, "", s)
      }
      if (s ~ /^git([ \t]+-[cC][ \t]+[^ \t]+|[ \t]+--[a-z-]+(=[^ \t]+)?)*[ \t]+(commit|push)([ \t]|$)/) { print "1"; exit }
    }
  }')

if [ -n "$hit" ]; then
  echo "Diblokir: Claude tidak boleh menjalankan git commit/push di repo ini. Usulkan pesan commit; user yang commit manual." >&2
  exit 2
fi
exit 0
