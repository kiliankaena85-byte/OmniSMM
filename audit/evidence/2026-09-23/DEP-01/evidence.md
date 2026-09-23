# Доказательство исправления DEP-01 (Уязвимые версии прод-зависимостей)

## 1. До исправления
- `next`: 16.2.12 (CVE GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4 — RCE без аутентификации на Windows)
- `nodemailer`: 9.0.1 (CVE GHSA-wmmp-3585-3rmp, GHSA-2x7j-588g-ccc2, GHSA-8m3c-c648-2xjj, GHSA-cc9r-2j5m-2m83)
- `@tiptap/core`: 3.22.3 (CVE GHSA-cp6q-959q-f8rh, GHSA-j95f-988m-3j2f)
- В `.github/workflows/ci.yml:58`: `npm audit --audit-level=high --omit=dev || true` (заглушка)

Команда: `npm audit --omit=dev`
Вывод до:
```
4 vulnerabilities (1 moderate, 2 high, 1 critical)
next  16.0.0 - 16.3.2 (Severity: critical - Unauthenticated Remote Code Execution)
nodemailer  <=9.1.0 (Severity: high)
@tiptap/core  <=3.30.4 (Severity: high)
```

## 2. Правка
- `package.json`:
  - `next`: `^16.3.6`
  - `nodemailer`: `^10.0.10`
  - `overrides`:
    - `nodemailer`: `^10.0.10`
    - `@tiptap/core`: `^3.31.3`
    - `@tiptap/extensions`: `^3.31.3`
    - `@tiptap/react`: `^3.31.3`
    - `baseline-browser-mapping`: `^2.11.0`
- `.github/workflows/ci.yml`: убран `|| true` у шага аудита зависимостей.

## 3. После исправления
Команда: `npm audit --omit=dev`
Вывод:
```
found 0 vulnerabilities
```
Exit code: 0
