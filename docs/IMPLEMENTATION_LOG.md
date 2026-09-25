# Implementation Log

Registro histórico verificável pelo `git log`, atualizado em 2026-09-24. SHAs abaixo são **commits de implementação no histórico local**; publicação e migrations são registradas separadamente. Ver [TASKS.md](../TASKS.md) para o que ainda precisa de validação. Cada lote descreve objetivo, causa, decisão, código, banco, testes e limite. Os commits posteriores corrigiram alguns comportamentos do mesmo lote.

## Baseline

O MVP já incluía autenticação Supabase, rotinas individuais JSONB e importação. Antes da sequência atual: remoção de dados fictícios `33ddc4a`, geração inicial Gemini/foto `51af63e`, semana complexa e cargas por série `e5af33b`. Conflitos falsos ao salvar e fluxo personal incompleto motivaram os lotes. Não houve reescrita do produto.

## Lote 1 — Concorrência

**Objetivo/problema:** salvar rapidamente, importar lote e alternar abas sem perder edição nem confundir resposta perdida com conflito verdadeiro. **Causa:** confirmação in-flight podia ser confundida com edição posterior, exclusão física permitia reutilizar versão e bootstrap concorrente sobrescrevia perfil. **Decisão/solução:** CAS, tentativa imutável, reconciliação de próxima versão e payload, fila isolada por aba com Web Locks e tombstone. **Arquivos:** `app/api/fitness/route.ts`, `features/fitness/use-fitness.ts`, `lib/fitness/sync*.ts`, `persistence.ts`. **Migration:** `202609230001_fitness_deletion_versions.sql`. **Testes:** `tests/sync-client.test.ts`, `sync-cache.test.ts`, `persistence.test.ts` simulam resposta perdida, concorrência, offline, conflitos e isolamento. **Commits:** `859b424`, `858e2f6`, `41163fb` (além dos ajustes anteriores `c1baa8b`, `a64aace`). **Risco:** teste real entre abas/dispositivos ainda pendente.

## Lote 2 — Quota IA

**Objetivo:** duas gerações concluídas por conta/mês UTC, sem contar edição/OCR/importação. **Decisão/solução:** reserva, conclusão/liberação atômicas e request ID idempotente; UI exibe contador. **Banco:** `ai_usage`, `ai_generation_requests`, migration `202609240001_ai_usage.sql`. **Arquivos:** `lib/fitness/ai-quota.ts`, `app/api/ai/workout/route.ts`. **Testes:** falha Gemini, mês novo, retry e concorrência simulada nos testes de quota. **Commit:** `f5ba8a9`. **Risco:** validar RPC concorrente com Auth/banco reais.

## Lote 3 — Substituição inteligente

**Objetivo:** impedir equivalência incorreta como elevação lateral → desenvolvimento. **Decisão:** metadados opcionais retrocompatíveis e filtro determinístico antes da UI/IA; opção vazia válida e personal define overrides. **Arquivos:** `lib/fitness/model.ts`, `seed.ts`, `recommendations.ts`, `ai.ts`, `features/fitness/workout.tsx`. **Migration:** nenhuma. **Testes:** equivalência de ombro, supino, agachamento, rosca, equipamento e override na suíte local. **Commit:** `0176797`. **Risco:** conferir biblioteca e recusa no navegador com dados reais.

## Lote 4 — PDF

**Objetivo:** exportar rotina ou programa A4 sem IA. **Decisão:** view model puro + jsPDF no clique; evitar IDs técnicos. **Arquivos:** `lib/fitness/pdf.ts`, `features/fitness/routine-preview.tsx` e componentes de exportação. **Migration:** nenhuma. **Testes:** transformação e privacidade em testes PDF. **Commit:** `97f6101`. **Risco:** inspeção visual de PDFs extensos/acentos em produção.

## Lote 5 — Coach

**Objetivo:** feedback por série disponível mesmo sem Gemini. **Decisão:** regra pura para reps, faixa, RIR/RPE e histórico; não chamar LLM por série. **Arquivos:** `lib/fitness/domain.ts`, `features/fitness/workout.tsx`. **Migration:** nenhuma. **Testes:** carga alta/baixa, aquecimento, ausência de histórico. **Commit:** `4eefa17`. **Risco:** explicador Gemini opcional não foi implementado.

## Lote 6 — Segurança

**Objetivo:** limitar abuso e evitar redirects/segredos/acesso indevido. **Decisão:** callback só aceita retorno local, rotas IA autenticadas com limites SQL e validação; threat model em `SECURITY.md`. **Arquivos:** `app/auth/callback/route.ts`, `app/api/ai/*`, `SECURITY.md`. **Migration:** `202609240002_api_rate_limits.sql`. **Testes:** regressão de rota/origem e gates locais; policies reais continuam exigindo teste autenticado. **Commit:** `3661936`. **Risco:** SMTP, RLS entre contas e limites simultâneos não validados fim a fim.

## Lote 7 — Fundação trainer/aluno

