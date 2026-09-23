#!/usr/bin/env bash
set -euo pipefail

mode="${1:-full}"

echo "→ segredos e regras do projeto"
if rg -n --hidden -g '!node_modules/**' -g '!.git/**' -g '!.next/**' -g '!dist/**' -g '!pnpm-lock.yaml' '(AIza[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z_-]{20,}|sb_secret_[0-9A-Za-z_-]+)' .; then
  echo "✗ possível segredo encontrado; remova-o e use variável de ambiente" >&2
  exit 1
fi
if rg -n -g '*.ts' -g '*.tsx' 'NEXT_PUBLIC_GEMINI|NEXT_PUBLIC_.*SECRET|NEXT_PUBLIC_.*PRIVATE' .; then
  echo "✗ segredo não pode usar prefixo NEXT_PUBLIC_" >&2
  exit 1
fi

echo "→ tipos"
pnpm typecheck

echo "→ lint"
pnpm lint

echo "→ testes"
pnpm test

if [[ "$mode" == "full" ]]; then
  echo "→ build"
  pnpm build
fi

echo "✓ verificações concluídas"
