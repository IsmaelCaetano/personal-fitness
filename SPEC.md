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
| R13 | Operações concorrentes devem detectar versão desatualizada e oferecer escolha entre as versões. | API retorna 409 quando a versão não corresponde; conflito real permite manter a alteração local ou usar a versão da nuvem para o registro afetado. |
| R14 | Falha de rede deve preservar alterações locais pendentes e permitir sincronização posterior sem duplicar gravação já confirmada. | Ao entrar, compara a fila com a nuvem e remove a alteração idêntica já salva; mantém as demais e solicita escolha somente se o conteúdo divergir. |
| R15 | Nenhuma credencial privada pode aparecer no bundle do cliente ou no repositório. | Gate de segredos e revisão de variáveis `NEXT_PUBLIC_*`. |
| R16 | Importar semana com múltiplas sessões em um dia, atividade cardio junto de força, descanso e cargas progressivas sem perder linhas. | Teste de importação espera duas rotinas na segunda, futebol de 60 min na terça, domingo sem rotina e cargas 100/110/120 kg por série. Prévia permite corrigir o dia. |
| R17 | Edições durante um envio preservam tanto a intenção mais recente quanto a tentativa em trânsito. | Resposta perdida e retry confirmam a tentativa anterior sem descartar a edição posterior; versões divergentes de outro dispositivo continuam exigindo escolha. |
| R18 | A fila é recuperada antes de qualquer leitura de rede e abas não sobrescrevem os rascunhos umas das outras. | Abertura offline, reconexão, duas abas e recuperação de diário abandonado são cobertas por testes. |
| R19 | A versão de um ID nunca reinicia depois de excluir/restaurar; inicializar a conta não sobrescreve perfil nem oculta recursos existentes. | Testes de exclusão/restauração rejeitam escrita de dispositivo antigo; criação concorrente do perfil usa `ON CONFLICT DO NOTHING`. |
| R20 | Cada conta individual tem duas gerações de programa por IA por mês calendário UTC. Importações, OCR, edição e treino manual não consomem quota. | Reserva e conclusão transacionais por usuário e ID de requisição; falha libera reserva; retry retorna mesmo plano válido. |

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
| Registro alterado em outro aparelho | API retorna 409 e oferece escolha entre alterações locais e versão da nuvem, preservando os demais registros. |
| Rede interrompida ao salvar | Alteração permanece na fila local; se o servidor já a salvou, a fila é confirmada sem criar conflito falso. |
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
| D7 | Preservar uma tentativa imutável na fila até confirmar seu resultado. | A edição mais nova não é evidência do conteúdo de uma requisição anterior cuja resposta se perdeu. | Sobrescrever a tentativa ou incrementar versão sem confirmação. |
| D8 | Cada aba possui um diário local exclusivo, protegido por Web Locks. | Evita sobrescrita de filas entre abas; abas encerradas liberam diários recuperáveis. | Um array compartilhado em localStorage com last-write-wins. |
| D9 | Exclusão mantém marcador e versão crescente, com payload vazio. | Impede que excluir/restaurar reabra uma versão antiga para outro dispositivo. | Apagar a linha e recriar com `version=1`. |
| D10 | Quota de IA usa tabelas relacionais e funções PostgreSQL acessíveis só ao servidor. | Requests paralelos e repetidos não ultrapassam o limite; falhas não consomem. | Contador em JSONB ou apenas na UI. |

## Protocolo de sincronização — Lote 1

- Arquitetura preservada: entidade JSONB por usuário, CAS por `version`, fila otimista, retry e HTTP 409. `sync-client.ts` contém o mesmo ciclo de sincronização isolado do React para testes de requisições em trânsito; o hook mantém debounce de 450 ms e retry de 10 s. Requests têm timeout de 20 s.
- A intenção mais recente e a tentativa enviada são persistidas juntas, antes do POST. Confirmação da tentativa avança somente a versão daquela entidade. `stamp` é monotônico dentro do diário. Dados são normalizados pelo mesmo Zod antes de enfileirar.
- Depois de falha ambígua, ler a nuvem antes do retry. Uma tentativa de update/insert só é reconhecida pelo conteúdo **e pela próxima versão exata**. Se o GET ainda vê o estado anterior, não descartar a intenção mais nova: o request pode estar terminando no servidor.
- Conflitos reais bloqueiam apenas os IDs afetados. Os demais sincronizam normalmente. Resolver um conflito não aceita uma versão da nuvem nem descarta uma edição local surgida depois da versão apresentada ao usuário.
- A fila é carregada antes da rede, inclusive offline. O cache antigo é transferido somente depois de uma gravação durável; conteúdo ilegível permanece intacto. Snapshot e fila ficam no mesmo envelope local. Falha de armazenamento mantém a fila em memória e exibe aviso para manter a aba aberta.
- Diários são separados por usuário e aba. Web Locks mantêm a posse até desmontagem/encerramento, inclusive em abas duplicadas. Diários abandonados são recuperados sequencialmente, sem combinar silenciosamente versões locais diferentes. Browser sem Web Locks ou armazenamento acessível recebe erro explícito, sem apagar dados; o contrato é navegador moderno em HTTPS.
- `deletedIds` é opcional para tolerar snapshots anteriores. `versions` inclui marcadores de exclusão. A API devolve somente entidades não excluídas; restauração explícita usa CAS na versão do marcador. O payload excluído é substituído por `{}`; sessões históricas independentes permanecem intactas.
- A migração `202609230001_fitness_deletion_versions.sql` adiciona somente `deleted_at`, sem alterações em RLS ou dados existentes. Aplicar a migração versionada **antes** de publicar o código. Não remover os marcadores/coluna ao reverter: depois de novas exclusões, rollback precisa manter filtragem de `deleted_at` e versões monotônicas. A migração não recupera versões de exclusões físicas anteriores a ela.