**Objetivo:** perfis, vínculos, convites e RLS sem perder histórico individual. **Decisão:** tabelas relacionais e convite Auth Admin server-side; ativação por e-mail verificado. **Arquivos:** `app/api/trainer/route.ts`, `lib/fitness/trainer.ts`. **Migration:** `202609240003_trainer_foundation.sql`; seguida pelas migrations de pré-cadastro `202609240006`, ficha/aceite atômico `202609240007` e papel imutável `202609240008`. **Testes:** SQL `supabase/tests/trainer_account_flow.sql` executado com rollback em produção; 98 testes locais no gate anterior a esta documentação. **Commits:** `88b617f`, `a34fa98`, `bef7d4a`, `7f549f8`, `72e3bbf`, `0376993`. **Risco:** entrega de e-mail e fluxos entre duas contas reais pendentes.

## Lote 8 — Dashboard e atribuição

**Objetivo:** personal prescreve, aluno visualiza e executa mantendo seus dados antigos. **Decisão:** `trainer_routines` com CAS; aluno registra execução em seu próprio `fitness_resources`. **Arquivos:** `features/fitness/trainer-portal.tsx`, `features/fitness/app.tsx`, `app/api/trainer/student/route.ts`, `assigned/route.ts`. **Migration:** fundação `202609240003`. **Testes:** contratos de atribuição/autorização na suíte local. **Commit:** `decf67e`. **Risco:** validação visual e fluxo de duas contas pendentes.

## Lote 9 — Feedback/notificações

**Objetivo:** pedido de troca e relato do aluno chegarem ao personal. **Decisão:** feedback relacional, resposta/fechamento e sino in-app; triggers notificam eventos. **Arquivos:** `app/api/trainer/feedback/route.ts`, `app/api/notifications/route.ts`, `features/fitness/notification-bell.tsx`. **Migration:** `202609240004_feedback_notifications.sql`. **Testes:** contratos de feedback/notificação na suíte local. **Commit:** `5165368`. **Risco:** entrega/leitura e RLS com usuários distintos pendentes.

## Lote 10 — Constância/pagamentos

**Objetivo:** medir adesão e acompanhar mensalidades sem movimentar dinheiro. **Decisão:** funções UTC e controle administrativo; lembrete deduplicado. **Arquivos:** `lib/fitness/adherence.ts`, `payments.ts`, `app/api/trainer/summary/route.ts`, `payments/route.ts`. **Migration:** `202609240005_payment_reminders.sql`. **Testes:** fórmula e isolamento contratual na suíte local. **Commit:** `709dd8b`. **Risco:** confirmar cenários com dois alunos e vencimento real.

## Lote 11 — Perfil/senha

**Objetivo:** completar perfil com preferências/equipamento e troca de senha. **Decisão:** campos opcionais para compatibilidade e Supabase Auth para senha; IA de personal lê apenas aluno vinculado. **Arquivos:** `features/fitness/profile.tsx`, `lib/fitness/model.ts`, `app/api/ai/workout/route.ts`. **Migration:** nenhuma obrigatória para perfil individual JSONB; ficha do aluno em `202609240007`. **Testes:** contratos de perfil e senha na suíte local. **Commits:** `6d9fcc6`, `7f549f8`. **Risco:** fluxo real de reautenticação a testar.

## Lote 12 — Revisão/regressão e publicação

**Objetivo:** preservar histórico, segurança do cache e bloqueio de promoção indevida. **Decisão:** Service Worker v4 só cacheia recursos públicos; tipo definido uma vez pelo trigger Auth; ajustes de mídia com fonte permitida. **Arquivos:** `public/sw.js`, `features/fitness/access-gate.tsx`, `features/fitness/student-invite-form.tsx`, `supabase/schema.sql`, `SECURITY.md`. **Migrations:** as nove migrations foram aplicadas em produção, última `202609240008`; nenhuma migration desta reorganização documental. **Testes:** `supabase/tests/trainer_account_flow.sql` passou em transação com rollback; gate local anterior passou 98 testes e build; testar convite real e isolamento ainda pendente. **Commits:** `dfc4efc`, `e088ce4`, `1360e88`, `a34fa98`, `72e3bbf`, `0376993`. **Publicação:** GitHub `main` merge `8a995de`, deploy Vercel anterior `dpl_HheMKuCqfEhnmK9WrJ3DJpvCXum9` Ready. **Risco:** publicação não comprova fluxos autenticados.

## Documentação e handoff

Esta entrega cria README sucinto, `PROJECT_HANDOFF.md`, `PROJECT_CONTEXT.md` e guias de arquitetura, banco, IA, operação e decisões. Atualiza `AGENTS.md`, `SPEC.md`, `TASKS.md`, `SECURITY.md` para distinguir código implementado, migrations aplicadas e verificação autenticada pendente. **Commit desta documentação:** consultar `git log -- docs/IMPLEMENTATION_LOG.md` após publicação; SHA não é inserido antecipadamente no próprio commit.
