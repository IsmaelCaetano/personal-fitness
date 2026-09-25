# Operação do Personal Fitness

## Desenvolvimento local e testes

Use Node >=22.13 e pnpm 11.25; copie `.env.example` para `.env.local` e preencha apenas localmente. `pnpm install`; `pnpm dev`. Rode `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` e `pnpm check` antes de publicar. `pnpm check` inclui testes, tipos, lint, build e gate de segredos. Testes locais não comprovam entrega de e-mail, RLS com identidade real ou comportamento em dois dispositivos.

## Deploy

GitHub `IsmaelCaetano/personal-fitness` `main` → Vercel `personal-fitness` → produção `https://personal-fitness-omega.vercel.app/`. Fazer commit e PR revisáveis, integrar na `main`, confirmar deploy `Ready`, testar login público e depois fluxos autenticados com contas de teste. Não expor tokens em logs ou capturas. Rollback de código não reverte migração de banco; antes de reverter mudanças de sincronização, considerar versões de tombstones já gravadas.

## Supabase

Em projeto **novo**, usar `supabase/schema.sql`. Em ambiente **existente**, consultar `supabase/migrations/` e [DATABASE.md](DATABASE.md). Em 2026-09-24 a produção recebeu todos os nove arquivos `202609230001`–`202609240008` via SQL Editor; esse método não atualiza automaticamente o histórico formal de migrations. Verifique objetos e dados antes de rodar novamente; não redefina esquema em produção. O teste `supabase/tests/trainer_account_flow.sql` usa transação com rollback e não cria contas permanentes.

## Variáveis

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `APP_ORIGIN`. `NEXT_PUBLIC_SUPABASE_ANON_KEY` é fallback público legado; `VERCEL_PROJECT_PRODUCTION_URL` e `VERCEL` são fornecidas pela Vercel quando aplicável. Chaves privadas só em funções do servidor e variáveis locais/da Vercel; nunca no Git. `APP_ORIGIN` precisa ser uma origem confiável e permitida no Auth para convites locais; em produção, a rota usa URL de produção fornecida pela Vercel quando a variável não está definida.

## E-mail e Resend

Convite, confirmação de cadastro e recuperação passam pelo **Supabase Auth**. Se o SMTP do projeto for Resend, confirme no painel Auth → SMTP o remetente/domínio `auth.caetanolabs.com`, identidade verificada, limites, templates e Redirect URLs de `/auth/callback` e `/reset-password`. **O código não configura Resend nem comprova que esse domínio/SMTP está ativo**; não criar ou versionar API key no repositório. Teste chegada do convite e recuperação usando endereços reais controlados, inclusive spam/expiração.

## Gemini

Configure `GEMINI_API_KEY` na Vercel (produção e preview conforme uso) e em `.env.local`; faça novo deploy depois da alteração. `lib/fitness/gemini.ts` aponta para o modelo atual. Teste com conta autenticada; ausência da chave devolve erro claro, sem bloquear criação manual. Rate limit e quota requerem migrations e `SUPABASE_SERVICE_ROLE_KEY` no servidor.

## Diagnóstico rápido

| Sintoma | Investigar |
|---|---|
| Cadastro não confirma / convite não chega | SMTP/limite Supabase, templates, spam, Redirect URLs, domínio verificado; usar outra conta controlada |
| Link expirou | Expiração do Auth pode ser anterior à do convite; personal reenviar link e validar status no banco |
| Conta individual não abre /trainer | Tipo imutável no INSERT Auth; criar conta nova como personal, nunca editar metadata ou SQL para promover conta existente sem decisão explícita |
| 401/403 ou RLS | `getUser()`, cookies, vínculo `trainer_students.status=active`, policy e privilégio da rota; nunca contornar RLS |
| 409 ao salvar | Comparar versões/conteúdo e diário local; resposta HTTP perdida pode ter sido commitada; usar resolução por ID sem limpar toda fila |
| Offline/sincronização travada | Web Locks, armazenamento local por aba/usuário, rede e estado da fila; manter aba aberta se `localSafe=false`; recarga offline mostra fallback genérico |
| IA indisponível | Chave privada, modelo, timeout, status 503, tabela/RPC de quota e limite; não logar prompt com dados pessoais |
| Quota inesperada | `ai_usage`, `ai_generation_requests`, mês UTC e request ID; evitar INSERT manual ou SELECT+UPDATE concorrente |
| Migration ausente/aplicada duas vezes | Inspecionar `information_schema`, policies/funções/índices e histórico SQL; não supor pela tabela de migrations |
| Deploy não refletiu mudança | Confirmar branch `main`, SHA do commit, env do ambiente e status `Ready` na Vercel |

Guia de autorização e riscos: [SECURITY.md](../SECURITY.md). Testes manuais pendentes: [TASKS.md](../TASKS.md).
