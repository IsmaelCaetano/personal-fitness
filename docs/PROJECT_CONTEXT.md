# Personal Fitness — Project Context

## Como usar este arquivo

Antes de alterar o projeto: 1. leia [AGENTS.md](../AGENTS.md); 2. leia este arquivo; 3. consulte [SPEC.md](../SPEC.md); 4. consulte [TASKS.md](../TASKS.md); 5. abra apenas os arquivos necessários. Atualizado em **2026-09-24**.

## Estado atual

Fonte: GitHub `IsmaelCaetano/personal-fitness`, branch `main`. Produção: Vercel, `https://personal-fitness-omega.vercel.app/`. Banco e autenticação: Supabase Postgres/Auth. IA: Gemini. E-mail de cadastro/convite/recovery: Supabase Auth; o provedor SMTP externo e a configuração do domínio `auth.caetanolabs.com` **não são verificáveis no código**. Não presumir entrega até realizar teste real. A publicação anterior ao commit desta documentação foi o merge `8a995de`; confirme o SHA atual no GitHub. Migrações `202609230001` a `202609240008` foram aplicadas no Supabase de produção via SQL Editor; não há histórico confiável no controle formal de migrations do projeto remoto. A validação SQL transacional do papel/convite passou com rollback; fluxo autenticado entre dois usuários ainda não foi testado ponta a ponta. Stack: Next.js 16, React 19, TypeScript, Zod, pnpm, Vercel, Supabase RLS e Gemini.

## Produto e modos

- **Individual:** cadastro próprio, perfil inicial, criação/importação/IA de rotinas, execução, atividades livres, histórico, progresso, PDF e exportação por período. Nada é preenchido com dados demonstrativos.
- **Personal:** escolhe o tipo de conta no cadastro público inicial; a identidade Auth recebe papel imutável. Pré-cadastra aluno com ficha e convite, prescreve e atribui treino, gera rascunho IA revisável para aluno vinculado, consulta histórico e aderência, acompanha feedback, notificações e mensalidades administrativas. Não existe promoção de conta individual a personal.
- **Aluno:** personal faz o pré-cadastro; aluno novo recebe link Auth, define senha e aceita vínculo com a ficha já preenchida. Conta individual existente pode aceitar convite dentro do app preservando perfil/histórico. Vê e executa prescrições sem alterar sua estrutura; envia feedback e pedido de troca.

## Mapa do código

| Área | Pontos de entrada |
|---|---|
| Auth | `app/page.tsx`, `app/auth/callback/route.ts`, `app/reset-password/page.tsx`, `features/fitness/access-gate.tsx`, `lib/supabase/client.ts`, `server.ts`, `proxy.ts` |
| Dados individuais | `app/api/fitness/route.ts`, `features/fitness/use-fitness.ts`, `lib/fitness/model.ts`, `persistence.ts`, `sync.ts`, `sync-client.ts`, `sync-cache.ts` |
| Rotinas e mídia | `features/fitness/app.tsx`, `routines.tsx`, `import-workout.tsx`, `workout.tsx`, `exercise-media.tsx`, `lib/fitness/import.ts`, `seed.ts` |
| IA | `app/api/ai/workout/route.ts`, `app/api/ai/ocr/route.ts`, `lib/fitness/ai.ts`, `gemini.ts`, `ai-quota.ts` |
| Equivalência/coach/PDF | `lib/fitness/recommendations.ts`, `domain.ts`, `pdf.ts`, `features/fitness/routine-preview.tsx` |
| Personal/aluno | `app/trainer/page.tsx`, `app/api/trainer/route.ts`, `student/route.ts`, `assigned/route.ts`, `summary/route.ts`, `feedback/route.ts`, `payments/route.ts`, `features/fitness/trainer-portal.tsx`, `student-invite-form.tsx`, `assigned-feedback.tsx`, `lib/fitness/trainer.ts`, `student-intake.ts` |
| Notificações | `app/api/notifications/route.ts`, `features/fitness/notification-bell.tsx` |
| Banco | `supabase/schema.sql`, `supabase/migrations/*.sql`, `supabase/tests/trainer_account_flow.sql` |
| Testes/gates | `tests/*.test.ts`, `scripts/check.sh`, `package.json` |

## Modelo de dados

