# Personal Fitness

MVP multiusuário para planejar musculação, corrida e treino híbrido, registrar a execução real e acompanhar carga, volume e evolução. Aceita rotinas manuais, texto, JSON e fotos de fichas; a geração por IA usa o perfil e o histórico da conta e sempre passa por revisão antes de salvar.

## Comece por aqui

- Produto e critérios verificáveis: [`SPEC.md`](SPEC.md)
- Regras para manutenção por humanos e agentes: [`AGENTS.md`](AGENTS.md)
- Próximos lotes: [`TASKS.md`](TASKS.md)
- Banco e políticas: [`supabase/schema.sql`](supabase/schema.sql)
- Alterações incrementais do banco: [`supabase/migrations/`](supabase/migrations/)

## Tecnologias

- Next.js 16 e React 19
- Supabase Auth e Postgres com Row Level Security
- Vercel
- TypeScript, Tailwind CSS e Zod
- Gemini Flash-Lite para geração estruturada e leitura de imagem

## Arquitetura resumida

| Área | Arquivo principal |
|---|---|
| Autenticação e entrada | `app/page.tsx`, `features/fitness/access-gate.tsx` |
| Dados e sincronização | `app/api/fitness/route.ts`, `features/fitness/use-fitness.ts` |
| Contratos persistidos | `lib/fitness/model.ts` |
| Rotinas e importação | `features/fitness/routines.tsx`, `features/fitness/import-workout.tsx` |
| IA e OCR | `app/api/ai/`, `lib/fitness/ai.ts`, `lib/fitness/gemini.ts` |
| Substituições equivalentes | `lib/fitness/recommendations.ts`, `features/fitness/workout.tsx` |
| PDF de rotina e programa | `lib/fitness/pdf.ts`, `features/fitness/routine-preview.tsx` |
| Personal e alunos | `app/api/trainer/`, `supabase/migrations/202609240003_trainer_foundation.sql` |
| Portal do personal | `/trainer`, `features/fitness/trainer-portal.tsx` |
| Constância e pagamentos | `lib/fitness/adherence.ts`, `app/api/trainer/payments/route.ts` |
| Histórico e progresso | `features/fitness/history.tsx`, `features/fitness/progress.tsx` |

## Configuração local

