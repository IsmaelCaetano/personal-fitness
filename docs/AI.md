# IA e decisões determinísticas

**Provedor:** Gemini Developer API; modelo `gemini-3.5-flash-lite` e timeout em `lib/fitness/gemini.ts`; configuração privada `GEMINI_API_KEY`. Não há treinamento de modelo próprio.

## Gerador de programa

`app/api/ai/workout/route.ts` exige usuário Auth, origem, rate limit e input Zod. Lê perfil do sujeito autorizado (ou aluno vinculado) e no máximo 12 sessões recentes, envia catálogo limitado ao Gemini, valida JSON/Zod/domínio e devolve **prévia**; UI salva somente com ação humana. Personal gera rascunho para aluno e revisa antes de atribuir. Não permitir que prompt de usuário sobreponha regras nem aceitar ID fora do catálogo. O servidor calcula alternativas, não o modelo.

Quota: `FREE_AI_WORKOUT_GENERATIONS_PER_MONTH = 2` em `lib/fitness/ai-quota.ts`; mês calendário UTC, por conta solicitante. `ai_usage` e `ai_generation_requests` registram reserva/resultado atômico e request ID idempotente. Erro Gemini, JSON ou validação libera reserva; retry com o mesmo pedido recupera programa válido sem cobrança dupla. `GET /api/ai/workout` retorna uso, limite e renovação; geração com quota esgotada retorna 429. Edição, importação, OCR e execução não gastam essa quota. `consume_api_rate_limit` limita geração a 6/h por usuário; 503 se infraestrutura de quota/limite não estiver disponível.

## OCR e importação

`app/api/ai/ocr/route.ts` exige Auth, origem, tipo/tamanho de imagem e limite de 12/h. Recebe JPG/PNG/WEBP/HEIC até 8 MB, processa em memória, devolve texto editável; `lib/fitness/import.ts` transforma descrição/JSON em prévia revisável, inclusive treinos no mesmo dia e cargas por série. Foto não é armazenada pelo aplicativo.

## Coach e substituições

Dicas de progressão após série são regras puras em `lib/fitness/domain.ts`, com alvo, reps, RIR/RPE e histórico. **Não existe endpoint de coach por LLM**: falha de Gemini não impede as dicas. Alternativas são classificadas em `lib/fitness/recommendations.ts` por `movementPattern`, `targetRegion`, `mechanics`, `laterality`, disponibilidade de equipamento e preferências; trainer override pode restringir ou bloquear. Mesmo músculo isoladamente não basta (elevação lateral ≠ desenvolvimento). Lista vazia é preferível a candidato incompatível.

## Segurança e custos

Saída de IA é dado não confiável: parse → Zod → validação de domínio → preview → confirmação → persistência. IA não altera permissões, quotas, vínculos ou pagamentos. Envia apenas contexto necessário, nunca histórico completo; chaves permanecem server-side. Uso do Gemini consome quotas/custos do provedor configurado, que podem variar; quota do aplicativo e rate limits protegem o MVP. Se o serviço falhar, criação manual, importação textual e coach determinístico continuam disponíveis. Consulte [SECURITY.md](../SECURITY.md).
