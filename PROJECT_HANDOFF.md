# Personal Fitness — handoff

Atualizado em 2026-09-24. Fonte: `IsmaelCaetano/personal-fitness`, branch `main`. Produção: Vercel (`https://personal-fitness-omega.vercel.app/`), Auth/banco: Supabase Postgres com RLS, IA: Gemini no servidor. O último merge de código anterior a esta documentação foi `8a995de`; confirme o SHA corrente antes de editar.

## Ordem de leitura

1. [AGENTS.md](AGENTS.md) — regras operacionais e `pnpm check`.
2. [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — mapa, estado, invariantes e armadilhas.
3. [SPEC.md](SPEC.md) — requisito observável correspondente.
4. [TASKS.md](TASKS.md) — pendências reais.
5. [SECURITY.md](SECURITY.md) — autorização, segredo e validação pendente.

## Estado

Código individual + personal/aluno, convites com pré-cadastro, prescrições, histórico, feedback, notificações, PDF, substituições, coach determinístico, quota Gemini e controle administrativo de pagamentos estão implementados. Migrações `202609230001` a `202609240008` aplicadas no Supabase de produção por SQL Editor; teste SQL transacional de papel/convite passou com rollback. `pnpm check` anterior passou 98 testes. **Não declarar testados** entrega de e-mail, convite entre duas contas reais, isolamento RLS no browser, offline multidispositivo, quota/Gemini real, senha sob reautenticação ou PDFs longos. Ver checklist [TASKS.md](TASKS.md).

## Arquitetura em cinco linhas

- `app/` e `features/fitness/`: Next.js/React, telas de Auth, treinos e portal `/trainer`.
- `app/api/fitness/route.ts` + `lib/fitness/sync*.ts`/`persistence.ts`: JSONB individual, CAS por versão, fila local por aba, retry e conflitos 409.
- `app/api/ai/*` + `lib/fitness/ai*.ts`/`gemini.ts`: Gemini server-side, quota transacional, OCR e validação; nunca grava sem preview/confirmação.
- `app/api/trainer/*`, `lib/fitness/trainer.ts`, `student-intake.ts`: convite, vínculo, prescrição, feedback, pagamentos; `app/api/notifications/` lista avisos in-app.
- `supabase/schema.sql` reproduz banco novo; `supabase/migrations/*` migra banco existente. Consulte [DATABASE.md](docs/DATABASE.md) antes de SQL.

## Auth, banco e papéis

Individual pode se cadastrar e criar treinos. Novo personal pode escolher papel **no cadastro público**; trigger Auth grava `account_profiles.account_type` uma vez. Conta individual existente não pode se promover; convidado nasce individual. Personal pré-cadastra nome/e-mail/ficha, Auth Admin envia convite, aluno novo define senha, `accept_trainer_invite` confere e-mail e cria perfil/vínculo atômicos. Aluno existente aceita no app sem perder dados. Trainer só acessa aluno ativo; aluno executa sessão na própria conta e não altera prescrição. RLS é obrigatória mesmo que API tenha autorização.

`fitness_resources` contém perfil/rotina/sessão/medida JSONB individual. Quota, rate limit, `account_profiles`, `trainer_profiles`, `trainer_students`, `trainer_invites`, `trainer_routines`, `student_feedback`, `notifications` e `payment_records` são tabelas relacionais. Migrações em produção não constam necessariamente em controle formal de migrations: não reaplicar sem inspecionar.

## IA e exercícios

Gemini `gemini-3.5-flash-lite` em `lib/fitness/gemini.ts`; `GEMINI_API_KEY` privada. Duas gerações por usuário/mês UTC em `ai_usage`/`ai_generation_requests`; reserva e confirmação atômicas, retry idempotente; OCR/importação não consomem. `lib/fitness/domain.ts` orienta séries sem LLM, `lib/fitness/recommendations.ts` exige equivalência por movimento/região/mecânica/equipamento e pode retornar vazio. `lib/fitness/pdf.ts` gera A4 via jsPDF sem IA. Vídeos/imagens locais são parciais e cacheiam apenas mídia pública; direitos de terceiros exigem validação. Veja [AI.md](docs/AI.md).

## Invariantes

Nunca vazar dados entre contas; nunca promover individual por request/metadata; nunca alterar ID `base-*` nem apagar histórico ao excluir rotina. Preservar fila/tentativa em voo e versão de exclusão em resposta perdida; conflito verdadeiro precisa de escolha humana. IA nunca persiste automaticamente, aluno nunca edita estrutura prescrita, service role/Gemini nunca usam `NEXT_PUBLIC_`. Service Worker não cacheia HTML autenticado.

## Últimas mudanças e pendências

Commits de fluxo Auth: `bef7d4a` (ficha/aceite), `7f549f8` (ficha), `72e3bbf` (tipo Auth), `0376993` (remove promoção). Cache privado `dfc4efc`. Merge de código `8a995de`. Este pacote documental está em commit separado; consulte `git log -- docs/PROJECT_CONTEXT.md` após publicar. Próximo passo: [TASKS.md](TASKS.md) — testes com contas reais e revisão de SMTP/redirecionamento, RLS cruzada, duas abas/rede, Gemini e UI mobile. Coach LLM opcional ainda não existe. Para operação use [RUNBOOK.md](docs/RUNBOOK.md); para razões das decisões use [DECISIONS.md](docs/DECISIONS.md); para histórico lote a lote use [IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md).

## Comandos

`pnpm install`, `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm check`. Segredos apenas em `.env.local`/Vercel. `.env.example` contém nomes vazios.

## Prompt recomendado para novo agente

> Você está trabalhando no Personal Fitness. Antes de qualquer alteração leia, nesta ordem: AGENTS.md, PROJECT_HANDOFF.md, docs/PROJECT_CONTEXT.md, a seção relevante de SPEC.md e TASKS.md. Use busca por símbolo antes de abrir arquivos. Preserve a arquitetura e as invariantes de RLS, concorrência otimista, compatibilidade de dados, tipo de conta imutável e preview humano da IA. Consulte SECURITY.md, docs/ARCHITECTURE.md, docs/DATABASE.md e docs/RUNBOOK.md conforme o lote. Faça mudança pequena e revisável, testes e `pnpm check`; atualize a documentação correspondente. Não declare testado em produção o que só foi simulado.