1. Crie um projeto no Supabase.
2. Execute [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor.
3. Crie uma chave no Google AI Studio para os recursos de IA e imagem.
4. Copie `.env.example` para `.env.local` e preencha as variáveis.
5. Instale e execute:

```bash
pnpm install
pnpm dev
```

Variáveis necessárias:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
GEMINI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Verificação canônica

```bash
pnpm check
```

Durante o desenvolvimento, `pnpm check:fast` pula apenas o build final.

## Fluxos importantes

- Nova conta: autenticação → altura/peso/objetivos/frequência → painel vazio.
- Gerador: preferências + perfil + histórico → API server-side → Zod → revisão → salvar.
- Foto: imagem em memória → transcrição → texto editável → parser → revisão → importar.
- Texto: títulos por dia da semana e turno viram rotinas separadas, inclusive duas no mesmo dia. Cardio no fim da sessão vira exercício da rotina; descanso não cria rotina. A prévia permite corrigir os dias.
- Cargas: sequências como `100 / 110 / 120 kg` são preservadas por série; metas condicionais (`até 110 kg`) ficam como orientação. Cargas indicadas “por lado” aparecem na ficha, sem preencher automaticamente o peso total.
- Fotos de até 8 MB são reduzidas no navegador para respeitar o limite de requisição da Vercel; o servidor não armazena a foto.
- Persistência: alteração otimista local → diário exclusivo da aba → API versionada → Supabase com RLS. Respostas perdidas são reconciliadas sem descartar edições feitas durante o envio. Requer navegador moderno com Web Locks em HTTPS.

### Atualização do Lote 1

Em banco existente, aplicar a migração versionada `202609230001_fitness_deletion_versions.sql` antes de publicar a nova API. Ela adiciona `deleted_at`, mantém as políticas existentes e não apaga registros. Exclusões passam a preservar apenas um marcador com versão crescente e payload vazio, evitando sobrescrita por dispositivos antigos. Não reaplicar o schema completo para atualizar produção.

O cache antigo é migrado automaticamente. Ao atualizar, recarregue as abas antigas sem limpar armazenamento; elas ainda executam o protocolo anterior até recarregar. O procedimento e os limites de rollback/validação estão em `SPEC.md` e `TASKS.md`.

### Quota mensal de IA

O gerador permite duas criações por mês UTC por conta gratuita. Importar, OCR, editar e criar manualmente não consomem quota. Em instalações existentes aplique `supabase/migrations/202609240001_ai_usage.sql` depois da migration do lote 1 e configure `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor, antes de publicar a rota. Retries usam ID estável para recuperar o mesmo programa; a resposta inválida do Gemini libera a reserva.

### Modo personal

O cadastro público oferece treino individual ou conta de personal. O tipo é definido na criação da conta Auth e não pode ser alterado pelo próprio usuário depois. O aluno acompanhado é pré-cadastrado **pelo personal** em `/trainer`: nome, e-mail e ficha de treino (altura, peso, objetivos, frequência, experiência, tempo disponível, equipamentos e preferências). Aluno novo recebe convite e só define a senha; a aceitação cria o perfil preenchido e vínculo na mesma transação. Contas individuais existentes conservam o perfil e o histórico e aceitam convites pelo app. Convites antigos sem ficha continuam válidos com o fluxo anterior de onboarding. O personal prescreve rotinas, acompanha treinos e feedbacks e controla mensalidades sem processar pagamentos. A geração de rascunhos com IA usa o perfil do aluno vinculado e exige revisão/atribuição manual. Demonstrações curtas da biblioteca Free Exercise DB são guardadas no cache do navegador para uso offline após o primeiro carregamento; vídeos e exercícios personalizados sem mídia dependem da rede. Uma aba já aberta continua registrando treino offline; recarregar sem internet mostra uma tela genérica para evitar armazenar HTML com dados de outra conta. O conteúdo do Gif do Treino não é copiado sem licença de uso verificável.

**Fluxo de validação com duas contas:**

1. Crie uma conta nova escolhendo **Personal trainer**, confirme o e-mail e entre em `/trainer`.
2. Em **Pré-cadastrar aluno**, preencha a ficha e envie o convite para outro e-mail ainda não cadastrado.
3. Abra o link no e-mail do aluno; defina somente a senha. O aluno deve entrar direto no painel com nome, objetivos e frequência já preenchidos.
4. Como personal, abra o aluno ativo e confira a ficha; atribua uma rotina. Como aluno, execute a rotina e envie feedback.
5. Confirme que uma conta **Treino individual** não oferece ativação de modo personal em `/trainer` e que editar a metadata da conta não muda o tipo no banco.

O teste SQL transacional `supabase/tests/trainer_account_flow.sql` verifica criação, vínculo e bloqueio da promoção sem deixar contas sintéticas no banco; ele não verifica entrega do e-mail.

Em banco existente, aplique **na ordem** as migrations `202609230001` (sync), `202609240001` (quota), `202609240002` (limites), `202609240003` (relações e RLS), `202609240004` (notificações), `202609240005` (lembretes), `202609240006` (nome do aluno), `202609240007` (ficha e aceitação atômica) e `202609240008` (tipo de conta imutável). Todas foram executadas via SQL Editor em 2026-09-24 no projeto de produção `personal-fitness`; a ferramenta não as registrou na tabela formal de migrations. Confira o estado antes de repetir. Não execute `schema.sql` em banco existente: ele serve apenas para recriar um banco novo. Configure `SUPABASE_SERVICE_ROLE_KEY` somente em funções server-side na Vercel para quota e convite. `GEMINI_API_KEY` também permanece privada. O convite usa o domínio de produção fornecido pela Vercel (`VERCEL_PROJECT_PRODUCTION_URL`); localmente pode definir `APP_ORIGIN` para uma origem confiável de teste, incluída nos redirecionamentos permitidos do Supabase.

## Publicação

O repositório GitHub está conectado à Vercel. Faça um commit coerente em `main`, aguarde o deploy ficar `Ready` e execute um smoke test sem usar dados sensíveis.

No projeto Vercel, abra **Settings → Environment Variables** e crie `GEMINI_API_KEY` como variável privada de **Production** (e Preview, se necessário). Copie o valor de [Google AI Studio — API Keys](https://aistudio.google.com/app/apikey), sem colocá-lo no GitHub nem prefixá-lo com `NEXT_PUBLIC_`. Após adicioná-lo, faça um novo deploy para que as funções de IA recebam a variável. Sem a chave, o gerador e o leitor de fotos mostram um erro claro; o restante do aplicativo continua funcionando.

O treino individual usa JSONB versionado por conta; quotas, vínculos, feedbacks, notificações, prescrições e mensalidades usam tabelas relacionais. RLS restringe acesso à própria conta e concede ao personal ativo apenas os dados necessários do aluno vinculado. Veja `SECURITY.md` para controles e limites da validação.
