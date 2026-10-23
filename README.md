# encorpa-portal

Encorpa Dashboard: o portal de análise e operação da Encorpa. React 19 com Vite 8 (desde 16/10/2026), fundo em ondas e cartões de
vidro, a partir dos templates Glassy Dashboard, Glassy CRM, Chat App UI e Sidebar UI. Desde 23/10 a cor é escolhida em Configurações › Aparência
(roxo, azul, laranja, amarelo, verde, branco ou preto, no tema escuro e no claro).

## Rodar no computador

- `npm install` e depois `npm run dev` (abre em http://localhost:5173). Sem o Vercel não existe `/api/data`: o portal usa o
  último retrato guardado no navegador ou `public/data.js`. Em Configurações (engrenagem › Dados) dá para ligar os dados de exemplo.
- Dados de exemplo (desde 23/10, `src/lib/demo.js`): um ano de operação simulada, tabela por tabela (leads, conversas, mensagens,
  respostas da Malu, pedidos, chamadas de modelo, Meta, Hermes), passado pela mesma conta do servidor (`lib/build.mjs › build`), num
  worker. Todo número fecha entre as abas. Os workflows são os do n8n de verdade, da última leitura guardada no navegador. Responder e
  pausar a Malu ficam desligados no exemplo.
- `npm run build` gera `dist/`, que é o que o Vercel publica.
- `npm test` roda os testes das contas (`lib/build.mjs`) e das funções (`api/`) com dados sintéticos (`tests/fixture.mjs`);
  `npm run test:ui` abre a tela Conversas no Chromium contra um servidor de teste (depois do build). `npm run check` faz os três.
  O GitHub roda o mesmo em todo push e pull request (`.github/workflows/ci.yml`). Mudou uma conta ou uma tela, rode antes de publicar.

## Estrutura

- `src/pages/`: Painel, Conversas, Pedidos, Malu, Anúncios, Clientes (Origem e recompra; Score e Perfil, que era a aba Leads até
  23/10), Financeiro, Automações, Integrações, Notas.
- Painel (23/10): caixa de entrada em 3 blocos de meia altura (não respondidas, com pessoa, tempo excedido de 15 min, `src/lib/inbox.js`);
  cada um abre Conversas no filtro. Todo bloco tem o formato da fileira de 4 (3 por fileira = 4/3 maior, CSS "Proporção dos blocos").
- `src/components/`: fundo em ondas, menu lateral que recolhe, topo (período, busca ⌘K, notificações, preferências), gráficos e peças de vidro.
- `src/lib/`: constantes das métricas, carregamento dos dados, formatação e o menu.
- `lib/build.mjs` (servidor): monta os dados a partir do Supabase, do n8n e da Meta. `lib/meta.mjs`: leitura do Meta Ads.
- `api/data.js`: função do Vercel. `api/chats.js`: só as conversas, sem cache, para a tela Conversas. `api/chat.js`: resposta do
  operador e a chave da Malu por conversa. `api/leads.js`: score e perfil por lead, da view mascarada
  `lead_profiles_v` (Ricos-com-AI, migração 0029; sem telefone, nome, endereço, dor nem gancho). Sem a view responde `available: false`. `middleware.js`: login do site todo.
- `n8n/`: os dois workflows do n8n que são do portal (cópia do que está ativo no PikaPods).

## Publicado no Vercel

- `api/data.js` lê o Supabase, o n8n e a Meta e guarda a resposta 60 s na memória da função (o cache do Vercel não guarda
  resposta com login). A Meta é lida no máximo a cada 15 min; se falhar, o portal mostra a última leitura boa (até 6 h) com um
  aviso. Toda leitura tem limite de tempo. A página busca em `/api/data` a cada 5 min e mostra o horário em "atualizado".
- Financeiro › Caixa (desde 19/10): o caixa necessário para rodar o gasto com anúncios (média por dia no período, da Meta, ou
  um gasto por dia digitado para simular; o critério de pausa usa a média dos últimos 7 dias), com as premissas ideais do teste: CPL R$ 1,25, conversão 10%, IA R$ 0,05 por lead,
  70% na entrega com 1 peça de R$ 129,90 e 7 dias até entregar. Sai do caixa: anúncio (imposto já incluído), IA, WhatsApp e o
  adiantado dos pedidos na entrega; os custos fixos ficam fora (é o caixa de rodar a operação). Conta em `src/lib/economics.js`, com teste.
- `middleware.js` pede e-mail e senha (login do navegador) para o site todo e para `/api/data`.
- Variáveis do projeto no Vercel (Settings > Environment Variables):
  - `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SERVICE_ROLE`, `SERVICE_ROLE_KEY`): a chave service_role. Só no servidor, nunca no navegador.
  - `SUPABASE_URL` (opcional; padrão: o projeto da Encorpa).
  - `N8N_API_KEY` (opcional): chave da API do n8n para a seção Automações (workflows e execuções). `N8N_URL` opcional; padrão: o n8n da Encorpa no PikaPods. O portal lê só nome, tipo, posição e ligação dos nós, nunca os parâmetros.
  - `META_ACCESS_TOKEN` e `META_AD_ACCOUNT_ID`: token só de leitura (`ads_read`) e a conta de anúncios, para a seção Anúncios.
  - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_WABA_ID` (opcionais, desde 23/10): token com `whatsapp_business_management`,
    o id do número e o da conta do WhatsApp Business, para Malu › Número do WhatsApp (estado, qualidade, limite e templates;
    `lib/whatsapp.mjs`, a cada 15 min, leitura de gestão sem custo de mensagem). Número restrito ou com qualidade baixa pinta o
    critério de pausa "Número do WhatsApp" de vermelho.
    O mesmo `WHATSAPP_TOKEN` serve `api/media.js`, que mostra em Conversas a imagem original que a cliente mandou (baixar mídia da Meta
    não é cobrado; a Meta guarda cerca de 30 dias). A imagem aparece quando `messages.media` tem o id dela, o que depende de a função
    `whatsapp` do Ricos-com-AI gravar esse id (hoje ela descreve a imagem com o modelo e descarta o id).
  - `INBOUND_SIGNING_SECRET` (desde 23/10, o mesmo do Supabase): selo das mensagens de Malu › Teste. Sem ele, a turn recusa o teste
    se o selo estiver ligado na produção.
  - `PORTAL_USERS`: quem pode entrar, no formato `email1:senha1:papel,email2:senha2`. **Sem ela ninguém entra.** Papel (desde 23/10,
    `lib/auth.mjs`): `admin` (tudo, e vê os usuários em Configurações), `operador` (responde, pausa a Malu, usa Malu › Teste) ou
    `leitura` (só vê). Sem papel, admin. Responder (`api/chat.js`) e testar (`api/test.js`) conferem o papel no servidor.
- `lib/build.mjs` tem a conta das métricas (usada pela função e por `scripts/build-data.mjs`). Desde 16/10 (operador) traz as conversas com as clientes para a tela Conversas: nome, final do telefone, UF e o texto. Nunca endereço completo, CPF ou telefone inteiro.
- `public/data.js` é uma cópia de segurança sem conversas nem nomes de clientes (o git guarda para sempre). Se `/api/data` falhar, o portal mostra primeiro o último retrato bom guardado no navegador e só depois esse arquivo.

## Financeiro: custos (desde 20/10)

- O anúncio entra pelo gasto que a Meta devolve, que **já inclui** o imposto de 13,83% (operador, 20/10). Nada é somado por cima.
- IA = soma de `llm_calls` (toda chamada de modelo dos leads, inclusive áudio e imagem); personas (`dropSynthetic`, também em
  `llm_calls`) e Hermes ficam fora. Dólar a R$ 5,40.
- Fixos: PikaPods cobra por hora, US$ 3,73/mês (saldo US$ 9,46 em 20/10, recarga automática de US$ 10 abaixo de US$ 1) e número do
  WhatsApp R$ 55 no início + R$ 35 a cada dia 5 (`PIKAPODS` e `WA_NUMBER` em `src/lib/economics.js`). No resultado do período entram
  só quando vencem e são pagos de novo (`fixedPayments`), sem rateio por dia (operador, 20/10); lucro e margem operacional descontam
  os fixos, o ROI não.
- "Investido até agora" (Financeiro › Resultado) é recalculado a cada leitura: Meta, `llm_calls` e pedidos ao vivo, PikaPods pelas
  recargas e o número pelas mensalidades. Só precisa de edição se mudar o preço do PikaPods ou do número.

## Onde o portal mede mais que a central de atendimento (23/10)

- Malu › Resultados: a taxa de resolução honesta (comprou ou encerrou sem pessoa ÷ encerradas) e, embaixo, a mesma semana no critério
  comum do mercado (abandono e passagem para pessoa contam como resolvidas, sobre todas as atendidas), para mostrar a diferença.
- Resultado por versão da Malu com a venda de cada versão (conversas que terminaram em pedido ÷ conversas da versão).
- Financeiro › Resultado: custo por pedido ((anúncio + IA + WhatsApp) ÷ pedidos), margem média por pedido e IA por pedido.

## Malu › Teste (desde 23/10)

- `api/test.js`: conversas simuladas com a Malu de produção. Cada "Nova conversa" ganha um telefone inventado `55000999` + 5 dígitos
  (prefixo da rodada de personas; nenhum número real colide), então dá para abrir várias e voltar a qualquer uma. A mensagem vai
  direto para a função `turn` (a turn responde e não manda nada pelo WhatsApp; quem manda é o n8n); a recepção ganha o segundo passo
  na hora, como o nó Wait do n8n faz. Depois de cada mensagem os lembretes da régua da conversa são cancelados. Apagar remove o lead
  de teste em cascata. Essas conversas ficam fora das métricas e das Conversas do portal; cada resposta custa as chamadas de modelo dela.
- Atenção: o workflow "Encorpa — Portal: conversa não resolvida" ainda não ignora os telefones de teste. Uma conversa de teste que
  caia em "não resolvida" manda o e-mail ao operador.

## Responder pelo portal (desde 16/10)

- Em Conversas, a caixa no pé da conversa envia pelo WhatsApp. `api/chat.js` primeiro pausa a Malu naquela conversa
  (`leads.handoff_at`, a chave que o turno e a régua já respeitam) e depois chama o webhook `portal-responder` do n8n.
- O workflow **Encorpa — Portal responder** (`n8n/portal-responder.json`) confere a `N8N_API_KEY` do portal contra a API do
  próprio n8n, passa pela mesma regra do formulário "Responder cliente" (`turn` › `human_reply`: janela de 24 h, texto,
  duplicata), grava a mensagem na conversa e entrega ao "WhatsApp envio". Se a Meta recusar, chega o e-mail de falha de envio.
- "Devolver para a Malu" limpa `handoff_at`: ela volta a responder a partir da próxima mensagem da cliente.
- Desde 19/10 a tela Conversas lê `api/chats.js` a cada 15 s (sem cache), com uma linha por cliente: as mensagens de todas as
  conversas do lead juntas, e o id é o da conversa mais nova, a mesma em que `human_reply` grava a resposta. Se a leitura falhar,
  a lista fica na tela com um aviso, em vez de esvaziar.
- Recusa certa do envio (janela fechada, duplicata, chave do n8n) devolve a Malu se foi o próprio envio que a pausou.
- Conversas de teste da rodada de personas (telefone `5500099…`, apagadas no fim da rodada) não aparecem no portal nem nas
  métricas lidas das tabelas, e o portal recusa responder a elas. As views `eval_*` do Ricos-com-AI ainda as contam.
- Precisa de `N8N_API_KEY` no Vercel (a mesma da seção Automações).

## E-mail de conversa não resolvida (desde 16/10)

- O workflow **Encorpa — Portal: conversa não resolvida** (`n8n/conversa-nao-resolvida.json`) roda a cada 5 min e manda um
  e-mail ao operador quando uma conversa passa a ser "não resolvida" pela regra do portal (passagem ao operador ou resposta
  pronta, sem compra), com o link direto dela no portal. Janela fixa de 5 min: cada conversa gera um e-mail só. Desde 17/10 os
  avisos antigos "não precisa responder" (Turno da agente e Relógio da régua) estão desligados no n8n.

## Malu › Hermes

- Rodadas (`hermes_runs`), propostas com motivo, evidência, decisão e o que mudou (`hermes_proposals`) e quantos leads faltam
  para a próxima rodada (`hermes_backlog`). O Hermes roda pela Action `hermes.yml` do Ricos-com-AI. Cada proposta leva o nome
  da versão da Malu no ar quando nasceu ("Hermes V26"; antes da v1, de 05/10, "Hermes V0"), e o custo vai em reais (US$ × 5,40).
  Essas três tabelas são opcionais: se uma falhar, o resto do portal continua.
- `public/data.js` não leva a evidência nem a mudança proposta das propostas.
