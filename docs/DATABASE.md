# Banco de dados e migrações

Supabase Postgres é a persistência remota; Supabase Auth em `auth.users` é a fonte da identidade. `supabase/schema.sql` reproduz o esquema final **em banco novo**. Em banco existente use, na ordem, `supabase/migrations/`: `202609230001` (marcadores de exclusão), `202609240001` (quota), `202609240002` (rate limits), `202609240003` (personal/aluno), `202609240004` (notificações), `202609240005` (lembretes), `202609240006` (pré-cadastro), `202609240007` (ficha/ativação), `202609240008` (tipo imutável).

**Produção:** todos esses arquivos foram aplicados em 2026-09-24 por SQL Editor, sem rastreamento confiável em `supabase_migrations`. Conferir objetos e versão antes de executar qualquer migration novamente. Não rodar `schema.sql` sobre dados reais. Uma cópia privada pré-migração de `fitness_resources` foi criada naquele deploy; não é tabela de produto nem exposta a `authenticated`. O teste `supabase/tests/trainer_account_flow.sql` usa rollback e cobre criação/aceitação e bloqueio de promoção; não comprova entrega de e-mail ou RLS com duas contas reais.

| Tabela | PK / FKs e propósito | Acesso |
|---|---|---|
| `fitness_resources` | PK `(user_id,id)`; índice `(user_id,resource)`; `user_id → auth.users`; payload JSONB, version, deleted_at | CRUD do dono; personal ativo lê histórico necessário |
| `ai_usage` | `(user_id,period_start,feature)`; user Auth | Dono lê, funções privadas atualizam |
| `ai_generation_requests` | `(user_id,request_id)`; FK quota composta | Funções privadas reservam, concluem ou liberam |
| `api_rate_limits` | Chave por usuário/operação/janela; user Auth | RPC `consume_api_rate_limit` com identidade Auth |
| `account_profiles` | `user_id → auth.users` | Dono/personal vinculado leem; tipo definido pelo trigger |
| `trainer_profiles` | `user_id → account_profiles` | Profissional ou aluno vinculado lê |
| `trainer_students` | `id`; trainer/student → account_profiles | Participantes leem; função SQL ativa vínculo |
| `trainer_invites` | `id`; trainer → account_profiles | Personal e destinatário autenticado sob policy |
| `trainer_routines` | `id`; trainer/student → account_profiles; routine JSONB versionada | Personal ativo escreve; aluno lê |
| `student_feedback` | `id`; trainer/student → account_profiles; routine opcional → trainer_routines | Aluno envia, personal ativo responde |
| `notifications` | `id`; user → account_profiles | Destinatário lê/marca leitura |
| `payment_records` | `id`; trainer/student → account_profiles | Personal ativo escreve; aluno lê os próprios |

`account_profiles` de contas anteriores à migração pode estar ausente; handlers e UI tratam legado como individual, sem promoção implícita. `trainer_invites.intake` guarda temporariamente a ficha informada pelo personal; só no aceite válido ela vira perfil do aluno. Exercícios, perfis e sessões permanecem no JSONB individual; relações, quota e pagamentos são relacionais.

## Índices e isolamento

Índice `fitness_resources_user_resource_idx` atende bootstrap por usuário; índice parcial `ai_generation_requests_pending_idx` encontra reservas; índices `trainer_students_*_status_idx` suportam vínculo ativo. `trainer_invites_email_status_idx` procura convite por e-mail; `trainer_routines_student_idx`, `student_feedback_trainer_status_idx`, `notifications_user_unread_idx` e `payment_records_*_idx` atendem listagens. `notifications_payment_reminder_once_idx` evita lembretes duplicados.

RLS fica habilitado nas tabelas públicas; policies verificam dono (`auth.uid()`) ou `is_active_trainer`, e restringem escrita estrutural de prescrição ao personal. Quota usa RPCs com `service_role` **somente no servidor**; rate limit deriva identidade de `auth.uid()`. Um ID do frontend não concede acesso. Conferir grants e policies finais em `supabase/schema.sql` antes de alterar funções `SECURITY DEFINER`.

## Aplicação segura

1. Conferir backups, tabelas/colunas e estado de migrations do ambiente alvo.
2. Aplicar somente arquivos ainda ausentes, em ordem, preferencialmente numa transação apropriada por migration. Não inferir ausência pelo histórico vazio do SQL Editor.
3. Conferir RLS, grants, funções, índice e contagem/integridade de linhas antes de liberar app.
4. Executar testes SQL com rollback e testes autenticados de trainer A/student A contra contas B; preservar histórico. Consulte [RUNBOOK.md](RUNBOOK.md) e [SECURITY.md](../SECURITY.md).
