# Tarefas

Cada tarefa deve caber em um commit revisável e reversível.

## Agora

- [ ] **Convite e cadastro — integração visual** — Novo personal escolhe modo no cadastro; aluno novo define senha pelo link; executar teste real com dois e-mails controlados, inclusive Auth expirado, resposta de conta existente e UI de Perfil/Personal em celular. A migração `202609240006` foi aplicada e verificada no Supabase em 2026-09-24, sem alterar as 94 linhas existentes. O teste local não abre servidor dev neste ambiente (`uv_interface_addresses`), então não declarar esses fluxos como validados em navegador autenticado.
- [ ] **Lote 1 — integração** — Migração aplicada em produção em 2026-09-24; conferir duas abas, dois dispositivos, offline/reconexão e conflitos reais com navegador autenticado.
- [ ] **Lote 2 — integração** — Migração e chave privada aplicadas em produção; validar RPC/RLS e quota com Gemini real usando conta autenticada.
- [ ] **Lote 3 — verificação real** — Validar trocas e recusas no navegador e persistência do perfil com conta autenticada em produção.
- [ ] **Lote 4 — verificação real** — Inspecionar visualmente PDFs longos e texto com acentos no navegador em produção.
- [ ] **Lote 5 — IA opcional** — Camada explicativa Gemini não foi adicionada; motor determinístico funciona sem ela. Definir limite persistente por usuário antes de habilitar chamadas durante treino.
- [ ] **Lote 6 — banco real** — Migração aplicada; testar RPC autenticada, limites simultâneos, RLS e integração de OCR/IA.
- [ ] **Lote 7 — integração** — Migração e service role privada aplicadas; testar convites de conta nova/existente e RLS com duas contas e personal.
- [ ] **Lote 8 — integração** — Testar dois usuários reais e versões concorrentes na prescrição, visualização/execução do aluno, responsividade da tela `/trainer` e fluxo de convite existente.
- [ ] **Lote 9 — integração** — Testar triggers de notificação, marcação de leitura e feedback com RLS autenticada em Supabase real.
- [ ] **Lote 10 — integração** — Migração aplicada; conferir index/trigger, pagamento com dois alunos e derivação de atraso em data real.
- [ ] **Lote 11 — fluxo real** — Testar alteração de senha com/sem exigência de reautenticação e teste de geração Gemini para aluno autorizado em ambiente de homologação.

- [ ] **T6** — Configurar `GEMINI_API_KEY` na Vercel e validar geração real · atende `R7`, `R8` · verifica-se: OCR e plano funcionam em produção.
- [ ] **T9** — Validar em produção a recuperação de gravações pendentes, conflitos reais e salvamento de plano gerado · atende `R13`, `R14`.
- [x] **Publicação em produção, 2026-09-24** — PR #4 integrado à `main` como `be9262b`; 15 commits revisáveis preservados. `SUPABASE_SERVICE_ROLE_KEY` aparece como Secret nos ambientes Production e Preview da Vercel. Deploy `dpl_8gSneWaAKnTVEEGnRBzxA4AkD2VE` Ready; tela pública de acesso abriu em `personal-fitness-omega.vercel.app`. `pnpm check` passou com 95 testes, tipos, build e lint sem erros (6 avisos). Fluxos autenticados de quota, convites, acesso cruzado, notificações e salvamento ainda dependem de teste com contas reais; a tela de login não comprova esses fluxos.

## Anotado durante a implementação

- [ ] Definir rate limit por usuário antes de divulgação pública.
- [ ] Criar aviso de privacidade específico para conteúdo enviado à IA.
- [ ] Avaliar persistência de nível e equipamentos no perfil após validar o MVP.

## Feito

