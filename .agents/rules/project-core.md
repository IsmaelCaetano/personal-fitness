---
trigger: always_on
description: "Regras fundamentais e contexto obrigatório do projeto Personal Fitness."
---

# Personal Fitness — Core Project Rules

Este workspace contém o projeto Personal Fitness.

Antes de fazer alterações significativas:

1. Leia `AGENTS.md`.
2. Leia `PROJECT_HANDOFF.md`.
3. Consulte `docs/PROJECT_CONTEXT.md`.
4. Consulte a seção relevante de `SPEC.md`.
5. Consulte `TASKS.md`.

Não percorra todo o repositório sem necessidade.

Prefira:

- busca por símbolo;
- busca por função;
- busca por componente;
- busca por rota;
- busca por schema;
- abrir apenas arquivos relacionados à tarefa.

## Invariantes

Preserve obrigatoriamente:

- isolamento de dados por usuário;
- Supabase RLS;
- autorização server-side;
- optimistic concurrency;
- pending queue e recuperação offline;
- histórico existente;
- compatibilidade com dados antigos;
- IDs `base-*` existentes;
- validação com Zod;
- IA tratada como saída não confiável;
- IA nunca persistindo automaticamente sem ação humana;
- segredos somente server-side;
- documentação alinhada com o código real.

Nunca:

- colocar `SUPABASE_SERVICE_ROLE_KEY` no cliente;
- colocar segredo em `NEXT_PUBLIC_*`;
- commitar `.env.local`;
- logar senha, JWT, recovery token ou ConfirmationURL;
- confiar apenas na UI para autorização;
- fazer refactor não relacionado à tarefa;
- apagar histórico para simplificar implementação.

## Context Engineering

Use o repositório como memória do projeto.

Prioridade de leitura:

1. `AGENTS.md`
2. `PROJECT_HANDOFF.md`
3. `docs/PROJECT_CONTEXT.md`
4. seção relevante de `SPEC.md`
5. `TASKS.md`

Depois use busca para localizar o código necessário.

Não releia grandes partes do repositório quando o contexto já estiver documentado.

## Após alterar código

Quando aplicável:

1. criar ou atualizar testes;
2. executar `pnpm test`;
3. executar `pnpm typecheck`;
4. executar `pnpm lint`;
5. executar `pnpm check`;
6. testar o fluxo no navegador;
7. atualizar documentação quando comportamento, arquitetura ou invariantes mudarem.

Não declarar uma implementação concluída se os checks relevantes falharem.

## External Version Verification

Qualquer conclusão sobre comportamento atual de framework,
SDK, API, modelo de IA ou serviço externo deve ser verificada
na documentação oficial quando puder ter mudado com a versão.

Exemplos:

- Next.js file conventions;
- Supabase Auth flows;
- modelos Gemini;
- Vercel;
- APIs externas.

Não classifique algo como bug, deprecated, unsupported ou nonexistent
somente com conhecimento interno do modelo.

Diferencie:

- fato confirmado no código;
- fato confirmado na documentação oficial;
- hipótese que exige teste runtime.