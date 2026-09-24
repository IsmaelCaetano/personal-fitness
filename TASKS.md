# Tarefas

Cada tarefa deve caber em um commit revisável e reversível.

## Agora

- [ ] **Lote 1 — revisão/liberação** — Revisar commits, aplicar `supabase/migrations/202609230001_fitness_deletion_versions.sql` por fluxo versionado e validar ambiente de teste com Postgres e Web Locks reais antes de publicar. Conferir duas abas, dois dispositivos, offline/reconexão e conflitos reais. Migração NÃO aplicada em produção nesta execução.
- [ ] **Lote 2 — integração** — Implementação local de quota, idempotência e UI feita; aplicar migração, configurar chave privada na Vercel e validar RPC/RLS em Postgres real antes da publicação.
- [ ] **Lote 3 — verificação real** — Validar trocas e recusas no navegador e persistência do perfil em ambiente autenticado antes de publicar.
- [ ] **Lote 4 — verificação real** — Inspecionar visualmente PDFs longos e texto com acentos no navegador antes de publicar.
- [ ] **Lote 5 — IA opcional** — Camada explicativa Gemini não foi adicionada; motor determinístico funciona sem ela. Definir limite persistente por usuário antes de habilitar chamadas durante treino.
- [ ] **Lote 6 — banco real** — Aplicar `202609240002_api_rate_limits.sql` e testar RPC autenticada, limites simultâneos, RLS e integração de OCR/IA.

- [ ] **T6** — Configurar `GEMINI_API_KEY` na Vercel e validar geração real · atende `R7`, `R8` · verifica-se: OCR e plano funcionam em produção.
- [ ] **T9** — Validar em produção a recuperação de gravações pendentes, conflitos reais e salvamento de plano gerado · atende `R13`, `R14`.

## Anotado durante a implementação

- [ ] Definir rate limit por usuário antes de divulgação pública.
- [ ] Criar aviso de privacidade específico para conteúdo enviado à IA.
- [ ] Avaliar persistência de nível e equipamentos no perfil após validar o MVP.

## Feito

- [x] **Lote 3 — código local** — Padrão, região, mecânica e lateralidade opcionais; catálogo ampliado sem alterar IDs antigos; filtro determinístico, equipagem/recusa/override, proteção contra alternativas antigas ruins e IA livre; testes de equivalência. Verificação real pendente.
- [x] **Lote 4 — código local** — Exportação A4 para rotina e programa, view model puro e teste de histórico/privacidade; verificação visual pendente.
- [x] **Lote 5 — motor local** — Dica determinística após série, com testes de faixa, RIR, RPE, histórico e exclusões de aquecimento/cardio. Sem camada Gemini opcional.
- [x] **Lote 6 — auditoria local** — Revisadas rotas existentes, callback interno, logs, limites de IA e OCR; threat model e riscos em `SECURITY.md`. Integração de banco real pendente.

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