As tabelas abaixo estão em `public`; identidades vêm de `auth.users`. Para colunas, FKs e policies veja [DATABASE.md](DATABASE.md).

| Tabela | Finalidade e ownership/RLS |
|---|---|
| `fitness_resources` | Perfil, exercícios, rotinas, sessões e medidas JSONB; usuário dono, leitura de histórico por personal ativo. FK `user_id → auth.users`. |
| `ai_usage` | Contador mensal da conta; leitura do dono, alteração por RPC restrita. FK para Auth. |
| `ai_generation_requests` | Idempotência de tentativa e resposta; FK para `ai_usage`, escrita reservada a RPC. |
| `api_rate_limits` | Janela por usuário/operação; RPC usa `auth.uid()`. |
| `account_profiles` | Tipo imutável e nome; dono ou personal vinculado para leitura. FK Auth. |
| `trainer_profiles` | Perfil profissional; FK conta, leitura própria/vinculada. |
| `trainer_students` | Vínculo ativo/pausado/encerrado; FKs conta personal e aluno, leitura dos participantes. |
| `trainer_invites` | Convite pendente, e-mail, ficha e expiração; personal e destinatário autenticado segundo RLS. |
| `trainer_routines` | Prescrição e versão; FKs personal/aluno; leitura do aluno/personal ativo, edição apenas personal ativo. |
| `student_feedback` | Relatos/pedido de troca e respostas; FK prescrição opcional; leitura participantes, escrita controlada. |
| `notifications` | Caixa in-app por conta; RLS do destinatário. |
| `payment_records` | Controle administrativo mensal, FKs personal/aluno; leitura do aluno ou personal ativo, escrita personal. |

## Autenticação

Cadastro/login/recuperação em `features/fitness/access-gate.tsx`; confirmação e retorno local seguro em `app/auth/callback/route.ts`; redefinição em `app/reset-password/page.tsx`; troca de senha em `features/fitness/profile.tsx`; logout em `features/fitness/app.tsx`. O trigger Auth em `supabase/schema.sql` / migração `202609240008` define `account_type` na criação, com convidados `invited_student` sempre individuais. O convite é enviado pelo servidor em `app/api/trainer/route.ts` via Admin Auth com service role; o aluno confirma identidade e aceita em `accept_trainer_invite` por RPC, criando vínculo e ficha na mesma transação. Confirme e-mail de entrega e UX com contas reais.

## Sincronização e recuperação

`fitness_resources` usa CAS `version`, HTTP 409 e marcadores de exclusão com versão monotônica. `sync-client.ts` guarda separadamente intenção recente e tentativa em voo, inclusive quando a resposta HTTP se perde após commit; `sync.ts` reconcilia conteúdo **e próxima versão exata** antes de avançar. Depois de rede ambígua, consulta nuvem; 409 real conserva a edição local e oferece escolha **por ID**, permitindo que outros IDs sejam sincronizados. O hook `use-fitness.ts` aplica debounce de 450 ms, retry de 10 s e timeout de 20 s. `sync-cache.ts` persiste snapshot/fila em diário por usuário e aba, com Web Locks; fila é carregada antes da rede e recupera diários de abas encerradas. Sem armazenamento disponível, mantém intenção em memória e avisa para não fechar aba. Excluir rotina conserva tombstone (payload vazio) e não apaga sessões históricas. Nunca limpar todas as pendências por um conflito, reiniciar versão após exclusão, nem aceitar resposta antiga como confirmação de edição mais nova. Ver [SPEC.md](../SPEC.md) R13–R19 e [ARCHITECTURE.md](ARCHITECTURE.md).

## IA, substituições e mídia

Gemini `gemini-3.5-flash-lite` está fixado em `lib/fitness/gemini.ts`; `GEMINI_API_KEY` apenas server-side. Gerador usa perfil + até 12 sessões, biblioteca permitida, Zod/domínio e preview antes de salvar; duas gerações concluídas por usuário/mês UTC via reserva e conclusão atômicas, idempotência por request ID, falhas liberam reserva. OCR transcreve imagem em memória e devolve texto editável; importação manual não consome quota. Feedback de série é determinístico em `lib/fitness/domain.ts`; **não há coach LLM opcional**. `rankExerciseAlternatives` em `lib/fitness/recommendations.ts` filtra por `movementPattern`, `targetRegion`, `mechanics`, `laterality`, equipamento e restrições, com override do personal. Nunca sugerir só por músculo; nenhuma alternativa é resultado válido. IA nunca persiste automaticamente. Algumas demonstrações da Free Exercise DB são guardadas em cache público após o primeiro acesso; não copiar Gif do Treino sem licença. [AI.md](AI.md).