- [x] **Ajustes de convite, formulários e mídia local** — Formulários Perfil/Personal espaçados; seleção de conta personal; pré-cadastro nome/e-mail e senha definida pelo próprio aluno; 19 mapeamentos de imagens de demonstração verificadas no catálogo aberto, conservados offline via Service Worker. Gif do Treino não incorporado sem licença. `pnpm check` passa localmente; integração com contas reais continua pendente.
- [x] **Migrações de produção, 2026-09-24** — Aplicados em transações, na ordem, os seis arquivos `202609230001` a `202609240005` no projeto Supabase `personal-fitness`. Antes, criada cópia privada `deployment_backups.fitness_resources_pre_20260924`; depois, 94 registros originais e 94 cópias com conteúdo original igual, 11 tabelas novas com RLS, 22 policies, acesso do papel `authenticated` à cópia negado. SQL Editor não registra essas execuções no histórico formal de migrations; verificar manualmente antes de repetir. Testes com usuários reais continuam pendentes.

- [x] **Lote 3 — código local** — Padrão, região, mecânica e lateralidade opcionais; catálogo ampliado sem alterar IDs antigos; filtro determinístico, equipagem/recusa/override, proteção contra alternativas antigas ruins e IA livre; testes de equivalência. Verificação real pendente.
- [x] **Lote 4 — código local** — Exportação A4 para rotina e programa, view model puro e teste de histórico/privacidade; verificação visual pendente.
- [x] **Lote 5 — motor local** — Dica determinística após série, com testes de faixa, RIR, RPE, histórico e exclusões de aquecimento/cardio. Sem camada Gemini opcional.
- [x] **Lote 6 — auditoria local** — Revisadas rotas existentes, callback interno, logs, limites de IA e OCR; threat model e riscos em `SECURITY.md`. Integração de banco real pendente.
- [x] **Lote 7 — fundação local** — Tabelas relacionais, grants/RLS, convite Auth Admin, registro trainer e aceitação por e-mail. Sem banco real/teste de e-mail nesta execução.
- [x] **Lote 8 — código local** — Portal profissional, detalhes do aluno, prescrições com edição CAS, PDF para aluno e execução de prescrição pelo aluno sem alterar a rotina original.
- [x] **Lote 9 — código local** — Aluno envia feedback/pedido de troca, personal responde e resolve, notificações em app e triggers para eventos principais. Banco real pendente.
- [x] **Lote 10 — código local** — Aderência pura/UTC, resumo por aluno e controle administrativo de pagamentos e lembretes com índices deduplicadores. Banco real pendente.
- [x] **Lote 11 — código local** — Perfil retrocompatível com preferências, senha via Supabase e rascunho Gemini para aluno, editável antes de atribuir. Fluxo real pendente.

- [x] **Lote 2 — código local** — Duas gerações de programa/mês UTC, reserva/liberação atômica, retry idempotente, contador e renovação. Testes locais cobrem limite, concorrência, falha, retry e virada do mês. Integração de banco real pendente.

- [x] **Lote 1 — código e regressões** — Falso conflito com edição em trânsito e reutilização de versão após exclusão reproduzidos e corrigidos; diários por aba, retomada offline, CAS e bootstrap protegidos. Especificação documenta cenários A–O e limites dos testes. `pnpm check` final em 2026-09-23: 63/63 testes, tipos/build/gate de segredos aprovados, lint sem erros e com 6 avisos preexistentes. Branch de revisão: `fix/batch-1-sync`. Sem deploy nem aplicação de migração nesta execução.

- [x] **T0** — Remover dados demonstrativos e exigir perfil inicial (`33ddc4a`).
- [x] **T1** — Validar contratos do gerador, dias, IDs e cardio híbrido (19 testes verdes).
- [x] **T2** — Revisão do plano com justificativa, exercícios e progressão antes de salvar.
- [x] **T3** — Upload e transcrição de imagem com limite de tamanho e revisão de texto.
- [x] **T4** — Fixtures explícitas substituem dependência dos dados demo.
- [x] **T5** — Frequência semanal obrigatória de 1 a 7 dias no onboarding.
- [x] **T7** — Lote completo integrado no PR #1 (`8bb63a1`); Vercel Production “Ready” e tela pública de acesso verificada.
- [x] **T8** — Semana com dois treinos na segunda, futebol, cardio, metas por série e descanso interpretada e revisável (teste de contrato).
