# Personal Fitness

MVP multiusuário para planejar musculação, corrida e treino híbrido, registrar a execução real e acompanhar carga, volume e evolução. Aceita rotinas manuais, texto, JSON e fotos de fichas; a geração por IA usa o perfil e o histórico da conta e sempre passa por revisão antes de salvar.

## Comece por aqui

- Produto e critérios verificáveis: [`SPEC.md`](SPEC.md)
- Regras para manutenção por humanos e agentes: [`AGENTS.md`](AGENTS.md)
- Próximos lotes: [`TASKS.md`](TASKS.md)
- Banco e políticas: [`supabase/schema.sql`](supabase/schema.sql)

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
- Persistência: alteração otimista local → API versionada → Supabase com RLS.

## Publicação

O repositório GitHub está conectado à Vercel. Faça um commit coerente em `main`, aguarde o deploy ficar `Ready` e execute um smoke test sem usar dados sensíveis.

No projeto Vercel, abra **Settings → Environment Variables** e crie `GEMINI_API_KEY` como variável privada de **Production** (e Preview, se necessário). Copie o valor de [Google AI Studio — API Keys](https://aistudio.google.com/app/apikey), sem colocá-lo no GitHub nem prefixá-lo com `NEXT_PUBLIC_`. Após adicioná-lo, faça um novo deploy para que as funções de IA recebam a variável. Sem a chave, o gerador e o leitor de fotos mostram um erro claro; o restante do aplicativo continua funcionando.

O banco usa uma tabela JSONB versionada por usuário. As políticas RLS garantem que cada pessoa só consiga ler e alterar os próprios registros.