### Evidência e limites da validação

- Reproduzidos com falha antes da correção: resposta perdida seguida de nova edição; reinício de versão após excluir/restaurar o mesmo ID.
- `tests/sync-client.test.ts`: cenários A–O com transporte controlado e promises suspensas, alterações durante GET/POST, escolha local/nuvem, timeout/perda de resposta simulados, falha de armazenamento e sessão expirada.
- `tests/sync-cache.test.ts`: localStorage compartilhado simulado, isolamento entre abas/contas, migração, retomada de diários e cache corrompido. Gerenciador de locks simulado; ainda falta smoke test com Web Locks reais em navegadores.
- `tests/persistence.test.ts`: executa o query builder usado pela API contra um adaptador PostgREST em memória (CAS, restrição única, filtros de usuário/recurso, bootstrap e exclusões). Não equivale a testar RLS/transações contra Postgres real.
- A migração, o fluxo autenticado em produção e dois dispositivos reais precisam de validação antes de liberar este lote. Nenhuma credencial nem dados de produção são usados nos testes.

## Em aberto

## Substituições equivalentes — Lote 3

- O catálogo mantém todos os IDs `base-*` originais e acrescenta variantes ao final. Campos opcionais de movimento, região, mecânica e lateralidade aceitam perfis antigos; exercícios sem classificação segura não recebem sugestões automáticas.
- Uma substituição automática exige o mesmo padrão de movimento, região alvo e mecânica. Equipamentos indisponíveis, alternativas recusadas e candidatas fora da lista aprovada pelo treinador são removidos. Uma lista vazia é aceitável; conteúdo já salvo incompatível também é filtrado na execução.
- Alternativas sugeridas pela IA são ignoradas. O servidor gera opções usando o filtro determinístico depois de validar o programa; nunca pede à IA que escolha livremente pelo músculo.
- O motivo de recusa do usuário fica opcionalmente no próprio perfil e só afeta a relação entre exercício principal e alternativa, sem alterar a biblioteca global.

## Exportação em PDF — Lote 4

- Rotina ou programa inteiro podem ser exportados em A4 com cabeçalho claro, atleta, objetivo, data, meta semanal, exercícios, séries, alvo, carga, descanso, esforço e observações. Histórico real fornece última carga quando houver; IDs técnicos não entram no modelo exportado.
- Transformação pura `FitnessData → WorkoutPdfModel` é testada e a renderização com jsPDF é carregada no clique. jsPDF é biblioteca mantida para PDF no navegador e evita serviço externo e envio de dados do treino. Script transitivo de `core-js` não é autorizado no install.

## Assistente de séries — Lote 5

- Regras puras usam alvo de repetições, resultado e esforço (RIR/RPE) para orientar progressão conservadora após cada série concluída. Séries de aquecimento, etapas de duração e registros pendentes não geram dica de carga. Sem histórico, a mensagem estabelece uma linha de base.
- Camada explicativa por Gemini é opcional e não é chamada por série; qualquer integração posterior precisa de limite de requisições persistido e fallback para estas regras.

## Auditoria de segurança — Lote 6

- Rotas existentes exigem sessão e origem para mutações; payloads têm limites e validação. Callback de autenticação só aceita redirecionamento local. Erros de persistência e OCR não registram exceções com possíveis dados da conta.
- `api_rate_limits` contém janelas por conta e operação. A RPC usa `auth.uid()` internamente e operações/tetos fixos; OCR e gerador retornam 429 ao atingir teto, 503 se migração ausente.
- `SECURITY.md` descreve ameaças, controles, migrações e verificações pendentes. RLS e funções SQL ainda precisam de testes contra Postgres real antes de deploy.


## Quota de IA — Lote 2

- Somente a criação de programas pela IA conta: duas solicitações bem-sucedidas por mês calendário UTC para a conta individual gratuita. Edição, importação, OCR e treino manual continuam sem quota de geração.
- `ai_usage` e `ai_generation_requests` são relacionais e independentes do JSONB de fitness. Reserva, conclusão e liberação passam por RPCs transacionais restritas a `service_role`, com trava por usuário/período. O ID da tentativa preserva resposta válida para retries sem cobrança duplicada.
- Reservas pendentes abandonadas por mais de dois minutos são liberadas na consulta seguinte; resultado falho no Gemini/JSON/Zod/domínio libera a reserva. Falha ambígua ao confirmar não devolve plano ainda não confirmado como sucesso.
- Migrar `202609240001_ai_usage.sql` após a migration do lote 1, antes de publicar a rota. `SUPABASE_SERVICE_ROLE_KEY` é privada na Vercel, sem prefixo público. O contador e a renovação são consultados em `/api/ai/workout` por GET autenticado.
- Testes locais simulam concorrência e retry; ainda falta teste da função SQL e RLS em Postgres real.

- [ ] Definir limites comerciais de gerações por usuário/dia antes de abrir o MVP publicamente.
- [ ] Decidir se equipamentos e nível também serão persistidos no perfil, além do pedido de cada geração.
- [ ] Adicionar política de privacidade explicando envio de texto/imagem ao provedor de IA.
- [ ] Confirmar se fotos devem ser descartadas imediatamente sem qualquer armazenamento (implementação atual: não persiste).