## Segurança e variáveis

RLS e autorização server-side são fronteiras complementares; `user_id`/papel do cliente não autorizam acesso. Zod valida entrada e output IA; mutações validam origem; payload, timeout e rate limit têm teto; chave service role nunca vai ao navegador. Veja [SECURITY.md](../SECURITY.md).

| Nome | Finalidade | Lado / ambiente |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase | público, local/Vercel |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicável RLS | público, local/Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fallback legado da chave pública | público, opcional |
| `SUPABASE_SERVICE_ROLE_KEY` | Quota e convite Admin | privado, servidor local/Vercel |
| `GEMINI_API_KEY` | Geração e OCR | privado, servidor local/Vercel |
| `APP_ORIGIN` | Origem confiável para convites | privado, servidor local quando necessário |
| `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL` | Contexto fornecido pela Vercel para URL de convite | servidor Vercel automático |

Supabase fornece banco/Auth/e-mail de Auth; Vercel executa app/API; Gemini processa IA; **Resend SMTP é uma configuração possível do painel Supabase, não uma integração comprovada neste repositório**. Ver [RUNBOOK.md](RUNBOOK.md).

## Invariantes

- Nenhuma conta lê/escreve dados de outra sem vínculo ativo e permissão explícita; personal não vira dono da rotina individual do aluno.
- Aluno não edita estrutura prescrita; pode executar e pedir troca. Histórico antigo nunca é removido por exclusão da rotina ou término do vínculo.
- Tipo de conta só é estabelecido no cadastro Auth e não é promovido via request/metadata.
- IDs `base-*` não mudam nem são reordenados; perfis legados continuam legíveis.
- IA/OCR não salvam sem ação humana; quota e limites são impostos no servidor; service role/Gemini nunca no cliente.
- Tentativa em voo, fila pendente e tombstone jamais são descartados silenciosamente; conflito verdadeiro permanece visível.
- Service Worker não armazena HTML autenticado; uso offline após recarga usa fallback genérico.

## Implementado

Fluxos individuais, importação de texto/JSON/foto, fila versionada, quota e geração, equivalência, PDF, coach determinístico, portal personal, convite/pré-cadastro, prescrições, feedback/notificações, aderência e mensalidades administrativas; migrações de produção até `202609240008`, testes SQL transacionais de papéis e suíte local.

## Pendente

Smoke tests com duas contas reais de convite/ativação/e-mail, isolamento RLS, geração Gemini/OCR e quota, uso em duas abas/dispositivos/offline, PDFs longos, responsividade do portal e troca de senha sob reautenticação. Coach explicativo via Gemini não foi criado, pois é opcional.

## Known Issues

Migrações aplicadas via SQL Editor podem não aparecer em `supabase_migrations`; não reaplicar sem consultar o banco. Domínio/SMTP de Auth não comprovados pelo código. Navegação autenticada offline após **recarregar** mostra fallback genérico; somente aba já aberta pode continuar trabalhando offline. Validações sintéticas/SQL não substituem o teste real de entrega de convites.

## Próximas prioridades

Executar o checklist autenticado de [TASKS.md](../TASKS.md), registrar resultado e só então considerar divulgação; conferir configuração SMTP/redirecionamentos e políticas com usuários distintos.

## Instruções para Codex / Gemini / Claude / ChatGPT

Antes de alterar qualquer código: 1. leia `AGENTS.md`; 2. leia `docs/PROJECT_CONTEXT.md`; 3. leia a seção relevante de `SPEC.md`; 4. consulte `TASKS.md`; 5. localize código via busca; 6. não percorra o repositório inteiro sem necessidade; 7. preserve arquitetura e invariantes; 8. atualize documentação após mudanças; 9. rode `pnpm check`. `SPEC` = produto, `AGENTS` = regras, `PROJECT_CONTEXT` = estado real, `TASKS` = roadmap, `SECURITY` = segurança.
