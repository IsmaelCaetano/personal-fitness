# Personal Fitness — Especificação do Produto

## Problema

Pessoas que treinam musculação, corrida ou atividades híbridas precisam organizar rotinas, registrar a execução real e acompanhar evolução sem perder cargas anteriores. Fichas chegam em formatos variados — texto, JSON, foto ou orientação de um personal — e planos genéricos ignoram disponibilidade, experiência, equipamento e histórico.

## Sucesso

- [ ] Cada conta acessa somente os próprios dados e inicia sem registros fictícios.
- [ ] Um novo usuário informa altura, peso, objetivo e dias de treino antes de abrir o painel.
- [ ] O usuário cria, importa, revisa, edita, exclui, escolhe e executa rotinas.
- [ ] A IA gera um plano revisável a partir do perfil e das preferências da conta, sem salvar automaticamente.
- [ ] Uma imagem de ficha é transcrita para texto revisável antes da importação.
- [ ] Cargas anteriores, volume, duração e histórico permanecem disponíveis entre sessões.

## Escopo

### Faz

- Autenticação por e-mail, cadastro, recuperação de senha e sessão via Supabase.
- Onboarding obrigatório por usuário.
- Rotinas de musculação, cardio, mobilidade e atividades livres.
- Importação por texto, JSON, arquivos de texto e imagem.
- Geração assistida por IA com revisão antes de salvar.
- Substituições de exercício, escolha do treino do dia e conclusão/cancelamento.
- Histórico, volume, progressão estimada, medidas e exportação por período.
- Sincronização por usuário com cache local para uso resiliente.

### Não faz

- Não diagnostica lesões, prescreve reabilitação ou substitui médico/personal.
- Não promete resultados nem define carga máxima sem histórico suficiente.
- Não treina um modelo próprio nem copia uma base proprietária de terceiros.
- Não salva resultado de IA ou OCR sem revisão/ação explícita do usuário.
- Não inclui dados demonstrativos nas contas reais.
- Não compartilha dados entre contas.

## Requisitos

| ID | Requisito | Como se verifica |
|---|---|---|
| R1 | Toda leitura e escrita persistida deve estar vinculada ao usuário autenticado. | Requisições sem sessão retornam 401; políticas RLS impedem acesso cruzado. |
| R2 | Nova conta deve começar com rotinas, sessões e medidas vazias. | `initialData()` retorna coleções vazias e teste de contrato confirma. |
| R3 | Onboarding exige altura de 80–250 cm, peso de 20–500 kg, ao menos um objetivo e frequência de 1–7 dias. | Schema e teste de UI/API rejeitam valores fora da faixa. |
| R4 | Perfil deve permitir alterar objetivos, medidas, unidade, descanso e meta semanal. | Alteração persiste e reaparece após recarregar. |
| R5 | Rotina deve aceitar até 40 itens com séries, alvo, descanso, notas e alternativas. | `routineSchema` valida entrada e rejeita principal como alternativa. |
| R6 | Importação por texto/JSON deve produzir uma etapa de revisão e nunca persistir diretamente. | Parser retorna rascunhos; somente “Importar” chama `mutate`. |
| R7 | Imagem deve aceitar JPG/PNG/WEBP/HEIC até 8 MB e retornar transcrição editável. | Tipos/tamanho inválidos falham; texto aparece no campo antes de organizar. |
| R8 | Gerador de IA deve considerar objetivos, frequência, tempo, nível, equipamento, limitações, preferências e até 12 sessões recentes da conta. | Corpo da API e teste contratual contêm todos os campos. |
| R9 | Resultado da IA deve usar somente IDs da biblioteca enviada, respeitar 1–7 dias e validar com Zod antes de salvar. | Resposta fora do catálogo ou schema retorna erro e não persiste. |
| R10 | Usuário deve revisar justificativa, rotinas, exercícios e progressão antes de salvar plano gerado. | Modal apresenta preview e exige clique em “Salvar plano”. |
| R11 | Treino ativo deve reutilizar a última carga registrada quando disponível. | Teste de domínio cobre `getPreviousExercisePerformance`. |
| R12 | Volume conta somente séries concluídas e histórico demonstra dados reais. | Testes de domínio e UI de histórico. |
| R13 | Operações concorrentes devem detectar versão desatualizada. | API retorna 409 quando a versão não corresponde. |
| R14 | Falha de rede deve preservar alterações locais pendentes e permitir sincronização posterior. | Teste/manual offline mostra estado local e fila pendente. |
| R15 | Nenhuma credencial privada pode aparecer no bundle do cliente ou no repositório. | Gate de segredos e revisão de variáveis `NEXT_PUBLIC_*`. |

## Ambiente

- Produção: Vercel, projeto `personal-fitness`.
- Fonte: GitHub `IsmaelCaetano/personal-fitness`, branch `main`.
- Banco e identidade: Supabase Postgres + Auth + RLS.
- IA: Gemini Developer API via variável privada `GEMINI_API_KEY`.
- Cliente: navegadores modernos em desktop e celular; PWA/service worker existente.

## Raio de impacto

Falhas de autenticação ou RLS podem expor dados entre usuários e são críticas. Falhas de sincronização podem perder histórico e são altas. Falhas da IA/OCR devem ser isoladas: a criação manual e a importação por texto continuam funcionando, sem gravar resposta parcial.

## Modos de falha previstos

| Falha | Comportamento esperado |
|---|---|
| Gemini sem chave ou indisponível | Mensagem clara; nenhuma rotina é criada; fluxos manuais continuam. |
| Resposta de IA inválida | Zod rejeita; usuário pode tentar novamente. |
| Foto ilegível | Solicitar foto mais nítida; nunca inventar campo ilegível. |
| Sessão expirada | API retorna 401 e pede novo login. |
| Registro alterado em outro aparelho | API retorna 409 e oferece resolução de conflito. |
| Rede interrompida ao salvar | Alteração permanece na fila local até nova tentativa. |
| Dados antigos demonstrativos | API remove somente registros explicitamente marcados como demo. |

## Decisões arquiteturais

| # | Decisão | Motivo | Alternativa descartada |
|---|---|---|---|
| D1 | Recursos de fitness ficam em JSONB versionado por usuário. | Permite evoluir modelos do MVP com concorrência otimista. | Uma tabela por entidade agora aumentaria migrações. |
| D2 | Zod valida dados no cliente e servidor. | Impede respostas de IA e payloads malformados de entrarem no banco. | Confiar somente em TypeScript. |
| D3 | Chave Gemini existe somente no servidor. | Evita expor credencial no navegador. | Chamar Gemini diretamente do cliente. |
| D4 | IA seleciona IDs de uma biblioteca controlada. | Mantém mídia, músculos e alternativas consistentes. | Aceitar nomes livres sem vínculo. |
| D5 | OCR apenas transcreve; parser e usuário revisam depois. | Reduz risco de salvar interpretação incorreta. | Importar foto direto no banco. |
| D6 | Toda geração é específica à conta atual. | O MVP atende múltiplos usuários sem regras pessoais hardcoded. | Perfil fixo do criador. |

## Em aberto

- [ ] Definir limites comerciais de gerações por usuário/dia antes de abrir o MVP publicamente.
- [ ] Decidir se equipamentos e nível também serão persistidos no perfil, além do pedido de cada geração.
- [ ] Adicionar política de privacidade explicando envio de texto/imagem ao provedor de IA.
- [ ] Confirmar se fotos devem ser descartadas imediatamente sem qualquer armazenamento (implementação atual: não persiste).
