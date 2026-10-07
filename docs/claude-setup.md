# Setup Claude Code

Disiapkan 2026-10-07. Sumber agent/skill/rules: [Everything Claude Code](https://github.com/affaan-m/everything-claude-code).

## Isi `.claude/`
- **settings.json** — allowlist perintah rutin; deny `git commit`/`git push` dan baca `.env`; hooks di bawah.
- **hooks/format.sh** (PostToolUse Edit|Write) — gofmt/goimports + `go vet` untuk `.go`; Prettier + ESLint untuk FE. Selalu exit 0.
- **hooks/block-git-commit.sh** (PreToolUse Bash) — exit 2 bila segmen perintah diawali `git commit`/`git push`
  (termasuk `sudo`, `git -C dir`); teks di echo/heredoc/kutipan lolos.
- **agents/** (ECC) — go-reviewer, go-build-resolver, typescript-reviewer, react-reviewer, react-build-resolver,
  security-reviewer, a11y-architect.
- **commands/** — ECC: go-test, go-build, go-review, react-test, react-build, react-review.
  Proyek: `feature`, `figma-spec`, `postman`, `ui-check`.
- **rules/** (ECC) — common, golang, typescript, react, web (frontmatter `paths:` dipertahankan).
- **skills/** (ECC) — tdd-workflow, golang-patterns, golang-testing, react-patterns, react-testing, security-review,
  api-design, frontend-a11y, frontend-patterns.
- **scripts/** — `setup-package-manager.js` + `lib/` (dirujuk skill tdd-workflow).
- **launch.json** — preview `frontend` (:5173) dan `backend` (:8080).

## Sengaja tidak diambil dari ECC
Hooks & scripts ECC (diganti hook proyek), rules bahasa lain, agent/command orkestrasi umum (multi-*, epic-*, gan-*,
loop-*, prp-*), skill di luar stack (django, flutter, dsb).

## Kerja harian
`/figma-spec <link> <fitur>` → review spec → `/feature <fitur>` → commit manual dengan pesan yang diusulkan.
